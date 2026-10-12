import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { clampPage } from '../common/text-utils';
import { computeStats } from '../company/company.service';
import { DraftsStore } from '../scraper/drafts.store';
import { SubscriptionsService } from '../accounts/subscriptions.service';
import { AccountRequestsService } from '../accounts/account-requests.service';
import {
  APPLICABILITE_NON_ANALYSEE,
  APPLICABLE,
  ETAT_NON_ANALYSE,
  LIVE_ACTIONS_TEXT,
  OPEN_ACTION_STATES,
  daysUntil,
} from '../company/rules';

export class AdminListQuery {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  secteurId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  typeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(100)
  pageSize?: number;

  /** Texts: only those no company receives yet ("1") */
  @IsOptional()
  @IsIn(['1'])
  unassigned?: string;

  /** Companies: by subscription ("a-relancer" = ending soon, ended or suspended) */
  @IsOptional()
  @IsIn(['a-relancer', 'bloques', 'sans-date'])
  abonnement?: 'a-relancer' | 'bloques' | 'sans-date';
}

const TS_ACTIVE: Prisma.TexteSocieteWhereInput = {
  OR: [{ deleted: false }, { deleted: null }],
  texte: { deleted: false },
};
const MAIN_COMPANY: Prisma.CompanyWhereInput = {
  deleted: false,
  multicompte: 0,
};
/** Same definition as the company space's « À évaluer ». */
const PENDING: Prisma.TexteSocieteWhereInput = {
  OR: [
    { applicabiliteId: APPLICABILITE_NON_ANALYSEE },
    { applicabiliteId: APPLICABLE, gestionetatId: null },
    { applicabiliteId: APPLICABLE, gestionetatId: ETAT_NON_ANALYSE },
  ],
};

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private drafts: DraftsStore,
    private subscriptions: SubscriptionsService,
    private accountRequests: AccountRequestsService,
  ) {}

  private async statsByCompany(companyIds: number[]) {
    const rows = await this.prisma.texteSociete.groupBy({
      by: ['companyId', 'applicabiliteId', 'gestionetatId'],
      where: { ...TS_ACTIVE, companyId: { in: companyIds } },
      _count: { _all: true },
    });
    const by = new Map<
      number,
      { applicabiliteId: number; gestionetatId: number | null; count: number }[]
    >();
    for (const r of rows) {
      if (!r.companyId) continue;
      if (!by.has(r.companyId)) by.set(r.companyId, []);
      by.get(r.companyId)!.push({ ...r, count: r._count._all });
    }
    return new Map(
      companyIds.map((id) => [id, computeStats(by.get(id) ?? [])]),
    );
  }

  async overview() {
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const [
      companies,
      subAccounts,
      texts,
      textsLast30,
      assignments,
      grouped,
      recentCompanies,
      recentTexts,
    ] = await Promise.all([
      this.prisma.company.count({ where: MAIN_COMPANY }),
      this.prisma.company.count({
        where: { deleted: false, multicompte: { gt: 0 } },
      }),
      this.prisma.texte.count({ where: { deleted: false } }),
      this.prisma.texte.count({
        where: { deleted: false, createdAt: { gte: since } },
      }),
      this.prisma.texteSociete.count({ where: TS_ACTIVE }),
      this.prisma.texteSociete.groupBy({
        by: ['applicabiliteId', 'gestionetatId'],
        where: TS_ACTIVE,
        _count: { _all: true },
      }),
      this.prisma.company.findMany({
        where: MAIN_COMPANY,
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          nom: true,
          raisonsociale: true,
          email: true,
          createdAt: true,
          activated: true,
        },
      }),
      this.prisma.texte.findMany({
        where: { deleted: false },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 6,
        include: { type: true, secteur: true },
      }),
    ]);

    const stats = await this.statsByCompany(recentCompanies.map((c) => c.id));
    const assignCounts = await this.prisma.texteSociete.groupBy({
      by: ['texteId'],
      where: { ...TS_ACTIVE, texteId: { in: recentTexts.map((t) => t.id) } },
      _count: { _all: true },
    });
    const assignBy = new Map(
      assignCounts.map((a) => [a.texteId, a._count._all]),
    );

    const [followUp, todo] = await Promise.all([
      this.companiesToFollow(),
      this.igtsTodo(),
    ]);

    return {
      stats: {
        companies,
        subAccounts,
        texts,
        textsLast30,
        assignments,
        compliance: computeStats(
          grouped.map((g) => ({ ...g, count: g._count._all })),
        ),
      },
      followUp,
      todo,
      recentCompanies: recentCompanies.map((c) => ({
        ...c,
        stats: stats.get(c.id),
      })),
      recentTexts: recentTexts.map((t) => ({
        id: t.id,
        titre: t.titre,
        date: t.date,
        journal: t.journal,
        type: t.type?.name ?? null,
        secteur: t.secteur?.name ?? null,
        createdAt: t.createdAt,
        assignments: assignBy.get(t.id) ?? 0,
      })),
    };
  }

  /**
   * Client companies an IGTS consultant should call: texts waiting for an
   * evaluation and late actions (actions on texts that no longer need them are
   * left out, as in the company space).
   */
  private async companiesToFollow() {
    const [pending, openActions] = await Promise.all([
      this.prisma.texteSociete.groupBy({
        by: ['companyId'],
        where: { AND: [TS_ACTIVE, PENDING] },
        _count: { _all: true },
      }),
      this.prisma.plusaction.findMany({
        where: { gestionactionId: { in: OPEN_ACTION_STATES } },
        select: { companyId: true, texteSocieteId: true, cloture: true },
      }),
    ]);
    const live = new Set(
      (
        await this.prisma.texteSociete.findMany({
          where: {
            ...TS_ACTIVE,
            ...LIVE_ACTIONS_TEXT,
            id: {
              in: openActions
                .map((a) => a.texteSocieteId)
                .filter((id): id is number => id !== null),
            },
          },
          select: { id: true },
        })
      ).map((t) => t.id),
    );
    const overdue = new Map<number, number>();
    for (const a of openActions) {
      if (!a.companyId || !a.texteSocieteId || !live.has(a.texteSocieteId))
        continue;
      const d = daysUntil(a.cloture);
      if (d !== null && d < 0)
        overdue.set(a.companyId, (overdue.get(a.companyId) ?? 0) + 1);
    }
    const pendingBy = new Map(
      pending
        .filter((p) => p.companyId)
        .map((p) => [p.companyId!, p._count._all]),
    );
    const ids = [...new Set([...pendingBy.keys(), ...overdue.keys()])];
    const companies = await this.prisma.company.findMany({
      where: { ...MAIN_COMPANY, id: { in: ids } },
      select: { id: true, nom: true, raisonsociale: true },
    });
    return companies
      .map((c) => ({
        id: c.id,
        name: c.raisonsociale || c.nom,
        contact: c.raisonsociale ? c.nom : null,
        toEvaluate: pendingBy.get(c.id) ?? 0,
        overdueActions: overdue.get(c.id) ?? 0,
      }))
      .sort(
        (a, b) =>
          b.overdueActions * 5 +
          b.toEvaluate -
          (a.overdueActions * 5 + a.toEvaluate),
      )
      .slice(0, 5);
  }

  /** Texts published on the platform that no company receives yet. */
  private async unassignedTextIds(): Promise<number[]> {
    const [assigned, texts] = await Promise.all([
      this.prisma.texteSociete.groupBy({ by: ['texteId'], where: TS_ACTIVE }),
      this.prisma.texte.findMany({
        where: { deleted: false },
        select: { id: true },
      }),
    ]);
    const withCompany = new Set(assigned.map((a) => a.texteId));
    return texts.filter((t) => !withCompany.has(t.id)).map((t) => t.id);
  }

  /**
   * Work waiting on IGTS itself: texts of the Official Journal prepared by the
   * daily collection, and texts nobody receives yet.
   */
  private async igtsTodo() {
    const unassigned = await this.unassignedTextIds();
    let subscriptions = 0;
    for (const info of this.subscriptions.all().values()) {
      if (info.status === 'expiring' || info.status === 'expired' || info.status === 'suspended') subscriptions++;
    }
    return {
      unassignedTexts: unassigned.length,
      drafts: this.drafts.pendingCount(),
      accountsToActivate: this.accountRequests.pending().length,
      subscriptionsToFollow: subscriptions,
    };
  }

  async companies(q: AdminListQuery) {
    const { page, pageSize, skip } = clampPage(q.page, q.pageSize);
    const search = q.search?.trim();
    const where: Prisma.CompanyWhereInput = {
      ...MAIN_COMPANY,
      ...(search
        ? {
            OR: [
              { nom: { contains: search } },
              { raisonsociale: { contains: search } },
              { email: { contains: search } },
              { ville: { contains: search } },
            ],
          }
        : {}),
    };

    if (q.abonnement) {
      const all = this.subscriptions.all();
      const wanted =
        q.abonnement === 'a-relancer'
          ? ['expiring', 'expired', 'suspended']
          : q.abonnement === 'bloques'
            ? ['expired', 'suspended']
            : null;
      if (wanted) {
        where.id = { in: [...all].filter(([, i]) => wanted.includes(i.status)).map(([id]) => id) };
      } else {
        where.id = { notIn: [...all.keys()] };
      }
    }

    const [total, rows] = await Promise.all([
      this.prisma.company.count({ where }),
      this.prisma.company.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          nom: true,
          raisonsociale: true,
          email: true,
          ville: true,
          tel: true,
          fonction: true,
          createdAt: true,
          updatedAt: true,
          activated: true,
        },
      }),
    ]);
    const ids = rows.map((r) => r.id);
    const [stats, subs] = await Promise.all([
      this.statsByCompany(ids),
      this.prisma.company.groupBy({
        by: ['multicompte'],
        where: { deleted: false, multicompte: { in: ids } },
        _count: { _all: true },
      }),
    ]);
    const subsBy = new Map(subs.map((s) => [s.multicompte, s._count._all]));

    return {
      items: rows.map((c) => ({
        ...c,
        subAccounts: subsBy.get(c.id) ?? 0,
        stats: stats.get(c.id),
        subscription: this.subscriptions.info(c.id),
      })),
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async texts(q: AdminListQuery) {
    const { page, pageSize, skip } = clampPage(q.page, q.pageSize);
    const search = q.search?.trim();
    const unassignedIds = q.unassigned ? await this.unassignedTextIds() : null;
    const where: Prisma.TexteWhereInput = {
      deleted: false,
      ...(unassignedIds ? { id: { in: unassignedIds } } : {}),
      ...(q.secteurId ? { secteurId: q.secteurId } : {}),
      ...(q.typeId ? { typeId: q.typeId } : {}),
      ...(search
        ? {
            OR: [
              { titre: { contains: search } },
              { description: { contains: search } },
              { num: { contains: search } },
            ],
          }
        : {}),
    };
    const [total, rows, secteurs, types] = await Promise.all([
      this.prisma.texte.count({ where }),
      this.prisma.texte.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: pageSize,
        include: { type: true, secteur: true, theme: true },
      }),
      this.prisma.secteur.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.type.findMany({ orderBy: { name: 'asc' } }),
    ]);
    const assignCounts = await this.prisma.texteSociete.groupBy({
      by: ['texteId'],
      where: { ...TS_ACTIVE, texteId: { in: rows.map((r) => r.id) } },
      _count: { _all: true },
    });
    const assignBy = new Map(
      assignCounts.map((a) => [a.texteId, a._count._all]),
    );

    return {
      items: rows.map((t) => ({
        id: t.id,
        titre: t.titre,
        num: t.num,
        journal: t.journal,
        date: t.date,
        type: t.type?.name ?? null,
        secteur: t.secteur?.name ?? null,
        theme: t.theme?.name ?? null,
        createdAt: t.createdAt,
        hasPdf: Boolean(t.tmpphoto),
        assignments: assignBy.get(t.id) ?? 0,
      })),
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
      filters: { secteurs, types },
    };
  }
}

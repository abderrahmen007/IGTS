import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { clampPage } from '../common/text-utils';
import { computeStats } from '../company/company.service';

export class AdminListQuery {
  @IsOptional() @IsString() @MaxLength(200)
  search?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  secteurId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  typeId?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(5) @Max(100)
  pageSize?: number;
}

const TS_ACTIVE: Prisma.TexteSocieteWhereInput = {
  OR: [{ deleted: false }, { deleted: null }],
  texte: { deleted: false },
};
const MAIN_COMPANY: Prisma.CompanyWhereInput = { deleted: false, multicompte: 0 };

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  private async statsByCompany(companyIds: number[]) {
    const rows = await this.prisma.texteSociete.groupBy({
      by: ['companyId', 'applicabiliteId', 'gestionetatId'],
      where: { ...TS_ACTIVE, companyId: { in: companyIds } },
      _count: { _all: true },
    });
    const by = new Map<number, { applicabiliteId: number; gestionetatId: number | null; count: number }[]>();
    for (const r of rows) {
      if (!r.companyId) continue;
      if (!by.has(r.companyId)) by.set(r.companyId, []);
      by.get(r.companyId)!.push({ ...r, count: r._count._all });
    }
    return new Map(companyIds.map((id) => [id, computeStats(by.get(id) ?? [])]));
  }

  async overview() {
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const [companies, subAccounts, texts, textsLast30, assignments, grouped, recentCompanies, recentTexts] =
      await Promise.all([
        this.prisma.company.count({ where: MAIN_COMPANY }),
        this.prisma.company.count({ where: { deleted: false, multicompte: { gt: 0 } } }),
        this.prisma.texte.count({ where: { deleted: false } }),
        this.prisma.texte.count({ where: { deleted: false, createdAt: { gte: since } } }),
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
          select: { id: true, nom: true, raisonsociale: true, email: true, createdAt: true, enabled: true },
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
    const assignBy = new Map(assignCounts.map((a) => [a.texteId, a._count._all]));

    return {
      stats: {
        companies,
        subAccounts,
        texts,
        textsLast30,
        assignments,
        compliance: computeStats(grouped.map((g) => ({ ...g, count: g._count._all }))),
      },
      recentCompanies: recentCompanies.map((c) => ({ ...c, stats: stats.get(c.id) })),
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

    const [total, rows] = await Promise.all([
      this.prisma.company.count({ where }),
      this.prisma.company.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true, nom: true, raisonsociale: true, email: true, ville: true, tel: true,
          fonction: true, createdAt: true, updatedAt: true, enabled: true,
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
      items: rows.map((c) => ({ ...c, subAccounts: subsBy.get(c.id) ?? 0, stats: stats.get(c.id) })),
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async texts(q: AdminListQuery) {
    const { page, pageSize, skip } = clampPage(q.page, q.pageSize);
    const search = q.search?.trim();
    const where: Prisma.TexteWhereInput = {
      deleted: false,
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
    const assignBy = new Map(assignCounts.map((a) => [a.texteId, a._count._all]));

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

import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { AuthUser } from '../common/auth-user';
import { clampPage, htmlToText, parseFrenchDate, toFrenchDate } from '../common/text-utils';
import {
  CreateActionDto,
  EvaluateTextDto,
  ListActionsQuery,
  ListTextsQuery,
  TextStatus,
  UpdateActionDto,
} from './company.dto';

/** Reference ids from the legacy lookup tables (see schema.prisma). */
export const APPLICABLE = 1;
export const NON_APPLICABLE = 2;
export const APPLICABILITE_NON_ANALYSEE = 3;
export const CONFORME = 1;
export const NON_CONFORME = 2;
export const INDICATIF = 3;
export const ETAT_NON_ANALYSE = 4;
export const ACTION_EN_COURS = 1;

const NOT_DELETED: Prisma.TexteSocieteWhereInput = {
  OR: [{ deleted: false }, { deleted: null }],
};

const STATUS_FILTERS: Record<TextStatus, Prisma.TexteSocieteWhereInput> = {
  'a-analyser': {
    OR: [
      { applicabiliteId: APPLICABILITE_NON_ANALYSEE },
      { applicabiliteId: APPLICABLE, gestionetatId: null },
      { applicabiliteId: APPLICABLE, gestionetatId: ETAT_NON_ANALYSE },
    ],
  },
  conforme: { applicabiliteId: APPLICABLE, gestionetatId: CONFORME },
  'non-conforme': { applicabiliteId: APPLICABLE, gestionetatId: NON_CONFORME },
  indicatif: { applicabiliteId: APPLICABLE, gestionetatId: INDICATIF },
  'non-applicable': { applicabiliteId: NON_APPLICABLE },
};

export interface ComplianceStats {
  total: number;
  applicable: number;
  nonApplicable: number;
  toAnalyse: number;
  conforme: number;
  nonConforme: number;
  indicatif: number;
  /** conforme ÷ (conforme + non conforme), in %, null when nothing evaluated */
  complianceRate: number | null;
}

/** Aggregates grouped counts into the figures shown on dashboards. */
export function computeStats(
  rows: { applicabiliteId: number; gestionetatId: number | null; count: number }[],
): ComplianceStats {
  const s: ComplianceStats = {
    total: 0, applicable: 0, nonApplicable: 0, toAnalyse: 0,
    conforme: 0, nonConforme: 0, indicatif: 0, complianceRate: null,
  };
  for (const r of rows) {
    s.total += r.count;
    if (r.applicabiliteId === NON_APPLICABLE) s.nonApplicable += r.count;
    else if (r.applicabiliteId === APPLICABILITE_NON_ANALYSEE) s.toAnalyse += r.count;
    else if (r.applicabiliteId === APPLICABLE) {
      s.applicable += r.count;
      if (r.gestionetatId === CONFORME) s.conforme += r.count;
      else if (r.gestionetatId === NON_CONFORME) s.nonConforme += r.count;
      else if (r.gestionetatId === INDICATIF) s.indicatif += r.count;
      else s.toAnalyse += r.count;
    }
  }
  const evaluated = s.conforme + s.nonConforme;
  s.complianceRate = evaluated > 0 ? Math.round((s.conforme / evaluated) * 1000) / 10 : null;
  return s;
}

@Injectable()
export class CompanyService {
  constructor(
    private prisma: PrismaService,
    private files: FilesService,
  ) {}

  private scope(user: AuthUser): Prisma.TexteSocieteWhereInput {
    return { companyId: user.ownerId!, ...NOT_DELETED, texte: { deleted: false } };
  }

  private async lookups() {
    const [secteurs, applicabilites, etats, actionStates, types] = await Promise.all([
      this.prisma.secteur.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.applicabilite.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.gestionEtat.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.gestionAction.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.type.findMany({ orderBy: { name: 'asc' } }),
    ]);
    return { secteurs, applicabilites, etats, actionStates, types };
  }

  // ─── Overview ──────────────────────────────────────────────────────

  async overview(user: AuthUser) {
    const where = this.scope(user);

    const [grouped, bySecteurRaw, recent, company, owner, openActions, unread] = await Promise.all([
      this.prisma.texteSociete.groupBy({
        by: ['applicabiliteId', 'gestionetatId'],
        where,
        _count: { _all: true },
      }),
      this.prisma.texteSociete.groupBy({
        by: ['secteurId', 'applicabiliteId', 'gestionetatId'],
        where,
        _count: { _all: true },
      }),
      this.prisma.texteSociete.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 6,
        include: { texte: { include: { type: true } }, applicabilite: true, gestionEtat: true },
      }),
      this.prisma.company.findUnique({ where: { id: user.id } }),
      this.prisma.company.findUnique({ where: { id: user.ownerId! } }),
      this.countActions(user, ACTION_EN_COURS),
      this.prisma.notification.count({
        where: { companyId: user.ownerId!, OR: [{ isRead: false }, { isRead: null }] },
      }),
    ]);

    const stats = computeStats(
      grouped.map((g) => ({ ...g, count: g._count._all })),
    );

    const secteurs = await this.prisma.secteur.findMany();
    const secteurName = new Map(secteurs.map((s) => [s.id, s.name]));
    const perSecteur = new Map<number, { applicabiliteId: number; gestionetatId: number | null; count: number }[]>();
    for (const g of bySecteurRaw) {
      const key = g.secteurId ?? 0;
      if (!perSecteur.has(key)) perSecteur.set(key, []);
      perSecteur.get(key)!.push({ ...g, count: g._count._all });
    }
    const bySecteur = [...perSecteur.entries()]
      .map(([id, rows]) => ({ id, name: secteurName.get(id) ?? 'Autres', ...computeStats(rows) }))
      .sort((a, b) => b.total - a.total);

    return {
      company: {
        nom: company?.nom,
        raisonsociale: owner?.raisonsociale ?? company?.raisonsociale,
        lastLogin: company?.updatedAt,
      },
      stats: { ...stats, openActions, unreadNotifications: unread },
      bySecteur,
      recentTexts: recent.map((ts) => this.toListItem(ts, secteurName)),
    };
  }

  // ─── Texts ─────────────────────────────────────────────────────────

  async listTexts(user: AuthUser, q: ListTextsQuery) {
    const { page, pageSize, skip } = clampPage(q.page, q.pageSize);
    const and: Prisma.TexteSocieteWhereInput[] = [this.scope(user)];

    if (q.status) and.push(STATUS_FILTERS[q.status]);
    if (q.secteurId) and.push({ secteurId: q.secteurId });
    if (q.typeId) and.push({ texte: { typeId: q.typeId } });
    const search = q.search?.trim();
    if (search) {
      and.push({
        texte: {
          OR: [
            { titre: { contains: search } },
            { description: { contains: search } },
            { num: { contains: search } },
          ],
        },
      });
    }
    const where: Prisma.TexteSocieteWhereInput = { AND: and };

    const [total, rows, secteurs] = await Promise.all([
      this.prisma.texteSociete.count({ where }),
      this.prisma.texteSociete.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: pageSize,
        include: { texte: { include: { type: true } }, applicabilite: true, gestionEtat: true },
      }),
      this.prisma.secteur.findMany(),
    ]);

    const actionCounts = await this.prisma.plusaction.groupBy({
      by: ['texteSocieteId'],
      where: { texteSocieteId: { in: rows.map((r) => r.id) } },
      _count: { _all: true },
    });
    const actionsBy = new Map(actionCounts.map((a) => [a.texteSocieteId, a._count._all]));
    const secteurName = new Map(secteurs.map((s) => [s.id, s.name]));

    return {
      items: rows.map((ts) => ({
        ...this.toListItem(ts, secteurName),
        actionsCount: actionsBy.get(ts.id) ?? 0,
      })),
      total,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async filters(user: AuthUser) {
    const [lk, secteurCounts] = await Promise.all([
      this.lookups(),
      this.prisma.texteSociete.groupBy({
        by: ['secteurId'],
        where: this.scope(user),
        _count: { _all: true },
      }),
    ]);
    const used = new Map(secteurCounts.map((s) => [s.secteurId, s._count._all]));
    return {
      secteurs: lk.secteurs
        .filter((s) => used.has(s.id))
        .map((s) => ({ id: s.id, name: s.name, count: used.get(s.id) })),
      types: lk.types,
      applicabilites: lk.applicabilites,
      etats: lk.etats,
      actionStates: lk.actionStates,
    };
  }

  private async findOwned(user: AuthUser, id: number) {
    const ts = await this.prisma.texteSociete.findFirst({
      where: { id, ...this.scope(user) },
      include: {
        texte: { include: { type: true, theme: true, secteur: true } },
        applicabilite: true,
        gestionEtat: true,
      },
    });
    if (!ts || !ts.texte) throw new NotFoundException('Texte introuvable');
    return ts;
  }

  async textDetail(user: AuthUser, id: number) {
    const ts = await this.findOwned(user, id);
    const [history, actions, lk] = await Promise.all([
      this.prisma.historiqueEtat.findMany({
        where: { texteSocieteId: ts.id },
        orderBy: [{ datequifairetat: 'desc' }, { id: 'desc' }],
        take: 50,
      }),
      this.prisma.plusaction.findMany({
        where: { texteSocieteId: ts.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.lookups(),
    ]);
    const etatName = new Map(lk.etats.map((e) => [e.id, e.name]));
    const applName = new Map(lk.applicabilites.map((a) => [a.id, a.name]));
    const actionName = new Map(lk.actionStates.map((a) => [a.id, a.name]));
    const secteur = ts.secteurId
      ? lk.secteurs.find((s) => s.id === ts.secteurId)
      : ts.texte!.secteur;
    const t = ts.texte!;

    return {
      id: ts.id,
      texte: {
        id: t.id,
        titre: t.titre,
        num: t.num,
        journal: t.journal,
        date: t.date,
        description: t.description,
        type: t.type ? { id: t.type.id, name: t.type.name } : null,
        theme: t.theme ? { id: t.theme.id, name: t.theme.name } : null,
        secteur: secteur ? { id: secteur.id, name: secteur.name } : null,
        pdfUrl: this.files.pdfUrl(t.tmpphoto),
        addedAt: t.createdAt,
      },
      assignedAt: ts.createdAt,
      applicabilite: { id: ts.applicabilite.id, name: ts.applicabilite.name },
      etat: ts.gestionEtat ? { id: ts.gestionEtat.id, name: ts.gestionEtat.name } : null,
      comment: ts.comment,
      evaluatedAt: ts.datequifairetat,
      evaluatedBy: ts.quifairetat,
      history: history.map((h) => ({
        id: h.id,
        date: h.datequifairetat ?? h.createdAt,
        by: h.quifairetat,
        etat: h.gestionetatId ? etatName.get(h.gestionetatId) ?? null : null,
        applicabilite: h.applicabiliteId ? applName.get(h.applicabiliteId) ?? null : null,
      })),
      actions: actions.map((a) => this.toAction(a, actionName)),
      options: {
        applicabilites: lk.applicabilites,
        etats: lk.etats,
        actionStates: lk.actionStates,
      },
    };
  }

  async evaluate(user: AuthUser, id: number, dto: EvaluateTextDto) {
    const ts = await this.findOwned(user, id);
    const gestionetatId = dto.applicabiliteId === APPLICABLE ? (dto.gestionetatId ?? null) : null;
    const today = new Date();

    await this.prisma.$transaction([
      this.prisma.texteSociete.update({
        where: { id: ts.id },
        data: {
          applicabiliteId: dto.applicabiliteId,
          gestionetatId,
          comment: dto.comment !== undefined ? dto.comment.trim() || null : undefined,
          quifairetat: user.nom,
          datequifairetat: today,
        },
      }),
      this.prisma.historiqueEtat.create({
        data: {
          companyId: user.id,
          multicompte: user.ownerId !== user.id ? user.ownerId : 0,
          texteId: ts.texteId,
          texteSocieteId: ts.id,
          gestionetatId,
          applicabiliteId: dto.applicabiliteId,
          quifairetat: user.nom,
          datequifairetat: today,
          createdAt: today,
        },
      }),
    ]);
    return this.textDetail(user, id);
  }

  // ─── Action plans ──────────────────────────────────────────────────

  private toAction(
    a: Prisma.PlusactionGetPayload<object>,
    actionName: Map<number, string | null>,
  ) {
    const eff = a.courrielResponsable != null ? parseInt(a.courrielResponsable, 10) : NaN;
    return {
      id: a.id,
      texteSocieteId: a.texteSocieteId,
      description: htmlToText(a.libelleAction),
      responsable: a.responsableAction,
      telephone: a.telephoneResponsable,
      delai: a.echeant,
      dateOuverture: parseFrenchDate(a.dateouverture),
      dateCloture: parseFrenchDate(a.cloture),
      effectivite: Number.isFinite(eff) ? eff : null,
      status: a.gestionactionId
        ? { id: a.gestionactionId, name: actionName.get(a.gestionactionId) ?? null }
        : null,
      createdAt: a.createdAt,
      createdBy: a.quifairaction,
    };
  }

  private async ownedTexteSocieteIds(user: AuthUser) {
    const rows = await this.prisma.texteSociete.findMany({
      where: this.scope(user),
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  private async countActions(user: AuthUser, gestionactionId?: number) {
    const ids = await this.ownedTexteSocieteIds(user);
    return this.prisma.plusaction.count({
      where: { texteSocieteId: { in: ids }, ...(gestionactionId ? { gestionactionId } : {}) },
    });
  }

  async listActions(user: AuthUser, q: ListActionsQuery) {
    const ids = await this.ownedTexteSocieteIds(user);
    const [actions, lk, counts] = await Promise.all([
      this.prisma.plusaction.findMany({
        where: {
          texteSocieteId: { in: ids },
          ...(q.gestionactionId ? { gestionactionId: q.gestionactionId } : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 200,
      }),
      this.lookups(),
      this.prisma.plusaction.groupBy({
        by: ['gestionactionId'],
        where: { texteSocieteId: { in: ids } },
        _count: { _all: true },
      }),
    ]);
    const actionName = new Map(lk.actionStates.map((a) => [a.id, a.name]));

    const textes = await this.prisma.texteSociete.findMany({
      where: { id: { in: [...new Set(actions.map((a) => a.texteSocieteId!).filter(Boolean))] } },
      select: { id: true, texte: { select: { titre: true } } },
    });
    const titreBy = new Map(textes.map((t) => [t.id, t.texte?.titre ?? '']));

    return {
      items: actions.map((a) => ({
        ...this.toAction(a, actionName),
        texteTitre: a.texteSocieteId ? titreBy.get(a.texteSocieteId) ?? '' : '',
      })),
      counts: {
        total: counts.reduce((n, c) => n + c._count._all, 0),
        byStatus: counts.map((c) => ({
          id: c.gestionactionId,
          name: c.gestionactionId ? actionName.get(c.gestionactionId) ?? null : null,
          count: c._count._all,
        })),
      },
      actionStates: lk.actionStates,
    };
  }

  async createAction(user: AuthUser, texteSocieteId: number, dto: CreateActionDto) {
    const ts = await this.findOwned(user, texteSocieteId);
    const today = new Date();
    const numaction = String(
      (await this.prisma.plusaction.count({ where: { texteSocieteId: ts.id } })) + 1,
    );
    const common = {
      companyId: user.id,
      texteId: ts.texteId,
      multicompte: user.ownerId !== user.id ? user.ownerId : 0,
      texteSocieteId: ts.id,
      gestionactionId: ACTION_EN_COURS,
      gestionetatId: ts.gestionetatId,
      quifairaction: user.nom,
      datequifairaction: today,
      libelleAction: dto.description.trim(),
      responsableAction: dto.responsable?.trim() || null,
      telephoneResponsable: dto.telephone?.trim() || null,
      courrielResponsable: '0',
      echeant: dto.delai?.trim() || null,
      dateouverture: toFrenchDate(dto.dateOuverture) ?? toFrenchDate(today.toISOString()),
      cloture: toFrenchDate(dto.dateCloture),
      numaction,
    };

    const created = await this.prisma.plusaction.create({
      data: { ...common, createdAt: today, secteurId: ts.secteurId, themeId: ts.themeId },
    });
    await this.prisma.historiqueAction.create({
      data: { ...common, createdAt: today, plusactionId: created.id },
    });
    return this.textDetail(user, texteSocieteId);
  }

  async updateAction(user: AuthUser, actionId: number, dto: UpdateActionDto) {
    const action = await this.prisma.plusaction.findUnique({ where: { id: actionId } });
    if (!action?.texteSocieteId) throw new NotFoundException('Action introuvable');
    await this.findOwned(user, action.texteSocieteId); // ownership check

    await this.prisma.plusaction.update({
      where: { id: actionId },
      data: {
        gestionactionId: dto.gestionactionId ?? undefined,
        courrielResponsable: dto.effectivite !== undefined ? String(dto.effectivite) : undefined,
        cloture: dto.dateCloture !== undefined ? toFrenchDate(dto.dateCloture) : undefined,
        quifairaction: user.nom,
        datequifairaction: new Date(),
      },
    });
    return this.textDetail(user, action.texteSocieteId);
  }

  // ─── Notifications ─────────────────────────────────────────────────

  async notifications(user: AuthUser) {
    const where = { companyId: user.ownerId! };
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 15,
      }),
      this.prisma.notification.count({
        where: { ...where, OR: [{ isRead: false }, { isRead: null }] },
      }),
    ]);
    const textes = await this.prisma.texte.findMany({
      where: { id: { in: items.map((n) => n.texteId!).filter(Boolean) } },
      select: { id: true, titre: true },
    });
    const titre = new Map(textes.map((t) => [t.id, t.titre]));
    return {
      unread,
      items: items.map((n) => ({
        id: n.id,
        message: n.message,
        texteTitre: n.texteId ? titre.get(n.texteId) ?? null : null,
        texteSocieteId: n.texteSocieteId,
        createdAt: n.createdAt,
        read: n.isRead === true,
      })),
    };
  }

  async markNotificationsRead(user: AuthUser) {
    const { count } = await this.prisma.notification.updateMany({
      where: { companyId: user.ownerId!, OR: [{ isRead: false }, { isRead: null }] },
      data: { isRead: true, etat: 'lu' },
    });
    return { updated: count };
  }

  // ─── Mapping ───────────────────────────────────────────────────────

  private toListItem(
    ts: Prisma.TexteSocieteGetPayload<{
      include: { texte: { include: { type: true } }; applicabilite: true; gestionEtat: true };
    }>,
    secteurName: Map<number, string>,
  ) {
    const t = ts.texte!;
    return {
      id: ts.id,
      texteId: t.id,
      titre: t.titre,
      num: t.num,
      journal: t.journal,
      date: t.date,
      excerpt: t.description.slice(0, 240),
      type: t.type ? { id: t.type.id, name: t.type.name } : null,
      secteur: ts.secteurId ? { id: ts.secteurId, name: secteurName.get(ts.secteurId) ?? '' } : null,
      applicabilite: { id: ts.applicabilite.id, name: ts.applicabilite.name },
      etat: ts.gestionEtat ? { id: ts.gestionEtat.id, name: ts.gestionEtat.name } : null,
      assignedAt: ts.createdAt,
      evaluatedAt: ts.datequifairetat,
      evaluatedBy: ts.quifairetat,
    };
  }
}

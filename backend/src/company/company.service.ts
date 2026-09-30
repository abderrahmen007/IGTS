import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Plusaction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FilesService, UploadedFile, joinFiles, splitFiles } from '../files/files.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PreferencesService } from '../preferences/preferences.service';
import { AuthUser, canEditFromRights } from '../common/auth-user';
import { hashPassword, verifyPassword } from '../common/password';
import { clampPage, htmlToText, parseFrenchDate, toFrenchDate } from '../common/text-utils';
import {
  ACTION_EFFICACE,
  ACTION_EN_COURS,
  APPLICABILITE_NON_ANALYSEE,
  APPLICABLE,
  CONFORME,
  ETAT_NON_ANALYSE,
  EvaluationState,
  INDICATIF,
  LIVE_ACTIONS_TEXT,
  NON_APPLICABLE,
  NON_CONFORME,
  OPEN_ACTION_STATES,
  actionBlockReason,
  actionsAllowed,
  daysUntil,
  normaliseEvaluation,
  suggestsCompliance,
} from './rules';
import {
  ChangePasswordDto,
  CreateActionDto,
  EvaluateTextDto,
  ListActionsQuery,
  ListTextsQuery,
  PreferencesDto,
  TextStatus,
  UpdateActionDto,
  UpdateProfileDto,
} from './company.dto';

// Kept for the modules that import them from here
export {
  APPLICABLE,
  NON_APPLICABLE,
  APPLICABILITE_NON_ANALYSEE,
  CONFORME,
  NON_CONFORME,
  INDICATIF,
  ETAT_NON_ANALYSE,
  ACTION_EN_COURS,
} from './rules';

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

/** A text changed by IGTS after the company's last evaluation (dates of evaluation have no time). */
function updatedSince(texteUpdatedAt: Date | null, evaluatedOn: Date | null): boolean {
  if (!texteUpdatedAt || !evaluatedOn) return false;
  return texteUpdatedAt.getTime() > evaluatedOn.getTime() + 86_400_000;
}

const TEXT_INCLUDE = {
  texte: { include: { type: true } },
  applicabilite: true,
  gestionEtat: true,
} satisfies Prisma.TexteSocieteInclude;

@Injectable()
export class CompanyService {
  constructor(
    private prisma: PrismaService,
    private files: FilesService,
    private notifier: NotificationsService,
    private prefs: PreferencesService,
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

  /** Texts of the company whose actions count (see LIVE_ACTIONS_TEXT). */
  private async liveTexts(user: AuthUser) {
    return this.prisma.texteSociete.findMany({
      where: { ...this.scope(user), ...LIVE_ACTIONS_TEXT },
      select: {
        id: true,
        applicabiliteId: true,
        gestionetatId: true,
        secteurId: true,
        themeId: true,
        texte: { select: { titre: true, num: true, type: { select: { name: true } } } },
      },
    });
  }

  private async themeNames(ids: (number | null)[]) {
    const wanted = [...new Set(ids.filter((i): i is number => !!i))];
    if (!wanted.length) return new Map<number, string>();
    const rows = await this.prisma.theme.findMany({ where: { id: { in: wanted } }, select: { id: true, name: true } });
    return new Map(rows.map((t) => [t.id, t.name ?? '']));
  }

  // ─── Overview ──────────────────────────────────────────────────────

  async overview(user: AuthUser) {
    const where = this.scope(user);

    const [grouped, bySecteurRaw, recent, company, owner, unread, live, next, nonConformes, secteurs] =
      await Promise.all([
        this.prisma.texteSociete.groupBy({ by: ['applicabiliteId', 'gestionetatId'], where, _count: { _all: true } }),
        this.prisma.texteSociete.groupBy({
          by: ['secteurId', 'applicabiliteId', 'gestionetatId'],
          where,
          _count: { _all: true },
        }),
        this.prisma.texteSociete.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 6,
          include: TEXT_INCLUDE,
        }),
        this.prisma.company.findUnique({ where: { id: user.id } }),
        this.prisma.company.findUnique({ where: { id: user.ownerId! } }),
        this.prisma.notification.count({
          where: { companyId: user.ownerId!, OR: [{ isRead: false }, { isRead: null }] },
        }),
        this.liveTexts(user),
        this.prisma.texteSociete.findMany({
          where: { AND: [where, STATUS_FILTERS['a-analyser']] },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 3,
          include: TEXT_INCLUDE,
        }),
        this.prisma.texteSociete.findMany({
          where: { ...where, applicabiliteId: APPLICABLE, gestionetatId: NON_CONFORME },
          select: { id: true },
        }),
        this.prisma.secteur.findMany(),
      ]);

    const stats = computeStats(grouped.map((g) => ({ ...g, count: g._count._all })));
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

    // Action plan figures only count "live" actions (texts that still call for action)
    const liveById = new Map(live.map((t) => [t.id, t]));
    const actions = await this.prisma.plusaction.findMany({
      where: { texteSocieteId: { in: [...liveById.keys()] } },
    });
    const today = new Date();
    const open = actions
      .filter((a) => OPEN_ACTION_STATES.includes(a.gestionactionId ?? 0))
      .map((a) => ({ a, dueIn: daysUntil(a.cloture, today) }));
    const withAction = new Set(actions.map((a) => a.texteSocieteId));
    const themes = await this.themeNames(open.map((o) => liveById.get(o.a.texteSocieteId!)?.themeId ?? null));

    const upcoming = [...open]
      .sort((x, y) => (x.dueIn ?? 1e9) - (y.dueIn ?? 1e9))
      .slice(0, 4)
      .map(({ a, dueIn }) => {
        const t = liveById.get(a.texteSocieteId!);
        return {
          id: a.id,
          texteSocieteId: a.texteSocieteId,
          description: htmlToText(a.libelleAction),
          responsable: a.responsableAction,
          dateCloture: parseFrenchDate(a.cloture),
          dueIn,
          texteTitre: t?.texte?.titre ?? '',
          theme: t?.themeId ? themes.get(t.themeId) ?? null : null,
        };
      });

    return {
      company: {
        nom: company?.nom,
        raisonsociale: owner?.raisonsociale ?? company?.raisonsociale,
        lastLogin: company?.updatedAt,
      },
      me: { nom: user.nom, canEdit: user.canEdit },
      stats: {
        ...stats,
        openActions: open.length,
        overdueActions: open.filter((o) => o.dueIn !== null && o.dueIn < 0).length,
        nonConformeSansAction: nonConformes.filter((n) => !withAction.has(n.id)).length,
        unreadNotifications: unread,
      },
      bySecteur,
      recentTexts: recent.map((ts) => this.toListItem(ts, secteurName)),
      nextToEvaluate: next.map((ts) => this.toListItem(ts, secteurName)),
      upcomingActions: upcoming,
    };
  }

  /** Small counters for the navigation badges. */
  async counters(user: AuthUser) {
    const o = await this.overview(user);
    return {
      toEvaluate: o.stats.toAnalyse,
      overdueActions: o.stats.overdueActions,
      openActions: o.stats.openActions,
      unreadNotifications: o.stats.unreadNotifications,
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
        include: TEXT_INCLUDE,
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
    const blockReason = actionBlockReason(ts);

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
        updatedAt: t.updatedAt,
      },
      assignedAt: ts.createdAt,
      applicabilite: { id: ts.applicabilite.id, name: ts.applicabilite.name },
      etat: ts.gestionEtat ? { id: ts.gestionEtat.id, name: ts.gestionEtat.name } : null,
      comment: ts.comment,
      evaluatedAt: ts.datequifairetat,
      evaluatedBy: ts.quifairetat,
      updatedSinceEvaluation: updatedSince(t.updatedAt, ts.datequifairetat),
      permissions: {
        canEdit: user.canEdit,
        actionsAllowed: blockReason === null,
        actionBlockReason: blockReason,
      },
      suggestCompliance: suggestsCompliance(ts, actions.map((a) => a.gestionactionId)),
      history: history.map((h) => ({
        id: h.id,
        date: h.datequifairetat ?? h.createdAt,
        by: h.quifairetat,
        etat: h.gestionetatId ? etatName.get(h.gestionetatId) ?? null : null,
        applicabilite: h.applicabiliteId ? applName.get(h.applicabiliteId) ?? null : null,
      })),
      actions: actions.map((a) => ({ ...this.toAction(a, actionName), onHold: blockReason !== null })),
      options: {
        applicabilites: lk.applicabilites,
        etats: lk.etats,
        actionStates: lk.actionStates,
      },
    };
  }

  async evaluate(user: AuthUser, id: number, dto: EvaluateTextDto) {
    const ts = await this.findOwned(user, id);
    const next = normaliseEvaluation(dto.applicabiliteId, dto.gestionetatId);

    // Leaving a situation that calls for action puts the open actions on hold:
    // the company must confirm it knowingly (nothing is deleted).
    if (actionsAllowed(ts) && !actionsAllowed(next) && !dto.confirmHoldActions) {
      const openActions = await this.prisma.plusaction.count({
        where: { texteSocieteId: ts.id, gestionactionId: { in: OPEN_ACTION_STATES } },
      });
      if (openActions > 0) {
        throw new ConflictException({
          statusCode: 409,
          code: 'OPEN_ACTIONS',
          openActions,
          message:
            openActions === 1
              ? 'Une action est en cours sur ce texte. Elle sera mise en pause : elle ne comptera plus et n’enverra plus de rappel. Elle reviendra si vous changez d’avis.'
              : `${openActions} actions sont en cours sur ce texte. Elles seront mises en pause : elles ne compteront plus et n’enverront plus de rappels. Elles reviendront si vous changez d’avis.`,
        });
      }
    }

    const today = new Date();
    await this.prisma.$transaction([
      this.prisma.texteSociete.update({
        where: { id: ts.id },
        data: {
          applicabiliteId: next.applicabiliteId!,
          gestionetatId: next.gestionetatId,
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
          gestionetatId: next.gestionetatId,
          applicabiliteId: next.applicabiliteId,
          quifairetat: user.nom,
          datequifairetat: today,
          createdAt: today,
        },
      }),
    ]);
    this.notifier.refresh(user.ownerId!);
    return this.textDetail(user, id);
  }

  // ─── Action plans ──────────────────────────────────────────────────

  private toAction(a: Plusaction, actionName: Map<number, string | null>) {
    const eff = a.courrielResponsable != null ? parseInt(a.courrielResponsable, 10) : NaN;
    return {
      id: a.id,
      texteSocieteId: a.texteSocieteId,
      number: a.numaction,
      description: htmlToText(a.libelleAction),
      responsable: a.responsableAction,
      telephone: a.telephoneResponsable,
      delai: a.echeant,
      dateOuverture: parseFrenchDate(a.dateouverture),
      dateCloture: parseFrenchDate(a.cloture),
      dueIn: daysUntil(a.cloture),
      effectivite: Number.isFinite(eff) ? eff : null,
      status: a.gestionactionId
        ? { id: a.gestionactionId, name: actionName.get(a.gestionactionId) ?? null }
        : null,
      files: splitFiles(a.tmpphoto).map((name) => ({ name, url: this.files.proofUrl(name) })),
      createdAt: a.createdAt,
      createdBy: a.quifairaction,
      updatedAt: a.datequifairaction,
    };
  }

  /** Loads an action of the caller's company and checks that its text allows actions. */
  private async ownedAction(user: AuthUser, actionId: number) {
    const action = await this.prisma.plusaction.findUnique({ where: { id: actionId } });
    if (!action?.texteSocieteId) throw new NotFoundException('Action introuvable');
    const ts = await this.findOwned(user, action.texteSocieteId);
    const reason = actionBlockReason(ts);
    if (reason) throw new ForbiddenException(reason);
    return { action, ts };
  }

  private historyRow(user: AuthUser, a: Plusaction) {
    return {
      companyId: user.id,
      texteId: a.texteId,
      multicompte: user.ownerId !== user.id ? user.ownerId : 0,
      texteSocieteId: a.texteSocieteId,
      gestionactionId: a.gestionactionId,
      gestionetatId: a.gestionetatId,
      quifairaction: user.nom,
      datequifairaction: new Date(),
      libelleAction: a.libelleAction,
      responsableAction: a.responsableAction,
      telephoneResponsable: a.telephoneResponsable,
      courrielResponsable: a.courrielResponsable,
      echeant: a.echeant,
      tmpphoto: a.tmpphoto,
      dateouverture: a.dateouverture,
      cloture: a.cloture,
      numaction: a.numaction,
      createdAt: new Date(),
      plusactionId: a.id,
    };
  }

  async listActions(user: AuthUser, q: ListActionsQuery) {
    const [live, lk, all] = await Promise.all([
      this.liveTexts(user),
      this.lookups(),
      this.prisma.texteSociete.findMany({ where: this.scope(user), select: { id: true } }),
    ]);
    const liveById = new Map(live.map((t) => [t.id, t]));
    const liveIds = [...liveById.keys()];
    const onHoldIds = all.map((r) => r.id).filter((id) => !liveById.has(id));

    const [actions, onHold] = await Promise.all([
      this.prisma.plusaction.findMany({
        where: {
          texteSocieteId: { in: liveIds },
          ...(q.gestionactionId ? { gestionactionId: q.gestionactionId } : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 500,
      }),
      this.prisma.plusaction.count({
        where: { texteSocieteId: { in: onHoldIds }, gestionactionId: { in: OPEN_ACTION_STATES } },
      }),
    ]);
    const actionName = new Map(lk.actionStates.map((a) => [a.id, a.name]));
    const secteurName = new Map(lk.secteurs.map((s) => [s.id, s.name]));
    const themes = await this.themeNames(live.map((t) => t.themeId));

    const statesByText = new Map<number, (number | null)[]>();
    for (const a of actions) {
      if (!statesByText.has(a.texteSocieteId!)) statesByText.set(a.texteSocieteId!, []);
      statesByText.get(a.texteSocieteId!)!.push(a.gestionactionId);
    }
    const readyForCompliance = live
      .filter((t) => suggestsCompliance(t as EvaluationState, statesByText.get(t.id) ?? []))
      .map((t) => ({ texteSocieteId: t.id, titre: t.texte?.titre ?? '' }));

    const items = actions.map((a) => {
      const t = liveById.get(a.texteSocieteId!);
      return {
        ...this.toAction(a, actionName),
        texte: {
          titre: t?.texte?.titre ?? '',
          num: t?.texte?.num ?? '',
          type: t?.texte?.type?.name ?? null,
          secteur: t?.secteurId ? secteurName.get(t.secteurId) ?? null : null,
          theme: t?.themeId ? themes.get(t.themeId) ?? null : null,
          compliant: t?.gestionetatId === CONFORME,
        },
      };
    });
    const openItems = items.filter((i) => OPEN_ACTION_STATES.includes(i.status?.id ?? 0));

    return {
      items,
      counts: {
        total: items.length,
        open: openItems.length,
        overdue: openItems.filter((i) => i.dueIn !== null && i.dueIn < 0).length,
        onHold,
        byStatus: lk.actionStates.map((s) => ({
          id: s.id,
          name: s.name,
          count: items.filter((i) => i.status?.id === s.id).length,
        })),
        averageProgress: openItems.length
          ? Math.round(openItems.reduce((n, i) => n + (i.effectivite ?? 0), 0) / openItems.length)
          : null,
      },
      readyForCompliance,
      actionStates: lk.actionStates,
      canEdit: user.canEdit,
    };
  }

  async createAction(user: AuthUser, texteSocieteId: number, dto: CreateActionDto) {
    const ts = await this.findOwned(user, texteSocieteId);
    const reason = actionBlockReason(ts);
    if (reason) throw new ForbiddenException(reason);

    const today = new Date();
    const status = dto.gestionactionId ?? ACTION_EN_COURS;
    const progress = dto.effectivite ?? (status === ACTION_EFFICACE ? 100 : 0);
    const numaction = String(
      (await this.prisma.plusaction.count({ where: { texteSocieteId: ts.id } })) + 1,
    );

    const created = await this.prisma.plusaction.create({
      data: {
        companyId: user.id,
        texteId: ts.texteId,
        multicompte: user.ownerId !== user.id ? user.ownerId : 0,
        texteSocieteId: ts.id,
        gestionactionId: status,
        gestionetatId: ts.gestionetatId,
        quifairaction: user.nom,
        datequifairaction: today,
        libelleAction: dto.description.trim(),
        responsableAction: dto.responsable?.trim() || null,
        telephoneResponsable: dto.telephone?.trim() || null,
        courrielResponsable: String(progress),
        echeant: dto.delai?.trim() || null,
        dateouverture: toFrenchDate(dto.dateOuverture) ?? toFrenchDate(today.toISOString()),
        cloture: toFrenchDate(dto.dateCloture),
        numaction,
        createdAt: today,
        secteurId: ts.secteurId,
        themeId: ts.themeId,
      },
    });
    await this.prisma.historiqueAction.create({ data: this.historyRow(user, created) });
    this.notifier.refresh(user.ownerId!);
    return this.textDetail(user, texteSocieteId);
  }

  async updateAction(user: AuthUser, actionId: number, dto: UpdateActionDto) {
    const { action } = await this.ownedAction(user, actionId);
    const progress =
      dto.effectivite !== undefined
        ? dto.effectivite
        : dto.gestionactionId === ACTION_EFFICACE
          ? 100
          : undefined;

    const updated = await this.prisma.plusaction.update({
      where: { id: actionId },
      data: {
        libelleAction: dto.description !== undefined ? dto.description.trim() : undefined,
        responsableAction: dto.responsable !== undefined ? dto.responsable.trim() || null : undefined,
        telephoneResponsable: dto.telephone !== undefined ? dto.telephone.trim() || null : undefined,
        echeant: dto.delai !== undefined ? dto.delai.trim() || null : undefined,
        dateouverture: dto.dateOuverture !== undefined ? toFrenchDate(dto.dateOuverture) : undefined,
        cloture: dto.dateCloture !== undefined ? toFrenchDate(dto.dateCloture ?? undefined) : undefined,
        gestionactionId: dto.gestionactionId ?? undefined,
        courrielResponsable: progress !== undefined ? String(progress) : undefined,
        quifairaction: user.nom,
        datequifairaction: new Date(),
      },
    });
    await this.prisma.historiqueAction.create({ data: this.historyRow(user, updated) });
    this.notifier.refresh(user.ownerId!);
    return this.textDetail(user, action.texteSocieteId!);
  }

  async deleteAction(user: AuthUser, actionId: number) {
    const { action } = await this.ownedAction(user, actionId);
    await this.prisma.$transaction([
      this.prisma.historiqueAction.deleteMany({ where: { plusactionId: action.id } }),
      this.prisma.plusaction.delete({ where: { id: action.id } }),
    ]);
    this.notifier.refresh(user.ownerId!);
    return this.textDetail(user, action.texteSocieteId!);
  }

  async addActionFiles(user: AuthUser, actionId: number, uploads: UploadedFile[]) {
    if (!uploads?.length) throw new BadRequestException('Aucun fichier reçu');
    const { action } = await this.ownedAction(user, actionId);
    const names: string[] = [];
    for (const f of uploads) names.push(await this.files.saveProof(f));
    const updated = await this.prisma.plusaction.update({
      where: { id: action.id },
      data: { tmpphoto: joinFiles([...splitFiles(action.tmpphoto), ...names]) },
    });
    await this.prisma.historiqueAction.create({ data: this.historyRow(user, updated) });
    return this.textDetail(user, action.texteSocieteId!);
  }

  async removeActionFile(user: AuthUser, actionId: number, name: string) {
    const { action } = await this.ownedAction(user, actionId);
    const current = splitFiles(action.tmpphoto);
    if (!current.includes(name)) throw new NotFoundException('Fichier introuvable');
    await this.prisma.plusaction.update({
      where: { id: action.id },
      data: { tmpphoto: joinFiles(current.filter((n) => n !== name)) },
    });
    await this.files.removeProof(name);
    return this.textDetail(user, action.texteSocieteId!);
  }

  // ─── Profile & team ────────────────────────────────────────────────

  async profile(user: AuthUser) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [me, owner, evaluatedThisMonth, openActionsCreated, subscriptions] = await Promise.all([
      this.prisma.company.findUnique({
        where: { id: user.id },
        select: { id: true, nom: true, email: true, fonction: true, tel: true, multicompte: true, createdAt: true },
      }),
      this.prisma.company.findUnique({
        where: { id: user.ownerId! },
        select: { raisonsociale: true, nom: true },
      }),
      this.prisma.historiqueEtat.count({
        where: { companyId: user.id, datequifairetat: { gte: monthStart } },
      }),
      this.prisma.plusaction.count({
        where: { companyId: user.id, gestionactionId: { in: OPEN_ACTION_STATES } },
      }),
      this.prisma.companySecteurTheme.findMany({
        where: { companyId: user.ownerId! },
        select: { secteur: { select: { id: true, name: true } } },
      }),
    ]);
    if (!me) throw new NotFoundException('Compte introuvable');

    const secteurs = new Map<number, string>();
    for (const s of subscriptions) if (s.secteur) secteurs.set(s.secteur.id, s.secteur.name ?? '');

    return {
      id: me.id,
      nom: me.nom,
      email: me.email,
      fonction: me.fonction,
      tel: me.tel,
      company: owner?.raisonsociale || owner?.nom || '',
      isSubAccount: me.multicompte > 0,
      canEdit: user.canEdit,
      memberSince: me.createdAt,
      stats: { evaluatedThisMonth, openActionsCreated },
      secteurs: [...secteurs.entries()].map(([id, name]) => ({ id, name })),
      preferences: this.prefs.get(user.id),
    };
  }

  async updateProfile(user: AuthUser, dto: UpdateProfileDto) {
    await this.prisma.company.update({
      where: { id: user.id },
      data: {
        nom: dto.nom.trim(),
        fonction: dto.fonction !== undefined ? dto.fonction.trim() || null : undefined,
        tel: dto.tel !== undefined ? dto.tel.trim() || null : undefined,
        updatedAt: new Date(),
      },
    });
    return this.profile(user);
  }

  async changePassword(user: AuthUser, dto: ChangePasswordDto) {
    const me = await this.prisma.company.findUnique({ where: { id: user.id }, select: { password: true } });
    if (!me || !(await verifyPassword(me.password, dto.current))) {
      throw new BadRequestException('Le mot de passe actuel est incorrect.');
    }
    if (dto.current === dto.next) {
      throw new BadRequestException('Le nouveau mot de passe doit être différent de l’actuel.');
    }
    await this.prisma.company.update({
      where: { id: user.id },
      data: { password: await hashPassword(dto.next), updatedAt: new Date() },
    });
    return { ok: true };
  }

  async updatePreferences(user: AuthUser, dto: PreferencesDto) {
    const { tourSeen, ...rest } = dto;
    return this.prefs.update(user.id, {
      ...rest,
      ...(tourSeen !== undefined ? { tourSeenAt: tourSeen ? new Date().toISOString() : null } : {}),
    });
  }

  async team(user: AuthUser) {
    const accounts = await this.prisma.company.findMany({
      where: { OR: [{ id: user.ownerId! }, { multicompte: user.ownerId! }], deleted: false },
      select: {
        id: true, nom: true, email: true, fonction: true, multicompte: true,
        droitacceeId: true, activated: true, createdAt: true,
      },
      orderBy: [{ multicompte: 'asc' }, { nom: 'asc' }],
    });
    return {
      members: accounts.map((a) => ({
        id: a.id,
        nom: a.nom,
        email: a.email,
        fonction: a.fonction,
        isMain: a.multicompte <= 0,
        canEdit: canEditFromRights(a.multicompte, a.droitacceeId),
        active: a.activated,
        isMe: a.id === user.id,
        since: a.createdAt,
      })),
    };
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
    this.notifier.refresh(user.ownerId!);
    return { updated: count };
  }

  // ─── Mapping ───────────────────────────────────────────────────────

  private toListItem(
    ts: Prisma.TexteSocieteGetPayload<{ include: typeof TEXT_INCLUDE }>,
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
      updatedSinceEvaluation: updatedSince(t.updatedAt, ts.datequifairetat),
    };
  }
}

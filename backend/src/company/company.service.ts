import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Plusaction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FilesService, UploadedFile, joinFiles, splitFiles } from '../files/files.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PreferencesService } from '../preferences/preferences.service';
import { AuthUser, canEditFromRights, isMainAccount } from '../common/auth-user';
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
  private readonly logger = new Logger(CompanyService.name);

  constructor(
    private prisma: PrismaService,
    private files: FilesService,
    private notifier: NotificationsService,
    private prefs: PreferencesService,
    private config: ConfigService,
  ) {}

  private get genAI(): GoogleGenerativeAI | null {
    const key = this.config.get<string>('GEMINI_API_KEY')?.trim();
    return key ? new GoogleGenerativeAI(key) : null;
  }

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
        this.prisma.notification.count({ where: this.unreadWhere(user) }),
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

  /**
   * Figures of the « Statistiques » tab of the action plan. Only actions on
   * texts that still need them are counted (see LIVE_ACTIONS_TEXT).
   */
  async actionStats(user: AuthUser) {
    const [live, lk] = await Promise.all([this.liveTexts(user), this.lookups()]);
    const liveById = new Map(live.map((t) => [t.id, t]));
    const actions = await this.prisma.plusaction.findMany({
      where: { texteSocieteId: { in: [...liveById.keys()] } },
    });
    // When an action became "Efficace": first history row with that status
    const history = await this.prisma.historiqueAction.findMany({
      where: { plusactionId: { in: actions.map((a) => a.id) }, gestionactionId: ACTION_EFFICACE },
      select: { plusactionId: true, createdAt: true, datequifairaction: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    const effectiveAt = new Map<number, Date>();
    for (const h of history) {
      const at = h.createdAt ?? h.datequifairaction;
      if (h.plusactionId && at && !effectiveAt.has(h.plusactionId)) effectiveAt.set(h.plusactionId, at);
    }
    const secteurName = new Map(lk.secteurs.map((s) => [s.id, s.name ?? '']));
    const isoDate = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00`) : null);

    const rows = actions.map((a) => {
      const status = a.gestionactionId ?? ACTION_EN_COURS;
      const open = OPEN_ACTION_STATES.includes(status);
      const done = status === ACTION_EFFICACE;
      const eff = a.courrielResponsable != null ? parseInt(a.courrielResponsable, 10) : NaN;
      const ts = liveById.get(a.texteSocieteId!);
      const deadline = isoDate(parseFrenchDate(a.cloture));
      const doneAt = done ? effectiveAt.get(a.id) ?? a.datequifairaction ?? null : null;
      const responsable = (a.responsableAction ?? '').replace(/\s+/g, ' ').trim();
      return {
        status,
        open,
        done,
        dueIn: daysUntil(a.cloture),
        progress: Number.isFinite(eff) ? Math.max(0, Math.min(100, eff)) : done ? 100 : 0,
        secteur: ts?.secteurId ? secteurName.get(ts.secteurId) || 'Autre' : 'Autre',
        responsable: responsable || 'Non attribué',
        createdAt: a.createdAt ?? isoDate(parseFrenchDate(a.dateouverture)),
        deadline,
        doneAt,
      };
    });

    const open = rows.filter((r) => r.open);
    const done = rows.filter((r) => r.done);
    const doneWithDates = done.filter((r) => r.deadline && r.doneAt);
    const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : null);

    const group = (key: 'secteur' | 'responsable') => {
      const by = new Map<string, { name: string; open: number; overdue: number; done: number }>();
      for (const r of rows) {
        const k = r[key].toLocaleLowerCase('fr');
        if (!by.has(k)) by.set(k, { name: r[key], open: 0, overdue: 0, done: 0 });
        const g = by.get(k)!;
        if (r.open) g.open++;
        if (r.open && r.dueIn !== null && r.dueIn < 0) g.overdue++;
        if (r.done) g.done++;
      }
      return [...by.values()].sort((a, b) => b.open + b.done - (a.open + a.done));
    };

    // Months, oldest first: the last 12 for the activity, the next 6 for deadlines
    const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit' });
    const now = new Date();
    const months = (from: number, count: number) =>
      Array.from({ length: count }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() + from + i, 1);
        return { key: monthKey(d), label: monthLabel.format(d) };
      });

    const activity = months(-11, 12).map((m) => ({
      month: m.key,
      label: m.label,
      opened: rows.filter((r) => r.createdAt && monthKey(r.createdAt) === m.key).length,
      done: rows.filter((r) => r.doneAt && monthKey(r.doneAt) === m.key).length,
    }));
    const deadlines = months(0, 6).map((m) => ({
      month: m.key,
      label: m.label,
      count: open.filter((r) => r.deadline && r.dueIn !== null && r.dueIn >= 0 && monthKey(r.deadline) === m.key).length,
    }));

    return {
      totals: {
        total: rows.length,
        open: open.length,
        done: done.length,
        overdue: open.filter((r) => r.dueIn !== null && r.dueIn < 0).length,
        dueSoon: open.filter((r) => r.dueIn !== null && r.dueIn >= 0 && r.dueIn <= 30).length,
        noDeadline: open.filter((r) => r.dueIn === null).length,
        averageProgress: open.length ? Math.round(open.reduce((n, r) => n + r.progress, 0) / open.length) : null,
        completionRate: pct(done.length, rows.length),
        onTimeRate: pct(doneWithDates.filter((r) => r.doneAt! <= r.deadline!).length, doneWithDates.length),
      },
      byStatus: lk.actionStates.map((s) => ({
        id: s.id,
        name: s.name ?? '',
        count: rows.filter((r) => r.status === s.id).length,
      })),
      progress: [
        { label: '0 %', count: open.filter((r) => r.progress === 0).length },
        { label: '1 – 49 %', count: open.filter((r) => r.progress > 0 && r.progress < 50).length },
        { label: '50 – 99 %', count: open.filter((r) => r.progress >= 50 && r.progress < 100).length },
        { label: '100 %', count: open.filter((r) => r.progress === 100).length },
      ],
      bySecteur: group('secteur'),
      byResponsable: group('responsable').slice(0, 8),
      activity,
      deadlines,
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
      /** Only the main account changes its own password and manages the team */
      canChangePassword: isMainAccount(user),
      canManageTeam: isMainAccount(user),
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
    // Secondary accounts' passwords are managed by the company's main account
    if (!isMainAccount(user)) {
      throw new ForbiddenException(
        'Le mot de passe de ce compte est géré par le compte principal de votre entreprise.',
      );
    }
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
        id: true, nom: true, email: true, fonction: true, tel: true, multicompte: true,
        droitacceeId: true, activated: true, createdAt: true,
      },
      orderBy: [{ multicompte: 'asc' }, { nom: 'asc' }],
    });
    return {
      canManage: isMainAccount(user),
      members: accounts.map((a) => ({
        id: a.id,
        nom: a.nom,
        email: a.email,
        fonction: a.fonction,
        tel: a.tel,
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
    const seen = this.prefs.get(user.id).notificationsReadUpTo;
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: { companyId: user.ownerId! },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 15,
      }),
      this.prisma.notification.count({ where: this.unreadWhere(user) }),
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
        read: seen === null ? n.isRead === true : n.id <= seen,
      })),
    };
  }

  /**
   * Each person has their own read state: a sub-account reading an alert no
   * longer hides it from colleagues. Until someone first marks notifications
   * as read, the shared legacy flag (`is_read`, used by Symfony) applies.
   */
  private unreadWhere(user: AuthUser): Prisma.NotificationWhereInput {
    const seen = this.prefs.get(user.id).notificationsReadUpTo;
    return seen === null
      ? { companyId: user.ownerId!, OR: [{ isRead: false }, { isRead: null }] }
      : { companyId: user.ownerId!, id: { gt: seen } };
  }

  async markNotificationsRead(user: AuthUser, id?: number) {
    let count = 0;
    if (id) {
      const res = await this.prisma.notification.updateMany({
        where: { id, companyId: user.ownerId! },
        data: { isRead: true, etat: 'lu' },
      });
      count = res.count;
      const seen = this.prefs.get(user.id).notificationsReadUpTo ?? 0;
      if (id > seen) {
        await this.prefs.update(user.id, { notificationsReadUpTo: id });
      }
    } else {
      const last = await this.prisma.notification.findFirst({
        where: { companyId: user.ownerId! },
        orderBy: { id: 'desc' },
        select: { id: true },
      });
      await this.prefs.update(user.id, { notificationsReadUpTo: last?.id ?? 0 });
      const res = await this.prisma.notification.updateMany({
        where: { companyId: user.ownerId!, OR: [{ isRead: false }, { isRead: null }] },
        data: { isRead: true, etat: 'lu' },
      });
      count = res.count;
    }
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

  /**
   * AI Applicability Analysis: Compares the regulatory text against the company's
   * specific profile, sector subscriptions, and facilities to evaluate practical impact.
   */
  async analyzeImpact(user: AuthUser, id: number) {
    const ts = await this.findOwned(user, id);
    const t = ts.texte!;

    const company = await this.prisma.company.findUnique({
      where: { id: user.ownerId! },
      include: {
        companySecteurThemes: {
          include: { secteur: true, theme: true },
        },
        companyThemes: {
          include: { theme: true, secteur: true },
        },
      },
    });

    const sectorsAndThemes = [
      ...(company?.companySecteurThemes || []).map(
        (st) => `${st.secteur?.name || ''} › ${st.theme?.name || ''}`,
      ),
      ...(company?.companyThemes || []).map(
        (ct) => `${ct.secteur?.name || ''} › ${ct.theme?.name || ''}`,
      ),
    ].filter(Boolean);

    const companyProfile = {
      nom: company?.nom || company?.raisonsociale || 'Entreprise cliente',
      ville: company?.ville || 'Tunisie',
      secteurs: Array.from(new Set(sectorsAndThemes)).slice(0, 8),
    };

    if (!this.genAI) {
      return {
        applicable: true,
        verdict: 'Applicable à votre secteur (Mode hors-ligne)',
        degreImpact: 'Moyen',
        justification: `Ce texte s'inscrit dans le domaine « ${t.secteur?.name || 'Général'} › ${t.theme?.name || ''} » suivi par votre établissement.`,
        pointsVigilance: ['Vérifier les exigences applicables à vos installations'],
        recommandations: ['Consulter le texte officiel PDF', 'Réaliser une auto-évaluation'],
      };
    }

    const prompt = `Tu es un juriste et auditeur expert en réglementation tunisienne (Santé & Sécurité au Travail, Environnement, Droit du travail et Industrie) pour le cabinet de conseil IGTS.
Un responsable QHSE d'une entreprise consulte un nouveau texte réglementaire dans son tableau de bord et demande une analyse d'impact personnalisée.

ENTREPRISE :
- Raison sociale : ${companyProfile.nom}
- Localisation : ${companyProfile.ville}
- Domaines et thèmes d'activité suivis : ${companyProfile.secteurs.join(', ') || 'Industrie et Services généraux'}

TEXTE RÉGLEMENTAIRE :
- Titre : ${t.titre}
- Type : ${t.type?.name || 'Réglementation'}
- Domaine : ${t.secteur?.name || ''} › ${t.theme?.name || ''}
- Date / Journal : ${t.journal} du ${t.date}
- Résumé du texte : ${t.description}

MISSION :
Analyse précisément et avec pragmatisme si ce texte a un impact direct ou indirect sur cette entreprise, pourquoi, et ce qu'elle doit surveiller.
Réponds UNIQUEMENT au format JSON strict avec ce schéma :
{
  "applicable": boolean (true si l'entreprise est concernée ou susceptible de l'être, false si ce texte ne la concerne manifestement pas),
  "verdict": "string court" (ex: "Directement applicable à vos installations", "Applicable sous condition d'effectif ou d'activité", "Non applicable à votre secteur", etc.),
  "degreImpact": "Élevé" | "Moyen" | "Faible",
  "justification": "Explication claire et professionnelle de 2 à 4 phrases justifiant la décision et expliquant ce que la réglementation exige concrètement pour cette entreprise.",
  "pointsVigilance": [
    "Point de vigilance précis 1",
    "Point de vigilance précis 2",
    "Point de vigilance précis 3"
  ],
  "recommandations": [
    "Recommandation concrète d'action 1",
    "Recommandation concrète d'action 2"
  ]
}`;

    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      });
      const result = await model.generateContent(prompt);
      return JSON.parse(result.response.text());
    } catch (e) {
      this.logger.error(`Error in analyzeImpact: ${(e as Error).message}`);
      return {
        applicable: true,
        verdict: 'Applicable à votre secteur',
        degreImpact: 'Moyen',
        justification: `Le texte concerne le domaine « ${t.secteur?.name || ''} ». Veuillez vérifier son application à vos installations.`,
        pointsVigilance: ['Vérifier les seuils applicables'],
        recommandations: ['Consulter le texte officiel PDF'],
      };
    }
  }

  /**
   * AI Action Suggestions: Generates 2 to 4 recommended compliance actions
   * tailored to the legal requirements of this text.
   */
  async suggestActions(user: AuthUser, id: number) {
    const ts = await this.findOwned(user, id);
    const t = ts.texte!;

    if (!this.genAI) {
      return {
        actions: [
          {
            description: `Analyser les obligations et vérifier la conformité des installations`,
            responsable: 'Responsable QHSE',
            delaiJours: 30,
            priorite: 'Moyenne',
          },
        ],
      };
    }

    const prompt = `Tu es un auditeur et expert en conformité réglementaire QHSE chez IGTS Tunisie.
Pour le texte de loi suivant, suggère un plan d'action de 2 à 4 actions correctives ou préventives concrètes et adaptées pour une entreprise industrielle ou tertiaire.

TEXTE :
- Titre : ${t.titre}
- Type : ${t.type?.name || 'Réglementation'}
- Domaine : ${t.secteur?.name || ''} › ${t.theme?.name || ''}
- Contenu : ${t.description}

MISSION :
Rédige 2 à 4 actions concrètes, formulées avec un verbe à l'infinitif (ex: "Mettre à jour le registre de sécurité", "Planifier la formation des opérateurs", "Vérifier la validité des contrôles périodiques").
Réponds UNIQUEMENT au format JSON strict avec ce schéma :
{
  "actions": [
    {
      "description": "Description claire et opérationnelle de l'action à mener",
      "responsable": "Titre du responsable suggéré (ex: Responsable QHSE, Responsable Maintenance, DRH, Direction)",
      "delaiJours": 15 | 30 | 60 | 90,
      "priorite": "Haute" | "Moyenne" | "Basse"
    }
  ]
}`;

    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      });
      const result = await model.generateContent(prompt);
      return JSON.parse(result.response.text());
    } catch (e) {
      this.logger.error(`Error in suggestActions: ${(e as Error).message}`);
      return {
        actions: [
          {
            description: `Analyser les obligations du texte et planifier les vérifications nécessaires`,
            responsable: 'Responsable QHSE',
            delaiJours: 30,
            priorite: 'Moyenne',
          },
        ],
      };
    }
  }
}

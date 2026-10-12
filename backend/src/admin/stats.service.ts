import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { computeStats } from '../company/company.service';
import { ActivityService } from '../accounts/activity.service';
import {
  SubscriptionsService,
  type SubscriptionStatus,
} from '../accounts/subscriptions.service';
import { AccountRequestsService } from '../accounts/account-requests.service';
import { FeedbackService } from '../feedback/feedback.service';
import { DraftsStore } from '../scraper/drafts.store';
import { tunisDay } from '../common/json-file';

const TS_ACTIVE: Prisma.TexteSocieteWhereInput = {
  OR: [{ deleted: false }, { deleted: null }],
  texte: { deleted: false },
};
/** historiqueaction: the action became "efficace" (done) */
const ACTION_DONE = 5;
const MONTHS_SHORT = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

/** The last `n` months, oldest first: { key: "2026-03", label: "mars 26" }. */
function lastMonths(n: number) {
  const today = tunisDay();
  let y = Number(today.slice(0, 4));
  let m = Number(today.slice(5, 7));
  const out: { key: string; label: string }[] = [];
  for (let i = 0; i < n; i++) {
    out.unshift({
      key: `${y}-${String(m).padStart(2, '0')}`,
      label: `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}`,
    });
    m--;
    if (m === 0) {
      m = 12;
      y--;
    }
  }
  return out;
}

const monthOf = (d: Date | string | null | undefined) =>
  d ? tunisDay(new Date(d)).slice(0, 7) : null;

/**
 * Everything happening on the platform, for the IGTS administrators: clients
 * and their subscriptions, activity month by month, compliance across
 * clients, the texts, the satisfaction survey and a live feed of events.
 */
@Injectable()
export class AdminStatsService {
  constructor(
    private prisma: PrismaService,
    private activity: ActivityService,
    private subscriptions: SubscriptionsService,
    private accountRequests: AccountRequestsService,
    private feedback: FeedbackService,
    private drafts: DraftsStore,
  ) {}

  async stats() {
    const months = lastMonths(12);
    const from = new Date(`${months[0].key}-01T00:00:00Z`);
    const since30 = new Date(Date.now() - 30 * 86_400_000);

    const [
      mains,
      subAccounts,
      evaluations,
      actionsCreated,
      actionsDone,
      textsPublished,
      groupedCompliance,
      textsTotal,
      textsLast30,
      bySecteur,
      byType,
      secteurs,
      types,
      assignments,
      evaluated,
      recentEvaluations,
    ] = await Promise.all([
      this.prisma.company.findMany({
        where: { deleted: false, multicompte: 0 },
        select: {
          id: true,
          nom: true,
          raisonsociale: true,
          createdAt: true,
          activated: true,
        },
      }),
      this.prisma.company.count({
        where: { deleted: false, multicompte: { gt: 0 } },
      }),
      this.prisma.historiqueEtat.findMany({
        where: { createdAt: { gte: from } },
        select: { createdAt: true },
      }),
      this.prisma.plusaction.findMany({
        where: { createdAt: { gte: from } },
        select: { createdAt: true },
      }),
      this.prisma.historiqueAction.findMany({
        where: { gestionactionId: ACTION_DONE, createdAt: { gte: from } },
        select: { createdAt: true },
      }),
      this.prisma.texte.findMany({
        where: { deleted: false, createdAt: { gte: from } },
        select: { createdAt: true },
      }),
      this.prisma.texteSociete.groupBy({
        by: ['companyId', 'applicabiliteId', 'gestionetatId'],
        where: TS_ACTIVE,
        _count: { _all: true },
      }),
      this.prisma.texte.count({ where: { deleted: false } }),
      this.prisma.texte.count({
        where: { deleted: false, createdAt: { gte: since30 } },
      }),
      this.prisma.texte.groupBy({
        by: ['secteurId'],
        where: { deleted: false },
        _count: { _all: true },
      }),
      this.prisma.texte.groupBy({
        by: ['typeId'],
        where: { deleted: false },
        _count: { _all: true },
      }),
      this.prisma.secteur.findMany({ select: { id: true, name: true } }),
      this.prisma.type.findMany({ select: { id: true, name: true } }),
      this.prisma.texteSociete.count({ where: TS_ACTIVE }),
      this.prisma.texteSociete.count({
        where: { ...TS_ACTIVE, gestionetatId: { not: null } },
      }),
      this.prisma.historiqueEtat.groupBy({
        by: ['companyId'],
        where: { createdAt: { gte: since30 } },
        _max: { createdAt: true },
      }),
    ]);

    const name = new Map(mains.map((c) => [c.id, c.raisonsociale || c.nom]));
    const mainIds = new Set(mains.map((c) => c.id));

    // ─── Activity, month by month ───
    const count = (dates: (Date | string | null)[]) => {
      const by = new Map<string, number>();
      for (const d of dates) {
        const k = monthOf(d);
        if (k) by.set(k, (by.get(k) ?? 0) + 1);
      }
      return by;
    };
    const logins = count(
      this.activity
        .since(from.toISOString(), 'login')
        .filter((e) => e.actor.kind === 'company')
        .map((e) => e.at),
    );
    const evals = count(evaluations.map((e) => e.createdAt));
    const created = count(actionsCreated.map((a) => a.createdAt));
    const done = count(actionsDone.map((a) => a.createdAt));
    const published = count(textsPublished.map((t) => t.createdAt));
    const newClients = count(mains.map((c) => c.createdAt));
    const activity = months.map((m) => ({
      month: m.key,
      label: m.label,
      logins: logins.get(m.key) ?? 0,
      evaluations: evals.get(m.key) ?? 0,
      actionsCreated: created.get(m.key) ?? 0,
      actionsDone: done.get(m.key) ?? 0,
      textsPublished: published.get(m.key) ?? 0,
      newClients: newClients.get(m.key) ?? 0,
    }));

    // ─── Subscriptions ───
    const subs = this.subscriptions.all();
    const subCounts: Record<SubscriptionStatus, number> = {
      none: 0,
      active: 0,
      expiring: 0,
      expired: 0,
      suspended: 0,
    };
    for (const c of mains) subCounts[subs.get(c.id)?.status ?? 'none']++;
    const toFollow = mains
      .map((c) => ({
        id: c.id,
        name: name.get(c.id)!,
        ...(subs.get(c.id) ?? this.subscriptions.info(c.id)),
      }))
      .filter(
        (s) =>
          s.status === 'expiring' ||
          s.status === 'expired' ||
          s.status === 'suspended',
      )
      .sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0))
      .map(({ id, name: n, status, end, daysLeft }) => ({
        id,
        name: n,
        status,
        end,
        daysLeft,
      }));

    // ─── Compliance across clients ───
    const rowsBy = new Map<
      number,
      { applicabiliteId: number; gestionetatId: number | null; count: number }[]
    >();
    for (const r of groupedCompliance) {
      if (!r.companyId || !mainIds.has(r.companyId)) continue;
      if (!rowsBy.has(r.companyId)) rowsBy.set(r.companyId, []);
      rowsBy.get(r.companyId)!.push({ ...r, count: r._count._all });
    }
    const perCompany = mains.map((c) => ({
      id: c.id,
      name: name.get(c.id)!,
      ...computeStats(rowsBy.get(c.id) ?? []),
    }));
    const rated = perCompany.filter((c) => c.complianceRate !== null);
    const buckets = [
      { label: 'Moins de 50 %', min: 0, max: 50 },
      { label: '50 à 75 %', min: 50, max: 75 },
      { label: '75 à 90 %', min: 75, max: 90 },
      { label: '90 % et plus', min: 90, max: 101 },
    ].map((b) => ({
      label: b.label,
      count: rated.filter(
        (c) => c.complianceRate! >= b.min && c.complianceRate! < b.max,
      ).length,
    }));
    const byRate = [...rated].sort(
      (a, b) => a.complianceRate! - b.complianceRate!,
    );
    const pick = ({
      id,
      name: n,
      complianceRate,
      toAnalyse,
      nonConforme,
    }: (typeof perCompany)[number]) => ({
      id,
      name: n,
      rate: complianceRate,
      toAnalyse,
      nonConforme,
    });

    // ─── Engagement (last 30 days) ───
    const lastLogin = this.activity.lastLogins();
    const lastEval = new Map(
      recentEvaluations
        .filter((r) => r.companyId)
        .map((r) => [r.companyId!, r._max.createdAt]),
    );
    const isActive = (id: number) => {
      const l = lastLogin.get(id);
      return (l && new Date(l) >= since30) || lastEval.has(id);
    };
    const open = mains.filter(
      (c) => c.activated && !(subs.get(c.id)?.locked ?? false),
    );
    const inactive = open
      .filter((c) => !isActive(c.id))
      .map((c) => ({
        id: c.id,
        name: name.get(c.id)!,
        lastLogin: lastLogin.get(c.id) ?? null,
      }))
      .sort((a, b) => (a.lastLogin ?? '').localeCompare(b.lastLogin ?? ''))
      .slice(0, 8);

    // ─── Texts ───
    const secteurName = new Map(secteurs.map((s) => [s.id, s.name]));
    const typeName = new Map(types.map((t) => [t.id, t.name]));

    return {
      generatedAt: new Date().toISOString(),
      clients: {
        companies: mains.length,
        subAccounts,
        accountsToActivate: this.accountRequests.pending().length,
        subscriptions: subCounts,
        toFollow: toFollow.slice(0, 10),
      },
      engagement: {
        activeCompanies: open.filter((c) => isActive(c.id)).length,
        openCompanies: open.length,
        inactive,
      },
      activity,
      compliance: {
        average: rated.length
          ? Math.round(
              (rated.reduce((s, c) => s + c.complianceRate!, 0) /
                rated.length) *
                10,
            ) / 10
          : null,
        rated: rated.length,
        notRated: perCompany.length - rated.length,
        buckets,
        lowest: byRate.slice(0, 5).map(pick),
        highest: byRate.slice(-5).reverse().map(pick),
        toAnalyse: perCompany.reduce((s, c) => s + c.toAnalyse, 0),
      },
      texts: {
        total: textsTotal,
        last30: textsLast30,
        assignments,
        evaluatedShare: assignments
          ? Math.round((evaluated / assignments) * 1000) / 10
          : null,
        drafts: this.drafts.pendingCount(),
        bySecteur: bySecteur
          .map((s) => ({
            name:
              (s.secteurId && secteurName.get(s.secteurId)) || 'Sans secteur',
            count: s._count._all,
          }))
          .sort((a, b) => b.count - a.count),
        byType: byType
          .map((t) => ({
            name: (t.typeId && typeName.get(t.typeId)) || 'Sans type',
            count: t._count._all,
          }))
          .sort((a, b) => b.count - a.count),
      },
      feedback: this.feedback.latestSummary(),
      recent: this.activity.recent(40),
    };
  }
}

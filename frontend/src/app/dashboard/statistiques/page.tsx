"use client";

import Link from "next/link";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { BentoGrid, BentoGridItem } from "@/components/aceternity/bento-grid";
import { AnimatedContent } from "@/components/reactbits/animated-content";
import { CHART, DataTable, Kpi } from "@/components/charts/kit";
import { Icon, type IconName } from "@/components/icons";
import { Badge, ErrorState, PageHeader, Skeleton, cn } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartLegend, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useApi } from "@/lib/use-api";
import { formatDate, formatNumber, formatPercent, plural, relativeTime } from "@/lib/format";
import type { ActivityEvent, AdminStats } from "@/lib/admin-types";

/*
 * Colours: the validated chart tokens for series (one hue per single-series
 * chart), the status colours only for subscription states (always with their
 * label), and a one-hue indigo ramp, light to dark, for compliance levels.
 * Values and labels stay in ink.
 */
type Month = AdminStats["activity"][number];

const decimal = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const note = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const loginsConfig = { logins: { label: "Connexions", color: CHART.indigo } } satisfies ChartConfig;
const evaluationsConfig = { evaluations: { label: "Évaluations", color: CHART.indigo } } satisfies ChartConfig;
const actionsConfig = {
  actionsCreated: { label: "Créées", color: CHART.indigo },
  actionsDone: { label: "Devenues efficaces", color: CHART.green },
} satisfies ChartConfig;
const textsConfig = { textsPublished: { label: "Textes publiés", color: CHART.indigo } } satisfies ChartConfig;

// ─── Activity: small multiples, one measure (and one axis) per chart ──

function MonthChart({ title, config, data }: { title: string; config: ChartConfig; data: Month[] }) {
  const keys = Object.keys(config) as (keyof Month)[];
  const total = data.reduce((n, m) => n + Number(m[keys[0]]), 0);
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-2xl border border-ink-150 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h3 className="text-[14px] font-semibold text-ink-900">{title}</h3>
        <span className="tabular text-[12.5px] text-ink-500">
          {formatNumber(total)} {keys.length > 1 ? "créées " : ""}sur 12 mois
        </span>
      </div>
      {keys.length > 1 && <ChartLegend config={config} className="justify-start" />}
      <ChartContainer config={config} className="h-[150px]">
        <BarChart data={data} margin={{ top: 6, right: 2, left: -22, bottom: 0 }} barGap={2} barCategoryGap="24%">
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={6} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
          <ChartTooltip cursor={{ fill: "rgb(238 236 249 / 0.6)" }} content={<ChartTooltipContent />} />
          {keys.map((k) => (
            <Bar key={k} dataKey={k} fill={`var(--color-${k})`} radius={[4, 4, 0, 0]} maxBarSize={keys.length > 1 ? 10 : 16} />
          ))}
        </BarChart>
      </ChartContainer>
    </div>
  );
}

// ─── Horizontal bars (HTML): one hue, value written beside each bar ──

function BarList({
  rows,
  color = CHART.indigo,
  colors,
  unit,
}: {
  rows: { name: string; count: number }[];
  color?: string;
  /** One colour per row (ordinal ramp) */
  colors?: string[];
  unit: [string, string];
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  const total = rows.reduce((n, r) => n + r.count, 0) || 1;
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r, i) => (
        <li key={r.name} className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-3 text-[13.5px]">
          <span className="truncate text-ink-700" title={r.name}>
            {r.name}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex h-6 items-center" tabIndex={0} aria-label={`${r.name} : ${plural(r.count, unit[0], unit[1])}`}>
                <span
                  className="h-3.5 min-w-[3px] rounded-r-[4px] transition-[width] duration-700"
                  style={{ width: `${(r.count / max) * 100}%`, background: colors?.[i] ?? color }}
                />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {r.name} : {plural(r.count, unit[0], unit[1])} ({Math.round((r.count / total) * 100)} %)
            </TooltipContent>
          </Tooltip>
          <span className="tabular w-10 text-right font-semibold text-ink-900">{formatNumber(r.count)}</span>
        </li>
      ))}
    </ul>
  );
}

/** The 7 largest groups, the rest gathered in « Autres ». */
function top(rows: { name: string; count: number }[], n = 7) {
  if (rows.length <= n + 1) return rows;
  const rest = rows.slice(n).reduce((s, r) => s + r.count, 0);
  return [...rows.slice(0, n), { name: `Autres (${rows.length - n})`, count: rest }];
}

// ─── Subscriptions ───────────────────────────────────────────────────

const SUB_PARTS: { key: keyof AdminStats["clients"]["subscriptions"]; label: string; color: string }[] = [
  { key: "active", label: "Actifs", color: "#2e9a62" },
  { key: "none", label: "Sans date de fin", color: "#c4c1d2" },
  { key: "expiring", label: "Fin dans moins de 30 jours", color: "#c0821f" },
  { key: "suspended", label: "Suspendus par IGTS", color: "#d9622b" },
  { key: "expired", label: "Expirés · accès fermé", color: "#b42318" },
];

function SubscriptionSplit({ stats }: { stats: AdminStats }) {
  const counts = stats.clients.subscriptions;
  const total = SUB_PARTS.reduce((n, p) => n + counts[p.key], 0) || 1;
  const shown = SUB_PARTS.filter((p) => counts[p.key] > 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-4 w-full gap-[2px]" role="img" aria-label={SUB_PARTS.map((p) => `${p.label} : ${counts[p.key]}`).join(", ")}>
        {shown.map((p, i) => (
          <Tooltip key={p.key}>
            <TooltipTrigger asChild>
              <span
                className={cn("h-full min-w-[3px]", i === 0 && "rounded-l-[4px]", i === shown.length - 1 && "rounded-r-[4px]")}
                style={{ width: `${(counts[p.key] / total) * 100}%`, background: p.color }}
              />
            </TooltipTrigger>
            <TooltipContent>
              {p.label} : {formatNumber(counts[p.key])} ({Math.round((counts[p.key] / total) * 100)} %)
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {SUB_PARTS.map((p) => (
          <li key={p.key} className="flex items-center gap-2.5 text-[13.5px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: p.color }} />
            <span className="flex-1 text-ink-700">{p.label}</span>
            <span className="tabular font-semibold text-ink-900">{formatNumber(counts[p.key])}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FollowBadge({ s }: { s: AdminStats["clients"]["toFollow"][number] }) {
  if (s.status === "suspended") return <Badge tone="bad">Suspendu</Badge>;
  if (s.status === "expired") return <Badge tone="bad">Expiré</Badge>;
  return <Badge tone="warn">Fin dans {s.daysLeft} j</Badge>;
}

// ─── Compliance ──────────────────────────────────────────────────────

/** Indigo, light to dark (all ≥ 3:1 on white): higher compliance, darker bar. */
const COMPLIANCE_RAMP = ["#8279df", "#5a4fd0", "#3b2ba8", "#2a1d86"];

function CompanyRates({ title, rows }: { title: string; rows: AdminStats["compliance"]["lowest"] }) {
  if (!rows.length) return null;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h3 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink-500">{title}</h3>
      <ul className="flex flex-col divide-y divide-ink-150">
        {rows.map((c) => (
          <li key={c.id} className="flex items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              <Link href={`/dashboard/companies/${c.id}`} className="block truncate text-[14px] font-medium text-ink-900 hover:text-brand-700">
                {c.name}
              </Link>
              <p className="text-[12.5px] text-ink-500">
                {c.toAnalyse ? plural(c.toAnalyse, "texte à analyser", "textes à analyser") : "tout est analysé"}
                {c.nonConforme ? ` · ${plural(c.nonConforme, "non-conformité", "non-conformités")}` : ""}
              </p>
            </div>
            <span className="tabular text-[15px] font-semibold text-ink-900">{formatPercent(c.rate)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Activity feed ───────────────────────────────────────────────────

const EVENT_ICON: Record<ActivityEvent["type"], IconName> = {
  login: "key",
  subscription: "calendar",
  account: "userPlus",
  feedback: "message",
  "text-published": "file",
  veille: "sparkle",
  echeance: "clock",
};
const FEED_FILTERS: { key: "all" | ActivityEvent["type"]; label: string }[] = [
  { key: "all", label: "Tout" },
  { key: "login", label: "Connexions" },
  { key: "subscription", label: "Abonnements" },
  { key: "account", label: "Comptes" },
  { key: "text-published", label: "Textes" },
  { key: "echeance", label: "Échéances" },
  { key: "feedback", label: "Enquêtes" },
];

function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  const [filter, setFilter] = useState<(typeof FEED_FILTERS)[number]["key"]>("all");
  const list = filter === "all" ? events : events.filter((e) => e.type === filter);
  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrer l’activité">
        {FEED_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full px-3 py-1 text-[12.5px] font-semibold transition-colors",
              filter === f.key ? "bg-brand-800 text-white" : "bg-ink-50 text-ink-600 hover:bg-brand-50 hover:text-brand-700",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="py-6 text-center text-[13.5px] text-ink-500">Rien à afficher pour l’instant.</p>
      ) : (
        <ol className="flex max-h-[420px] flex-col divide-y divide-ink-150 overflow-y-auto pr-1" data-lenis-prevent>
          {list.map((e, i) => (
            <li key={`${e.at}-${i}`} className="flex items-start gap-3 py-2.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Icon name={EVENT_ICON[e.type]} size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] leading-snug text-ink-800">{e.label}</p>
                <p className="text-[12px] text-ink-500">
                  {relativeTime(e.at)}
                  {e.actor.kind === "admin" ? ` · ${e.actor.nom} (IGTS)` : e.actor.kind === "system" ? " · automatique" : ""}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────

/**
 * Everything happening on the platform, for the IGTS administrators: clients
 * and subscriptions, monthly activity, compliance across clients, texts, the
 * satisfaction survey and a live feed.
 */
export default function AdminStatisticsPage() {
  const { data, error, loading, reload } = useApi<AdminStats>("/admin/stats");

  return (
    <TooltipProvider>
      <PageHeader
        eyebrow="Administration IGTS"
        title="Statistiques"
        description="Ce qui se passe sur la plateforme : vos clients, leur activité, leur conformité, les textes et leur satisfaction."
        actions={
          <Button variant="outline" onClick={() => void reload()} disabled={loading}>
            <Icon name="refresh" size={16} className={cn(loading && "animate-spin")} />
            Actualiser
          </Button>
        }
      />
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-6">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-[132px] rounded-[20px]" />
            ))}
          </div>
          <Skeleton className="h-[420px] rounded-[22px]" />
        </div>
      )}
      {data && <Statistics s={data} />}
    </TooltipProvider>
  );
}

function Statistics({ s }: { s: AdminStats }) {
  const { clients, engagement, compliance, texts, feedback } = s;
  const toFollow = clients.subscriptions.expiring + clients.subscriptions.expired + clients.subscriptions.suspended;
  const lowestIds = new Set(compliance.lowest.map((c) => c.id));
  const highest = compliance.highest.filter((c) => !lowestIds.has(c.id));
  const activePct = engagement.openCompanies ? Math.round((engagement.activeCompanies / engagement.openCompanies) * 100) : null;

  return (
    <div className="flex flex-col gap-5">
      <AnimatedContent>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-6">
          <Kpi
            icon="building"
            label="Entreprises clientes"
            value={clients.companies}
            sub={plural(clients.subAccounts, "compte collaborateur", "comptes collaborateurs")}
          />
          <Kpi
            icon="users"
            label="Actives sur 30 jours"
            value={engagement.activeCompanies}
            sub={`sur ${plural(engagement.openCompanies, "accès ouvert", "accès ouverts")}`}
            meter={activePct}
          />
          <Kpi
            icon="target"
            label="Conformité moyenne"
            value={compliance.average}
            format={decimal}
            suffix=" %"
            sub={plural(compliance.rated, "entreprise évaluée", "entreprises évaluées")}
            meter={compliance.average}
          />
          <Kpi
            icon="library"
            label="Textes de la veille"
            value={texts.total}
            sub={`+${formatNumber(texts.last30)} ces 30 derniers jours`}
          />
          <Kpi
            icon="calendar"
            label="Abonnements à suivre"
            value={toFollow}
            sub={toFollow ? "fin proche, expirés ou suspendus" : "tous les abonnements sont à jour"}
            tone={toFollow ? "coral" : undefined}
          />
          <Kpi
            icon="message"
            label="Satisfaction"
            value={feedback?.average ?? null}
            format={note}
            suffix=" / 5"
            sub={feedback ? plural(feedback.respondents, "répondant", "répondants") : "aucune enquête pour l’instant"}
          />
        </div>
      </AnimatedContent>

      <BentoGrid>
        <AnimatedContent className="md:col-span-2 xl:col-span-6">
          <BentoGridItem
            className="h-full"
            title="Activité des 12 derniers mois"
            description="Ce que font vos clients sur la plateforme, mois par mois. Les connexions sont comptées depuis la mise en place du journal d’activité."
          >
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
              <MonthChart title="Connexions des clients" config={loginsConfig} data={s.activity} />
              <MonthChart title="Évaluations de conformité" config={evaluationsConfig} data={s.activity} />
              <MonthChart title="Plans d’action" config={actionsConfig} data={s.activity} />
              <MonthChart title="Textes publiés par IGTS" config={textsConfig} data={s.activity} />
            </div>
            <DataTable
              head={["Mois", "Connexions", "Évaluations", "Actions créées", "Actions efficaces", "Textes publiés", "Nouveaux clients"]}
              rows={s.activity.map((m) => [m.label, m.logins, m.evaluations, m.actionsCreated, m.actionsDone, m.textsPublished, m.newClients])}
            />
          </BentoGridItem>
        </AnimatedContent>

        <AnimatedContent className="md:col-span-2 xl:col-span-3">
          <BentoGridItem
            className="h-full"
            title="Abonnements"
            description="Un an, renouvelé par IGTS. À l’échéance, l’accès se ferme jusqu’au renouvellement."
            action={
              <Link href="/dashboard/companies?abonnement=a-relancer" className="shrink-0 text-[13px] font-semibold text-brand-700 hover:underline">
                Voir la liste
              </Link>
            }
          >
            <SubscriptionSplit stats={s} />
            {clients.toFollow.length > 0 && (
              <div className="flex flex-col gap-1">
                <h3 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink-500">À relancer</h3>
                <ul className="flex flex-col divide-y divide-ink-150">
                  {clients.toFollow.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 py-2">
                      <Link href={`/dashboard/companies/${c.id}`} className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink-900 hover:text-brand-700">
                        {c.name}
                      </Link>
                      {c.end && <span className="hidden text-[12.5px] text-ink-500 sm:inline">fin le {formatDate(c.end)}</span>}
                      <FollowBadge s={c} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {clients.accountsToActivate > 0 && (
              <Link
                href="/dashboard/comptes"
                className="flex items-center gap-3 rounded-xl bg-saffron-50 px-4 py-3 text-[13.5px] text-saffron-700 hover:bg-saffron-100"
              >
                <Icon name="userPlus" size={17} />
                <span className="flex-1">
                  {clients.accountsToActivate > 1
                    ? `${formatNumber(clients.accountsToActivate)} comptes collaborateurs attendent leur mot de passe IGTS`
                    : "1 compte collaborateur attend son mot de passe IGTS"}
                </span>
                <Icon name="arrowRight" size={15} />
              </Link>
            )}
          </BentoGridItem>
        </AnimatedContent>

        <AnimatedContent className="md:col-span-2 xl:col-span-3" delay={0.05}>
          <BentoGridItem
            className="h-full"
            title="Conformité des clients"
            description={
              compliance.rated
                ? `Taux de conformité de ${plural(compliance.rated, "entreprise évaluée", "entreprises évaluées")}${
                    compliance.notRated ? ` · ${plural(compliance.notRated, "sans évaluation", "sans évaluation")}` : ""
                  } · ${plural(compliance.toAnalyse, "texte à analyser", "textes à analyser")} au total.`
                : "Aucune entreprise n’a encore évalué ses textes."
            }
          >
            {compliance.rated > 0 && (
              <>
                <BarList rows={compliance.buckets.map((b) => ({ name: b.label, count: b.count }))} colors={COMPLIANCE_RAMP} unit={["entreprise", "entreprises"]} />
                <div className="grid gap-5 sm:grid-cols-2">
                  <CompanyRates title="À accompagner" rows={compliance.lowest} />
                  <CompanyRates title="Les plus avancées" rows={highest} />
                </div>
              </>
            )}
          </BentoGridItem>
        </AnimatedContent>

        <AnimatedContent className="md:col-span-2 xl:col-span-3">
          <BentoGridItem
            className="h-full"
            title="Textes par domaine"
            description={`${plural(texts.assignments, "affectation", "affectations")} aux clients, dont ${formatPercent(texts.evaluatedShare)} déjà évaluées.`}
            action={
              texts.drafts > 0 ? (
                <Link href="/dashboard/veille" className="shrink-0">
                  <Badge tone="warn" dot>
                    {plural(texts.drafts, "brouillon JORT", "brouillons JORT")}
                  </Badge>
                </Link>
              ) : undefined
            }
          >
            <BarList rows={top(texts.bySecteur)} unit={["texte", "textes"]} />
            <DataTable head={["Domaine", "Textes"]} rows={texts.bySecteur.map((r) => [r.name, r.count])} />
          </BentoGridItem>
        </AnimatedContent>

        <AnimatedContent className="md:col-span-2 xl:col-span-3" delay={0.05}>
          <BentoGridItem className="h-full" title="Textes par type" description="Lois, décrets, arrêtés… publiés dans la veille.">
            <BarList rows={top(texts.byType)} unit={["texte", "textes"]} />
            <DataTable head={["Type", "Textes"]} rows={texts.byType.map((r) => [r.name, r.count])} />
          </BentoGridItem>
        </AnimatedContent>

        <AnimatedContent className="md:col-span-1 xl:col-span-2">
          <BentoGridItem
            className="h-full"
            title="Sans activité depuis 30 jours"
            description="Ni connexion ni évaluation : un appel peut aider."
          >
            {engagement.inactive.length === 0 ? (
              <p className="py-4 text-[13.5px] text-ink-500">Toutes les entreprises ouvertes ont été actives ce mois-ci.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-ink-150">
                {engagement.inactive.map((c) => (
                  <li key={c.id} className="py-2">
                    <Link href={`/dashboard/companies/${c.id}`} className="block truncate text-[14px] font-medium text-ink-900 hover:text-brand-700">
                      {c.name}
                    </Link>
                    <p className="text-[12.5px] text-ink-500">
                      {c.lastLogin ? `Dernière connexion ${relativeTime(c.lastLogin)}` : "Aucune connexion enregistrée"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </BentoGridItem>
        </AnimatedContent>

        <AnimatedContent className="md:col-span-1 xl:col-span-2" delay={0.05}>
          <BentoGridItem
            className="h-full"
            title="Satisfaction"
            description={feedback ? feedback.title : "L’enquête s’ouvre seule chaque 1er septembre."}
            action={feedback ? <Badge tone={feedback.open ? "ok" : "neutral"}>{feedback.open ? "En cours" : "Clôturée"}</Badge> : undefined}
          >
            {feedback ? (
              <div className="flex flex-col gap-4">
                <p className="flex items-baseline gap-1.5">
                  <span className="tabular font-serif text-[40px] font-semibold leading-none text-ink-900">
                    {feedback.average === null ? "—" : note(feedback.average)}
                  </span>
                  <span className="text-[15px] text-ink-500">/ 5</span>
                </p>
                {feedback.average !== null && (
                  <span className="h-1.5 overflow-hidden rounded-full bg-brand-50" aria-hidden="true">
                    <span className="block h-full rounded-full bg-brand-500" style={{ width: `${(feedback.average / 5) * 100}%` }} />
                  </span>
                )}
                <p className="text-[13.5px] text-ink-600">
                  {plural(feedback.respondents, "personne a répondu", "personnes ont répondu")}, dans{" "}
                  {plural(feedback.companies, "entreprise", "entreprises")}.
                </p>
              </div>
            ) : (
              <p className="text-[13.5px] text-ink-600">Vous pouvez aussi la lancer vous-même à tout moment.</p>
            )}
            <Button variant="outline" asChild className="mt-auto self-start">
              <Link href="/dashboard/enquetes">{feedback ? "Voir les résultats" : "Préparer l’enquête"}</Link>
            </Button>
          </BentoGridItem>
        </AnimatedContent>

        <AnimatedContent className="md:col-span-2 xl:col-span-2">
          <BentoGridItem className="h-full" title="En direct" description="Les derniers événements sur la plateforme.">
            <ActivityFeed events={s.recent} />
          </BentoGridItem>
        </AnimatedContent>
      </BentoGrid>
    </div>
  );
}

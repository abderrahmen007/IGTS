"use client";

import { useEffect } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { BentoGrid, BentoGridItem } from "./aceternity/bento-grid";
import { AnimatedContent } from "./reactbits/animated-content";
import { EmptyState, ErrorState, Skeleton } from "./ui";
import { ChartContainer, ChartLegend, ChartTooltip, ChartTooltipContent, type ChartConfig } from "./ui/chart";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { useApi } from "@/lib/use-api";
import { DataTable, Kpi } from "./charts/kit";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ActionStats } from "@/lib/types";

/*
 * Colours are the validated chart tokens (globals.css): indigo, green, coral,
 * deep saffron. Values and labels stay in ink; a coloured key sits beside them.
 */
const INDIGO = "var(--chart-1)";
const GREEN = "var(--chart-2)";
const CORAL = "var(--chart-3)";
const SAFFRON = "var(--chart-4)";

const activityConfig = {
  opened: { label: "Actions créées", color: INDIGO },
  done: { label: "Actions devenues efficaces", color: GREEN },
} satisfies ChartConfig;

const domainConfig = {
  done: { label: "Efficaces", color: GREEN },
  active: { label: "En cours", color: INDIGO },
  overdue: { label: "En retard", color: CORAL },
} satisfies ChartConfig;

const singleConfig = { count: { label: "Actions", color: INDIGO } } satisfies ChartConfig;

const shorten = (s: string, n = 24) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// ─── Status split: one stacked bar ───────────────────────────────────

function StatusSplit({ stats }: { stats: ActionStats }) {
  const get = (id: number) => stats.byStatus.find((s) => s.id === id)?.count ?? 0;
  const parts = [
    { key: "done", label: "Efficaces", value: get(5), color: GREEN },
    { key: "active", label: "En cours", value: get(1), color: INDIGO },
    { key: "retry", label: "Non efficaces", value: get(6), color: SAFFRON },
  ];
  const total = parts.reduce((n, p) => n + p.value, 0) || 1;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-4 w-full gap-[2px]" role="img" aria-label={parts.map((p) => `${p.label} : ${p.value}`).join(", ")}>
        {parts
          .filter((p) => p.value > 0)
          .map((p, i, arr) => (
            <Tooltip key={p.key}>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    "h-full transition-[width] duration-700",
                    i === 0 && "rounded-l-[4px]",
                    i === arr.length - 1 && "rounded-r-[4px]",
                  )}
                  style={{ width: `${(p.value / total) * 100}%`, background: p.color }}
                />
              </TooltipTrigger>
              <TooltipContent>
                {p.label} : {formatNumber(p.value)} ({Math.round((p.value / total) * 100)} %)
              </TooltipContent>
            </Tooltip>
          ))}
      </div>
      <ul className="flex flex-col gap-2.5">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-2.5 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: p.color }} />
            <span className="flex-1 text-ink-700">{p.label}</span>
            <span className="tabular font-semibold text-ink-900">{formatNumber(p.value)}</span>
            <span className="tabular w-11 text-right text-[12.5px] text-ink-500">{Math.round((p.value / total) * 100)} %</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Page section ────────────────────────────────────────────────────

/** « Statistiques » tab of the action plan (supervisor's request, 09/10). */
export function ActionStatsView({ version = 0 }: { version?: number }) {
  const { data, error, loading, reload } = useApi<ActionStats>("/company/actions/stats");
  // Figures follow live changes (a colleague completes an action…)
  useEffect(() => {
    if (version > 0) void reload();
  }, [version, reload]);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading && !data) {
    return (
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-[132px] rounded-[20px]" />
          ))}
        </div>
        <Skeleton className="h-[340px] rounded-[22px]" />
      </div>
    );
  }
  if (!data) return null;

  const t = data.totals;
  if (t.total === 0) {
    return (
      <div className="glass rounded-[22px]">
        <EmptyState
          icon="chart"
          title="Pas encore de statistiques"
          description="Les graphiques apparaîtront dès que votre entreprise aura défini ses premières actions."
        />
      </div>
    );
  }

  const domains = data.bySecteur.map((d) => ({ ...d, active: d.open - d.overdue }));
  const later = t.open - t.overdue - data.deadlines.reduce((n, d) => n + d.count, 0) - t.noDeadline;

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-5">
        <AnimatedContent>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-6">
            <Kpi icon="listChecks" label="En cours" value={t.open} sub={`${formatNumber(t.total)} actions au total`} />
            <Kpi
              icon="clock"
              label="En retard"
              value={t.overdue}
              sub={t.overdue ? "échéance dépassée" : "aucune action en retard"}
              tone={t.overdue ? "coral" : undefined}
            />
            <Kpi icon="calendar" label="Échéance ≤ 30 jours" value={t.dueSoon} sub="à terminer ce mois-ci" />
            <Kpi
              icon="target"
              label="Avancement moyen"
              value={t.averageProgress}
              suffix=" %"
              sub="des actions en cours"
              meter={t.averageProgress}
            />
            <Kpi
              icon="check"
              label="Taux de réalisation"
              value={t.completionRate}
              suffix=" %"
              sub={`${formatNumber(t.done)} action${t.done > 1 ? "s" : ""} efficace${t.done > 1 ? "s" : ""}`}
            />
            <Kpi
              icon="award"
              label="Dans les délais"
              value={t.onTimeRate}
              suffix={t.onTimeRate === null ? undefined : " %"}
              sub={t.onTimeRate === null ? "pas encore mesurable" : "des actions efficaces datées"}
            />
          </div>
        </AnimatedContent>

        <BentoGrid>
          <AnimatedContent className="md:col-span-2 xl:col-span-4">
            <BentoGridItem
              className="h-full"
              title="Activité des 12 derniers mois"
              description="Actions créées et actions devenues efficaces, mois par mois."
              action={<ChartLegend config={activityConfig} className="hidden sm:flex" />}
            >
              <ChartLegend config={activityConfig} className="sm:hidden" />
              <ChartContainer config={activityConfig} className="h-[260px]">
                <BarChart data={data.activity} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barGap={2} barCategoryGap="26%">
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={44} />
                  <ChartTooltip cursor={{ fill: "rgb(238 236 249 / 0.6)" }} content={<ChartTooltipContent />} />
                  <Bar dataKey="opened" fill="var(--color-opened)" radius={[4, 4, 0, 0]} maxBarSize={16} />
                  <Bar dataKey="done" fill="var(--color-done)" radius={[4, 4, 0, 0]} maxBarSize={16} />
                </BarChart>
              </ChartContainer>
              <DataTable
                head={["Mois", "Créées", "Devenues efficaces"]}
                rows={data.activity.map((m) => [m.label, m.opened, m.done])}
              />
            </BentoGridItem>
          </AnimatedContent>

          <AnimatedContent className="xl:col-span-2" delay={0.05}>
            <BentoGridItem className="h-full" title="Où en sont les actions" description="Répartition par statut.">
              <StatusSplit stats={data} />
            </BentoGridItem>
          </AnimatedContent>

          <AnimatedContent className="md:col-span-2 xl:col-span-3">
            <BentoGridItem
              className="h-full"
              title="Par secteur"
              description="Actions efficaces, en cours et en retard dans chaque secteur."
              action={<ChartLegend config={domainConfig} className="hidden 2xl:flex" />}
            >
              <ChartLegend config={domainConfig} className="2xl:hidden" />
              <ChartContainer config={domainConfig} style={{ height: Math.max(140, domains.length * 44 + 24) }} className="h-auto">
                <BarChart data={domains} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }} barCategoryGap={12}>
                  <XAxis type="number" hide allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={170}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: string) => shorten(v)}
                  />
                  <ChartTooltip cursor={{ fill: "rgb(238 236 249 / 0.6)" }} content={<ChartTooltipContent labelKey="name" />} />
                  <Bar dataKey="done" stackId="s" fill="var(--color-done)" stroke="#fff" strokeWidth={2} maxBarSize={22} />
                  <Bar dataKey="active" stackId="s" fill="var(--color-active)" stroke="#fff" strokeWidth={2} maxBarSize={22} />
                  <Bar
                    dataKey="overdue"
                    stackId="s"
                    fill="var(--color-overdue)"
                    stroke="#fff"
                    strokeWidth={2}
                    radius={[0, 4, 4, 0]}
                    maxBarSize={22}
                  />
                </BarChart>
              </ChartContainer>
              <DataTable
                head={["Secteur", "Efficaces", "En cours", "En retard"]}
                rows={domains.map((d) => [d.name, d.done, d.active, d.overdue])}
              />
            </BentoGridItem>
          </AnimatedContent>

          <AnimatedContent className="md:col-span-2 xl:col-span-3" delay={0.05}>
            <BentoGridItem
              className="h-full"
              title="Échéances des 6 prochains mois"
              description={
                [
                  t.overdue ? `${formatNumber(t.overdue)} déjà en retard` : null,
                  later > 0 ? `${formatNumber(later)} plus tard` : null,
                  t.noDeadline ? `${formatNumber(t.noDeadline)} sans échéance` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Actions en cours à terminer, mois par mois."
              }
            >
              <ChartContainer config={singleConfig} className="h-[220px]">
                <BarChart data={data.deadlines} margin={{ top: 20, right: 4, left: -18, bottom: 0 }} barCategoryGap="34%">
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={44} />
                  <ChartTooltip cursor={{ fill: "rgb(238 236 249 / 0.6)" }} content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} maxBarSize={24}>
                    <LabelList dataKey="count" position="top" className="fill-ink-700 text-[12px] font-semibold" />
                  </Bar>
                </BarChart>
              </ChartContainer>
            </BentoGridItem>
          </AnimatedContent>

          <AnimatedContent className="xl:col-span-2">
            <BentoGridItem className="h-full" title="Avancement des actions en cours" description="Nombre d’actions par niveau d’avancement.">
              <ChartContainer config={singleConfig} className="h-[220px]">
                <BarChart data={data.progress} margin={{ top: 20, right: 4, left: -18, bottom: 0 }} barCategoryGap="30%">
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={44} />
                  <ChartTooltip cursor={{ fill: "rgb(238 236 249 / 0.6)" }} content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} maxBarSize={24}>
                    <LabelList dataKey="count" position="top" className="fill-ink-700 text-[12px] font-semibold" />
                  </Bar>
                </BarChart>
              </ChartContainer>
            </BentoGridItem>
          </AnimatedContent>

          <AnimatedContent className="md:col-span-2 xl:col-span-4" delay={0.05}>
            <BentoGridItem className="h-full" title="Par responsable" description="Les 8 responsables qui portent le plus d’actions.">
              <div className="overflow-x-auto" data-lenis-prevent>
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-ink-150 text-xs text-ink-500">
                      <th className="py-2 pr-3 text-left font-semibold">Responsable</th>
                      <th className="px-2 py-2 text-right font-semibold">En cours</th>
                      <th className="px-2 py-2 text-right font-semibold">En retard</th>
                      <th className="px-2 py-2 text-right font-semibold">Efficaces</th>
                      <th className="w-[34%] py-2 pl-3 text-left font-semibold">Répartition</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {data.byResponsable.map((r) => {
                      const sum = r.open + r.done || 1;
                      return (
                        <tr key={r.name}>
                          <td className="max-w-[220px] truncate py-2.5 pr-3 font-medium text-ink-900">{r.name}</td>
                          <td className="tabular px-2 py-2.5 text-right text-ink-800">{formatNumber(r.open - r.overdue)}</td>
                          <td className={cn("tabular px-2 py-2.5 text-right", r.overdue ? "font-semibold text-coral-700" : "text-ink-400")}>
                            {formatNumber(r.overdue)}
                          </td>
                          <td className="tabular px-2 py-2.5 text-right text-ink-800">{formatNumber(r.done)}</td>
                          <td className="py-2.5 pl-3">
                            <span className="flex h-2.5 gap-[2px]" aria-hidden="true">
                              {[
                                { v: r.done, c: GREEN },
                                { v: r.open - r.overdue, c: INDIGO },
                                { v: r.overdue, c: CORAL },
                              ]
                                .filter((x) => x.v > 0)
                                .map((x, i, arr) => (
                                  <span
                                    key={i}
                                    className={cn(i === 0 && "rounded-l-[3px]", i === arr.length - 1 && "rounded-r-[3px]")}
                                    style={{ width: `${(x.v / sum) * 100}%`, background: x.c }}
                                  />
                                ))}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <ChartLegend config={domainConfig} />
            </BentoGridItem>
          </AnimatedContent>
        </BentoGrid>
      </div>
    </TooltipProvider>
  );
}

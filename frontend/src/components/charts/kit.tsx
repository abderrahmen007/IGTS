"use client";

import { Icon, type IconName } from "../icons";
import { CountUp } from "../reactbits/count-up";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Pieces shared by the statistics screens. Chart colours are the validated
 * tokens of globals.css (--chart-1 … --chart-5); values and labels stay in ink.
 */
export const CHART = {
  indigo: "var(--chart-1)",
  green: "var(--chart-2)",
  coral: "var(--chart-3)",
  saffron: "var(--chart-4)",
  sky: "var(--chart-5)",
};

// ─── KPI tiles ───────────────────────────────────────────────────────

export function Kpi({
  icon,
  label,
  value,
  suffix,
  sub,
  tone,
  meter,
  format,
}: {
  icon: IconName;
  label: string;
  value: number | null;
  suffix?: string;
  sub: string;
  tone?: "coral" | "ok";
  meter?: number | null;
  /** Formats the counting figure (default: whole number) */
  format?: (n: number) => string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-[20px] p-4",
        tone === "coral" ? "bg-coral-100" : "glass",
      )}
    >
      <span className={cn("flex items-center gap-2 text-[13px]", tone === "coral" ? "text-[#7a2e0c]" : "text-ink-600")}>
        <Icon name={icon} size={16} strokeWidth={1.8} />
        {label}
      </span>
      <span className={cn("tabular font-serif text-[30px] font-semibold leading-none", tone === "coral" ? "text-coral-700" : "text-ink-900")}>
        {value === null ? "—" : <CountUp to={value} format={format} />}
        {value !== null && suffix}
      </span>
      {meter !== undefined && meter !== null && (
        <span className="h-1.5 overflow-hidden rounded-full bg-brand-50" aria-hidden="true">
          <span className="block h-full rounded-full bg-brand-500 transition-[width] duration-700" style={{ width: `${meter}%` }} />
        </span>
      )}
      <span className={cn("text-[12.5px] leading-snug", tone === "coral" ? "text-[#7a2e0c]" : "text-ink-500")}>{sub}</span>
    </div>
  );
}

// ─── Table view (every chart's numbers stay readable without colour) ─

export function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="group/table text-[13px]">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 font-semibold text-brand-700 hover:underline">
        <Icon name="chevronRight" size={14} className="transition-transform group-open/table:rotate-90" />
        Voir les chiffres
      </summary>
      <div className="mt-2 overflow-x-auto rounded-xl border border-ink-150" data-lenis-prevent>
        <table className="w-full min-w-[320px]">
          <thead className="bg-paper">
            <tr>
              {head.map((h, i) => (
                <th key={h} className={cn("px-3 py-2 font-semibold text-ink-500", i ? "text-right" : "text-left")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-150">
            {rows.map((r) => (
              <tr key={String(r[0])}>
                {r.map((c, i) => (
                  <td key={i} className={cn("px-3 py-1.5", i ? "tabular text-right text-ink-900" : "text-ink-700")}>
                    {typeof c === "number" ? formatNumber(c) : c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}


// ─── Satisfaction (1 to 5): diverging bar ────────────────────────────

/**
 * Diverging scale for answers from 1 to 5: two hues (coral = dissatisfied,
 * blue = satisfied, equal steps per arm) around a neutral gray midpoint.
 */
export const LIKERT_COLORS = ["#d9622b", "#eda07c", "#e6e3dc", "#93acd9", "#4c74b8"];

export function LikertLegend({ labels }: { labels: string[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-ink-600">
      {labels.map((l, i) => (
        <li key={l} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: LIKERT_COLORS[i] }} />
          <span className="tabular font-semibold text-ink-800">{i + 1}</span> {l}
        </li>
      ))}
    </ul>
  );
}

/** One 100 % bar: share of each score, with a 2 px gap between segments and a tooltip per segment. */
export function LikertBar({ distribution, labels }: { distribution: number[]; labels: string[] }) {
  const total = distribution.reduce((a, b) => a + b, 0);
  if (!total) return <div className="h-3.5 w-full rounded-[4px] bg-ink-100" aria-label="Aucune réponse" />;
  const parts = distribution.map((n, i) => ({ n, i })).filter((p) => p.n > 0);
  return (
    <div
      className="flex h-3.5 w-full gap-[2px]"
      role="img"
      aria-label={distribution.map((n, i) => `${i + 1} (${labels[i]}) : ${n}`).join(", ")}
    >
      {parts.map((p, k) => (
        <Tooltip key={p.i}>
          <TooltipTrigger asChild>
            <span
              className={cn("h-full min-w-[3px]", k === 0 && "rounded-l-[4px]", k === parts.length - 1 && "rounded-r-[4px]")}
              style={{ width: `${(p.n / total) * 100}%`, background: LIKERT_COLORS[p.i] }}
            />
          </TooltipTrigger>
          <TooltipContent>
            {p.i + 1} — {labels[p.i]} : {formatNumber(p.n)} réponse{p.n > 1 ? "s" : ""} ({Math.round((p.n / total) * 100)} %)
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

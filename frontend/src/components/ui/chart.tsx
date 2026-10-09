"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { cn } from "@/lib/utils";

/**
 * shadcn/ui Chart: a thin layer over Recharts. Series colours come from a
 * config object and are exposed as CSS variables (--color-<key>), so marks,
 * tooltips and legends always agree.
 */
export type ChartConfig = Record<string, { label: string; color: string }>;

const ChartContext = React.createContext<{ config: ChartConfig } | null>(null);

function useChart() {
  const ctx = React.useContext(ChartContext);
  if (!ctx) throw new Error("useChart must be used inside <ChartContainer>");
  return ctx;
}

function ChartContainer({
  config,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
}) {
  const vars = Object.fromEntries(Object.entries(config).map(([k, v]) => [`--color-${k}`, v.color])) as React.CSSProperties;
  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        style={vars}
        className={cn(
          "aspect-auto h-[240px] w-full text-xs [&_.recharts-cartesian-axis-tick_text]:fill-ink-500 [&_.recharts-cartesian-grid_line]:stroke-ink-100 [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-brand-50/60 [&_.recharts-surface]:outline-none",
          className,
        )}
        {...props}
      >
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

const ChartTooltip = RechartsPrimitive.Tooltip;

interface TooltipItem {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
}

/** Tooltip card: a coloured key beside each value, text in ink (never the series colour). */
function ChartTooltipContent({
  active,
  payload,
  label,
  labelKey,
  unit,
}: {
  active?: boolean;
  payload?: TooltipItem[];
  label?: string | number;
  labelKey?: string;
  unit?: (n: number) => string;
}) {
  const { config } = useChart();
  if (!active || !payload?.length) return null;
  const title = labelKey ? String(payload[0]?.payload?.[labelKey] ?? label ?? "") : String(label ?? "");
  return (
    <div className="glass-strong min-w-[170px] rounded-xl px-3 py-2.5 text-[12.5px]">
      {title && <p className="mb-1.5 font-semibold text-ink-900">{title}</p>}
      <ul className="flex flex-col gap-1">
        {payload.map((item) => {
          const key = String(item.dataKey ?? item.name ?? "");
          const cfg = config[key];
          const n = typeof item.value === "number" ? item.value : Number(item.value);
          return (
            <li key={key} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: cfg?.color ?? item.color }} />
              <span className="flex-1 text-ink-600">{cfg?.label ?? item.name}</span>
              <span className="tabular font-semibold text-ink-900">{unit ? unit(n) : n.toLocaleString("fr-FR")}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Legend (always shown for two series or more): swatch + label in ink. */
function ChartLegend({ config, keys, className }: { config: ChartConfig; keys?: string[]; className?: string }) {
  const entries = (keys ?? Object.keys(config)).map((k) => [k, config[k]] as const).filter(([, v]) => v);
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-ink-600", className)}>
      {entries.map(([k, v]) => (
        <li key={k} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: v.color }} />
          {v.label}
        </li>
      ))}
    </ul>
  );
}

export { ChartContainer, ChartLegend, ChartTooltip, ChartTooltipContent, useChart };

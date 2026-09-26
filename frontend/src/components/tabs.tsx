"use client";

import { cn } from "./ui";
import { formatNumber } from "@/lib/format";

/** Underline tabs used as a primary filter on list pages. */
export function Tabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: string; count?: number }[];
}) {
  return (
    <div className="-mb-px flex gap-5 overflow-x-auto" role="tablist">
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value || "all"}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.value)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 border-b-2 pb-2.5 pt-1 text-[13.5px] transition-colors",
              active
                ? "border-brand-700 font-medium text-ink-950"
                : "border-transparent text-ink-600 hover:border-ink-300 hover:text-ink-900",
            )}
          >
            {it.label}
            {it.count !== undefined && (
              <span
                className={cn(
                  "tabular rounded-full px-1.5 text-xs",
                  active ? "bg-brand-50 text-brand-700" : "bg-ink-100 text-ink-600",
                )}
              >
                {formatNumber(it.count)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

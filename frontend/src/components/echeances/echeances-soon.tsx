"use client";

import Link from "next/link";
import { Icon } from "../icons";
import { cn } from "../ui";
import { useApi } from "@/lib/use-api";
import { formatDate } from "@/lib/format";
import { whenLabel, type EcheancesSummary } from "@/lib/echeances-types";

/** Company home: the checks and renewals that are late or due within 30 days. */
export function EcheancesSoon() {
  const { data } = useApi<EcheancesSummary>("/company/echeances/summary");
  if (!data || !data.next.length) return null;
  return (
    <section className="glass flex flex-col gap-3 rounded-[22px] p-5" aria-label="Échéances à surveiller">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "gem flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
            data.late ? "bg-coral-600 text-white" : "bg-saffron-500 text-[#3a2400]",
          )}
        >
          <Icon name="calendar" size={19} />
        </span>
        <p className="min-w-0 flex-1 text-[15.5px] font-semibold text-ink-900">
          {data.late ? `${data.late} échéance${data.late > 1 ? "s" : ""} en retard` : "Échéances à venir"}
          {data.late && data.soon ? ` · ${data.soon} dans les 30 jours` : ""}
        </p>
        <Link href="/dashboard/echeances" className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-brand-700 hover:underline">
          Voir tout
          <Icon name="arrowRight" size={14} />
        </Link>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {data.next.map((n) => (
          <li key={n.id} className="flex items-center gap-3 rounded-xl bg-white/70 px-3.5 py-2.5">
            <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink-800" title={n.label}>
              {n.label}
            </span>
            <span className={cn("shrink-0 text-[12.5px] font-semibold", n.daysLeft < 0 ? "text-bad-700" : "text-warn-700")} title={formatDate(n.dueOn)}>
              {whenLabel(n.daysLeft)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

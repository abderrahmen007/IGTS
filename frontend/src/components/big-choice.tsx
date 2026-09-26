"use client";

import { Icon } from "./icons";
import { Spinner, cn, toneDot } from "./ui";
import type { Tone } from "@/lib/status";

export interface ChoiceOption {
  id: number;
  label: string;
  hint?: string;
  tone: Tone;
}

/** Plain-language answers used everywhere a manager evaluates a text. */
export const APPLICABILITY_CHOICES: ChoiceOption[] = [
  { id: 1, label: "Oui, il nous concerne", hint: "Le texte s’applique à notre activité", tone: "brand" },
  { id: 2, label: "Non, il ne nous concerne pas", hint: "Notre activité n’est pas visée", tone: "neutral" },
  { id: 3, label: "Je ne sais pas encore", hint: "Je reviendrai plus tard", tone: "warn" },
];

export const COMPLIANCE_CHOICES: ChoiceOption[] = [
  { id: 1, label: "Oui, nous sommes en règle", hint: "Conforme", tone: "ok" },
  { id: 2, label: "Non, pas encore", hint: "Non conforme : une action sera nécessaire", tone: "bad" },
  { id: 3, label: "Pour information seulement", hint: "Le texte ne demande rien de concret", tone: "info" },
];

export function BigChoice({
  options,
  value,
  onChoose,
  busyId,
  columns = 3,
}: {
  options: ChoiceOption[];
  value?: number | null;
  onChoose: (id: number) => void;
  busyId?: number | null;
  columns?: 1 | 3;
}) {
  return (
    <div className={cn("grid gap-3", columns === 3 ? "sm:grid-cols-3" : "grid-cols-1")} role="radiogroup">
      {options.map((o) => {
        const selected = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={busyId != null}
            onClick={() => onChoose(o.id)}
            className={cn(
              "group flex min-h-[64px] items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all",
              "hover:-translate-y-px hover:shadow-sm active:translate-y-0 disabled:cursor-wait",
              selected ? "border-brand-700 bg-brand-50" : "border-ink-200 bg-white hover:border-ink-300",
            )}
          >
            <span
              className={cn(
                "mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                selected ? "border-brand-700 bg-brand-700" : "border-ink-300 group-hover:border-ink-400",
              )}
            >
              {selected && <Icon name="check" size={10} strokeWidth={3} className="text-white" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-[15px] font-semibold text-ink-900">
                {o.label}
                {busyId === o.id && <Spinner size={14} className="text-brand-700" />}
              </span>
              {o.hint && (
                <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-ink-500">
                  <span className={cn("h-1.5 w-1.5 rounded-full", toneDot(o.tone))} />
                  {o.hint}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

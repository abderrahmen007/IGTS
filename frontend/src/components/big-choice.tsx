"use client";

import { cn } from "./ui";
import type { Tone } from "@/lib/status";

export interface ChoiceOption {
  id: number;
  label: string;
  hint?: string;
  tone: Tone;
}

/** Plain-language answers used everywhere a manager evaluates a text. */
export const APPLICABILITY_CHOICES: ChoiceOption[] = [
  { id: 1, label: "Oui, il nous concerne", hint: "Notre activité est visée par ce texte.", tone: "brand" },
  { id: 2, label: "Non, il ne nous concerne pas", hint: "Aucune évaluation ni action ne sera demandée.", tone: "neutral" },
  { id: 3, label: "Je ne sais pas encore", hint: "Le texte reste dans « À évaluer ».", tone: "warn" },
];

export const COMPLIANCE_CHOICES: ChoiceOption[] = [
  { id: 1, label: "Oui, nous sommes en règle", hint: "Vous pourrez ajouter une action de suivi.", tone: "ok" },
  { id: 2, label: "Non, il faut agir", hint: "Décrivez l’action juste en dessous.", tone: "coral" },
  { id: 3, label: "Pour information seulement", hint: "Aucune obligation directe pour vous.", tone: "info" },
];

/**
 * Large, tactile radio choices written as sentences (instead of drop-downs).
 * The selected answer gets an indigo ring and a filled radio.
 */
export function BigChoice({
  options,
  value,
  onChoose,
  disabled,
  name,
}: {
  options: ChoiceOption[];
  value?: number | null;
  onChoose: (id: number) => void;
  disabled?: boolean;
  name: string;
}) {
  return (
    <div className="flex flex-col gap-2" role="radiogroup" aria-label={name}>
      {options.map((o) => {
        const selected = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChoose(o.id)}
            className={cn(
              "group flex w-full items-start gap-3 rounded-xl px-3.5 py-[11px] text-left transition-[background-color,box-shadow,transform] duration-150",
              "active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100",
              selected
                ? "bg-brand-50 shadow-[inset_0_0_0_2px_var(--color-brand-800)]"
                : "bg-white shadow-[inset_0_0_0_1px_var(--color-ink-200)] hover:bg-paper",
            )}
          >
            <span
              className={cn(
                "mt-px h-5 w-5 shrink-0 rounded-full bg-white transition-[border-width,border-color] duration-200",
                selected ? "border-[6px] border-brand-800" : "border-2 border-ink-300 group-hover:border-ink-400",
              )}
            />
            <span className="min-w-0">
              <span className="block text-[14.5px] font-semibold text-ink-900">{o.label}</span>
              {o.hint && <span className="mt-0.5 block text-[12.5px] text-ink-500">{o.hint}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

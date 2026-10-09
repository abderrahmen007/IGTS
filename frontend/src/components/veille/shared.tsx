"use client";

import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { VeilleDraft, VeilleRun } from "@/lib/admin-types";

/** How sure the AI is: green from 80 %, amber from 55 %, coral below. */
export function ConfidenceChip({ value, className }: { value: number; className?: string }) {
  const pct = Math.round(value * 100);
  const tone =
    value >= 0.8
      ? "bg-ok-50 text-ok-700 ring-ok-100"
      : value >= 0.55
        ? "bg-saffron-50 text-saffron-700 ring-saffron-100"
        : "bg-coral-50 text-coral-700 ring-coral-100";
  return (
    <span
      title="Certitude de l’IA que le texte concerne la veille et qu’il est bien classé"
      className={cn("inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold ring-1 ring-inset", tone, className)}
    >
      <span className="relative h-1.5 w-8 overflow-hidden rounded-full bg-current/20">
        <span className="absolute inset-y-0 left-0 rounded-full bg-current" style={{ width: `${pct}%` }} />
      </span>
      {pct} %
    </span>
  );
}

/** "Environnement › Gestion des déchets", or what is missing. */
export function Classement({ draft }: { draft: VeilleDraft }) {
  if (!draft.secteur) return <span className="font-medium text-coral-700">Secteur et thème à choisir</span>;
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1.5">
      <span>{draft.secteur.name}</span>
      <Icon name="chevronRight" size={13} className="text-ink-400" />
      {draft.theme ? <span>{draft.theme.name}</span> : <span className="font-medium text-coral-700">thème à choisir</span>}
    </span>
  );
}

export function sourceLine(d: VeilleDraft) {
  const pages = d.source.pages
    ? d.source.pages[0] === d.source.pages[1]
      ? `p. ${d.source.pages[0]}`
      : `p. ${d.source.pages[0]}–${d.source.pages[1]}`
    : null;
  return [d.source.kind === "import" ? `Import · ${d.source.issue}` : d.source.issue, pages].filter(Boolean).join(" · ");
}

export const TRIGGER_LABEL: Record<VeilleRun["trigger"], string> = {
  schedule: "Collecte de 8 h 30",
  "catch-up": "Collecte de rattrapage",
  manual: "Collecte lancée à la main",
  import: "Import d’un PDF",
};

const longDate = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

/** "demain à 08:30", "aujourd’hui à 08:30", "lundi 12 octobre à 08:30". */
export function whenLabel(iso: string) {
  const d = new Date(iso);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(new Date())) / 86_400_000);
  const prefix = diff === 0 ? "aujourd’hui" : diff === 1 ? "demain" : longDate.format(d);
  return `${prefix} à ${time.format(d)}`;
}

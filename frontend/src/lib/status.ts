import type { Ref } from "./types";

export type Tone = "ok" | "bad" | "warn" | "info" | "neutral" | "brand" | "coral";

export interface TextStatus {
  key: "conforme" | "non-conforme" | "indicatif" | "a-analyser" | "non-applicable";
  label: string;
  tone: Tone;
}

/** Ids of the legacy lookup tables (same as backend/src/company/rules.ts). */
export const APPLICABLE = 1;
export const NON_APPLICABLE = 2;
export const NON_ANALYSE = 3;
export const CONFORME = 1;
export const NON_CONFORME = 2;
export const INDICATIF = 3;
export const ACTION_EN_COURS = 1;
export const ACTION_EFFICACE = 5;
export const ACTION_NON_EFFICACE = 6;

/** Single status shown for a text, combining applicability and compliance. */
export function textStatus(applicabilite: Ref | null, etat: Ref | null): TextStatus {
  return statusFromIds(applicabilite?.id ?? null, etat?.id ?? null);
}

export function statusFromIds(applicabiliteId: number | null, etatId: number | null): TextStatus {
  if (applicabiliteId === NON_APPLICABLE) return { key: "non-applicable", label: "Non applicable", tone: "neutral" };
  if (applicabiliteId === APPLICABLE) {
    if (etatId === CONFORME) return { key: "conforme", label: "Conforme", tone: "ok" };
    if (etatId === NON_CONFORME) return { key: "non-conforme", label: "Non conforme", tone: "coral" };
    if (etatId === INDICATIF) return { key: "indicatif", label: "À titre indicatif", tone: "info" };
  }
  return { key: "a-analyser", label: "Non analysé", tone: "warn" };
}

/**
 * Mirror of the server rule (backend/src/company/rules.ts): why no action can
 * be created on a text in this state, or null when actions are allowed.
 */
export function actionBlockReason(applicabiliteId: number | null, etatId: number | null): string | null {
  if (applicabiliteId === NON_APPLICABLE) return "Ce texte ne concerne pas votre entreprise : aucune action n’est possible ni demandée.";
  if (applicabiliteId !== APPLICABLE) return "Indiquez d’abord si ce texte concerne votre entreprise.";
  if (etatId === INDICATIF) return "Ce texte est « à titre indicatif » : aucune action n’est à prévoir.";
  if (etatId !== CONFORME && etatId !== NON_CONFORME) return "Indiquez d’abord si vous êtes conforme à ce texte.";
  return null;
}

export const STATUS_OPTIONS: { value: TextStatus["key"]; label: string }[] = [
  { value: "a-analyser", label: "Non analysé" },
  { value: "conforme", label: "Conforme" },
  { value: "non-conforme", label: "Non conforme" },
  { value: "indicatif", label: "À titre indicatif" },
  { value: "non-applicable", label: "Non applicable" },
];

export function actionTone(statusId: number | null | undefined): Tone {
  if (statusId === ACTION_EFFICACE) return "ok";
  if (statusId === ACTION_NON_EFFICACE) return "coral";
  if (statusId === ACTION_EN_COURS) return "brand";
  return "neutral";
}

/** Plain-language names for action statuses. */
export const ACTION_COLUMNS = [
  { id: ACTION_EN_COURS, label: "En cours", hint: "Le travail est engagé", dot: "bg-brand-800" },
  { id: ACTION_NON_EFFICACE, label: "Non efficace", hint: "Le résultat n’est pas atteint", dot: "bg-coral-600" },
  { id: ACTION_EFFICACE, label: "Efficace", hint: "Terminée et vérifiée", dot: "bg-ok-600" },
] as const;

/** Deadline chip: tone and label from the number of days left. */
export function dueChip(dueIn: number | null | undefined, statusId?: number | null): { label: string; tone: Tone } | null {
  if (statusId === ACTION_EFFICACE) return { label: "Terminée", tone: "ok" };
  if (dueIn === null || dueIn === undefined) return null;
  if (dueIn < 0) return { label: `En retard · ${-dueIn} j`, tone: "coral" };
  if (dueIn === 0) return { label: "Aujourd’hui", tone: "warn" };
  if (dueIn === 1) return { label: "Demain", tone: "warn" };
  if (dueIn <= 7) return { label: `Dans ${dueIn} j`, tone: "warn" };
  return { label: `Dans ${dueIn} j`, tone: "neutral" };
}

export interface DomainTheme {
  dot: string;
  active: string;
  inactive: string;
  badge: string;
}

export function getDomainTheme(name: string): DomainTheme {
  const n = name.toLowerCase();
  if (n.includes("energie") || n.includes("énergie")) {
    return {
      dot: "bg-amber-500",
      active: "bg-amber-500 text-amber-950 font-bold shadow-sm ring-2 ring-amber-400",
      inactive:
        "border border-amber-300 bg-amber-100/90 text-amber-900 font-semibold hover:bg-amber-200 hover:border-amber-400",
      badge: "border border-amber-300 bg-amber-100 text-amber-900",
    };
  }
  if (n.includes("environnement")) {
    return {
      dot: "bg-emerald-600",
      active: "bg-emerald-600 text-white font-bold shadow-sm ring-2 ring-emerald-500",
      inactive:
        "border border-emerald-300 bg-emerald-100/90 text-emerald-900 font-semibold hover:bg-emerald-200 hover:border-emerald-400",
      badge: "border border-emerald-300 bg-emerald-100 text-emerald-900",
    };
  }
  if (n.includes("qualité")) {
    return {
      dot: "bg-indigo-600",
      active: "bg-indigo-600 text-white font-bold shadow-sm ring-2 ring-indigo-500",
      inactive:
        "border border-indigo-300 bg-indigo-100/90 text-indigo-900 font-semibold hover:bg-indigo-200 hover:border-indigo-400",
      badge: "border border-indigo-300 bg-indigo-100 text-indigo-900",
    };
  }
  if (n.includes("santé") || n.includes("sécurité")) {
    return {
      dot: "bg-rose-600",
      active: "bg-rose-600 text-white font-bold shadow-sm ring-2 ring-rose-500",
      inactive:
        "border border-rose-300 bg-rose-100/90 text-rose-900 font-semibold hover:bg-rose-200 hover:border-rose-400",
      badge: "border border-rose-300 bg-rose-100 text-rose-900",
    };
  }
  if (n.includes("social")) {
    return {
      dot: "bg-sky-600",
      active: "bg-sky-600 text-white font-bold shadow-sm ring-2 ring-sky-500",
      inactive:
        "border border-sky-300 bg-sky-100/90 text-sky-900 font-semibold hover:bg-sky-200 hover:border-sky-400",
      badge: "border border-sky-300 bg-sky-100 text-sky-900",
    };
  }
  if (n.includes("agroalimentaire")) {
    return {
      dot: "bg-orange-600",
      active: "bg-orange-600 text-white font-bold shadow-sm ring-2 ring-orange-500",
      inactive:
        "border border-orange-300 bg-orange-100/90 text-orange-900 font-semibold hover:bg-orange-200 hover:border-orange-400",
      badge: "border border-orange-300 bg-orange-100 text-orange-900",
    };
  }
  return {
    dot: "bg-ink-400",
    active: "bg-brand-900 text-white font-bold shadow-sm ring-2 ring-brand-900",
    inactive:
      "border border-ink-300 bg-ink-100/90 text-ink-800 font-semibold hover:bg-ink-200 hover:border-ink-400",
    badge: "border border-ink-300 bg-ink-100 text-ink-800",
  };
}

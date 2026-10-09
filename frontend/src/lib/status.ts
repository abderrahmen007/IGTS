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
  if (applicabiliteId === NON_APPLICABLE) return { key: "non-applicable", label: "Ne nous concerne pas", tone: "neutral" };
  if (applicabiliteId === APPLICABLE) {
    if (etatId === CONFORME) return { key: "conforme", label: "En règle", tone: "ok" };
    if (etatId === NON_CONFORME) return { key: "non-conforme", label: "À mettre en règle", tone: "coral" };
    if (etatId === INDICATIF) return { key: "indicatif", label: "Pour information", tone: "info" };
  }
  return { key: "a-analyser", label: "À évaluer", tone: "warn" };
}

/**
 * Mirror of the server rule (backend/src/company/rules.ts): why no action can
 * be created on a text in this state, or null when actions are allowed.
 */
export function actionBlockReason(applicabiliteId: number | null, etatId: number | null): string | null {
  if (applicabiliteId === NON_APPLICABLE) return "Ce texte ne concerne pas votre entreprise : aucune action n’est possible ni demandée.";
  if (applicabiliteId !== APPLICABLE) return "Indiquez d’abord si ce texte concerne votre entreprise.";
  if (etatId === INDICATIF) return "Ce texte est « pour information » : aucune action n’est à prévoir.";
  if (etatId !== CONFORME && etatId !== NON_CONFORME) return "Indiquez d’abord si vous êtes en règle avec ce texte.";
  return null;
}

export const STATUS_OPTIONS: { value: TextStatus["key"]; label: string }[] = [
  { value: "a-analyser", label: "À évaluer" },
  { value: "conforme", label: "En règle" },
  { value: "non-conforme", label: "À mettre en règle" },
  { value: "indicatif", label: "Pour information" },
  { value: "non-applicable", label: "Ne nous concerne pas" },
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
  { id: ACTION_NON_EFFICACE, label: "À reprendre", hint: "Non efficace", dot: "bg-coral-600" },
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
      dot: "bg-saffron-500",
      active: "bg-saffron-500 text-ink-950 font-bold shadow-sm ring-1 ring-saffron-500",
      inactive:
        "border border-saffron-200/90 bg-saffron-50/60 text-saffron-800 hover:bg-saffron-100 hover:border-saffron-400",
      badge: "border border-saffron-200 bg-saffron-50 text-saffron-800",
    };
  }
  if (n.includes("environnement")) {
    return {
      dot: "bg-ok-600",
      active: "bg-ok-600 text-white font-bold shadow-sm ring-1 ring-ok-600",
      inactive:
        "border border-ok-200/90 bg-ok-50/60 text-ok-800 hover:bg-ok-100 hover:border-ok-400",
      badge: "border border-ok-200 bg-ok-50 text-ok-800",
    };
  }
  if (n.includes("qualité")) {
    return {
      dot: "bg-brand-600",
      active: "bg-brand-700 text-white font-bold shadow-sm ring-1 ring-brand-700",
      inactive:
        "border border-brand-200/90 bg-brand-50/60 text-brand-800 hover:bg-brand-100 hover:border-brand-400",
      badge: "border border-brand-200 bg-brand-50 text-brand-800",
    };
  }
  if (n.includes("santé") || n.includes("sécurité")) {
    return {
      dot: "bg-coral-600",
      active: "bg-coral-600 text-white font-bold shadow-sm ring-1 ring-coral-600",
      inactive:
        "border border-coral-200/90 bg-coral-50/60 text-coral-800 hover:bg-coral-100 hover:border-coral-400",
      badge: "border border-coral-200 bg-coral-50 text-coral-800",
    };
  }
  if (n.includes("social")) {
    return {
      dot: "bg-info-600",
      active: "bg-info-600 text-white font-bold shadow-sm ring-1 ring-info-600",
      inactive:
        "border border-info-200/90 bg-info-50/60 text-info-800 hover:bg-info-100 hover:border-info-400",
      badge: "border border-info-200 bg-info-50 text-info-800",
    };
  }
  if (n.includes("agroalimentaire")) {
    return {
      dot: "bg-saffron-600",
      active: "bg-saffron-600 text-white font-bold shadow-sm ring-1 ring-saffron-600",
      inactive:
        "border border-saffron-200/90 bg-saffron-50/60 text-saffron-800 hover:bg-saffron-100 hover:border-saffron-400",
      badge: "border border-saffron-200 bg-saffron-50 text-saffron-800",
    };
  }
  return {
    dot: "bg-ink-400",
    active: "bg-brand-900 text-white font-bold shadow-sm ring-1 ring-brand-900",
    inactive:
      "border border-ink-200/90 bg-white text-ink-700 hover:border-brand-300 hover:text-brand-900",
    badge: "border border-ink-200 bg-ink-50 text-ink-700",
  };
}

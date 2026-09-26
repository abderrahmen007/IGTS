import type { Ref } from "./types";

export type Tone = "ok" | "bad" | "warn" | "info" | "neutral" | "brand";

export interface TextStatus {
  key: "conforme" | "non-conforme" | "indicatif" | "a-analyser" | "non-applicable";
  label: string;
  tone: Tone;
}

/** Single status shown for a text, combining applicability and compliance. */
export function textStatus(applicabilite: Ref | null, etat: Ref | null): TextStatus {
  if (applicabilite?.id === 2) return { key: "non-applicable", label: "Non applicable", tone: "neutral" };
  if (applicabilite?.id === 1) {
    if (etat?.id === 1) return { key: "conforme", label: "Conforme", tone: "ok" };
    if (etat?.id === 2) return { key: "non-conforme", label: "Non conforme", tone: "bad" };
    if (etat?.id === 3) return { key: "indicatif", label: "À titre indicatif", tone: "info" };
  }
  return { key: "a-analyser", label: "À analyser", tone: "warn" };
}

export const STATUS_OPTIONS: { value: TextStatus["key"]; label: string }[] = [
  { value: "a-analyser", label: "À analyser" },
  { value: "conforme", label: "Conforme" },
  { value: "non-conforme", label: "Non conforme" },
  { value: "indicatif", label: "À titre indicatif" },
  { value: "non-applicable", label: "Non applicable" },
];

export function actionTone(statusId: number | null | undefined): Tone {
  if (statusId === 5) return "ok";
  if (statusId === 6) return "bad";
  if (statusId === 1) return "brand";
  return "neutral";
}

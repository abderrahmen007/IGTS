import type { Ref } from "./types";

export type Tone = "ok" | "bad" | "warn" | "info" | "neutral" | "brand";

export interface TextStatus {
  key: "conforme" | "non-conforme" | "indicatif" | "a-analyser" | "non-applicable";
  label: string;
  tone: Tone;
}

/** Single status shown for a text, combining applicability and compliance. */
export function textStatus(applicabilite: Ref | null, etat: Ref | null): TextStatus {
  if (applicabilite?.id === 2) return { key: "non-applicable", label: "Ne nous concerne pas", tone: "neutral" };
  if (applicabilite?.id === 1) {
    if (etat?.id === 1) return { key: "conforme", label: "En règle", tone: "ok" };
    if (etat?.id === 2) return { key: "non-conforme", label: "À mettre en règle", tone: "bad" };
    if (etat?.id === 3) return { key: "indicatif", label: "Pour information", tone: "info" };
  }
  return { key: "a-analyser", label: "À évaluer", tone: "warn" };
}

export const STATUS_OPTIONS: { value: TextStatus["key"]; label: string }[] = [
  { value: "a-analyser", label: "À évaluer" },
  { value: "conforme", label: "En règle" },
  { value: "non-conforme", label: "À mettre en règle" },
  { value: "indicatif", label: "Pour information" },
  { value: "non-applicable", label: "Ne nous concerne pas" },
];

export function actionTone(statusId: number | null | undefined): Tone {
  if (statusId === 5) return "ok";
  if (statusId === 6) return "bad";
  if (statusId === 1) return "brand";
  return "neutral";
}

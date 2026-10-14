import type { IconName } from "@/components/icons";

export type EcheanceCategory = "vehicules" | "controles" | "equipements" | "personnel" | "autorisations" | "assurances" | "autres";
export type EcheanceStatus = "late" | "soon" | "ok";

export const CATEGORIES: { value: EcheanceCategory; label: string; icon: IconName }[] = [
  { value: "vehicules", label: "Véhicules", icon: "truck" },
  { value: "controles", label: "Contrôles réglementaires", icon: "shield" },
  { value: "equipements", label: "Équipements", icon: "wrench" },
  { value: "personnel", label: "Personnel", icon: "heartPulse" },
  { value: "autorisations", label: "Autorisations et agréments", icon: "stamp" },
  { value: "assurances", label: "Assurances", icon: "umbrella" },
  { value: "autres", label: "Autres", icon: "dots" },
];
export const categoryOf = (c: EcheanceCategory) => CATEGORIES.find((x) => x.value === c) ?? CATEGORIES[CATEGORIES.length - 1];

export interface LinkedText {
  id: number;
  titre: string;
  num: string | null;
  /** The company's copy (link to « Mes textes »), when it has one */
  tsId: number | null;
}

export interface EcheanceHistory {
  doneOn: string;
  nextDue: string;
  by: string;
  at: string;
  note: string | null;
}

export interface Echeance {
  id: number;
  companyId: number;
  company: string | null;
  typeId: number | null;
  type: { id: number; label: string } | null;
  category: EcheanceCategory;
  label: string;
  title: string;
  reference: string | null;
  everyMonths: number | null;
  lastDone: string | null;
  dueOn: string;
  status: EcheanceStatus;
  daysLeft: number;
  responsible: { name: string; email: string | null } | null;
  textIds: number[];
  texts: LinkedText[];
  notes: string | null;
  createdBy: string;
  history: EcheanceHistory[];
}

export interface EcheanceType {
  id: number;
  category: EcheanceCategory;
  label: string;
  everyMonths: number | null;
  textIds: number[];
  texts: LinkedText[];
  notes: string | null;
  toConfirm: boolean;
  active: boolean;
  used: number;
}

export interface EcheancesList {
  items: Echeance[];
  counts: { late: number; soon: number; ok: number; total: number };
  types: EcheanceType[];
}

export interface EcheancesSummary {
  late: number;
  soon: number;
  next: { id: number; label: string; dueOn: string; daysLeft: number }[];
}

/** « en retard de 9 jours », « dans 7 jours », « aujourd’hui » */
export function whenLabel(days: number): string {
  if (days === 0) return "aujourd’hui";
  if (days === 1) return "demain";
  if (days > 0) return `dans ${days} jours`;
  return days === -1 ? "en retard d’un jour" : `en retard de ${-days} jours`;
}

export function everyLabel(months: number | null): string {
  if (!months) return "Date fixée par le document";
  if (months === 12) return "Tous les ans";
  if (months % 12 === 0) return `Tous les ${months / 12} ans`;
  return months === 1 ? "Tous les mois" : `Tous les ${months} mois`;
}

/** YYYY-MM-DD + n months (same rule as the API). */
export function addMonths(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(d, last));
  return date.toISOString().slice(0, 10);
}

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

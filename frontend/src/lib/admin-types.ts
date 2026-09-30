import type { ComplianceStats, Ref } from "./types";

export interface CatalogSecteur {
  id: number;
  name: string;
  themes: { id: number; name: string }[];
}

export interface SubAccount {
  id: number;
  nom: string;
  email: string;
  tel: string | null;
  fonction: string | null;
  active: boolean;
  /** "Tous les droits" (evaluate and act) vs read-only */
  canEdit: boolean;
  createdAt: string;
}

export interface CompanyDetail {
  company: {
    id: number;
    raisonsociale: string | null;
    nom: string;
    email: string;
    tel: string | null;
    fonction: string | null;
    adresse: string | null;
    ville: string | null;
    matriculeFiscal: string | null;
    active: boolean;
    createdAt: string;
    lastActivity: string | null;
  };
  stats: ComplianceStats;
  subscriptions: { secteurIds: number[]; themeIds: number[] };
  catalog: CatalogSecteur[];
  subAccounts: SubAccount[];
}

export interface CompanyForm {
  raisonsociale: string;
  nom: string;
  email: string;
  tel: string;
  fonction: string;
  adresse: string;
  ville: string;
  matriculeFiscal: string;
}

export interface AdminTextDetail {
  id: number;
  titre: string;
  description: string;
  journal: string;
  date: string;
  num: string;
  type: Ref | null;
  secteur: Ref | null;
  theme: Ref | null;
  pdfUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  companies: {
    texteSocieteId: number;
    assignedAt: string | null;
    company: { id: number; nom: string; raisonsociale: string | null } | null;
    applicabilite: Ref;
    etat: Ref | null;
  }[];
  distributedTo?: number;
}

export interface ReferenceData {
  secteurs: {
    id: number;
    name: string;
    texts: number;
    themes: { id: number; name: string; secteurId: number | null; texts: number; companies: number }[];
  }[];
  types: { id: number; name: string; texts: number }[];
}

export interface AdminUser {
  id: number;
  nomComplet: string;
  username: string;
  email: string;
  active: boolean;
  needsPasswordReset: boolean;
}

/** Generates a readable random password (no ambiguous characters). */
export function generatePassword(length = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

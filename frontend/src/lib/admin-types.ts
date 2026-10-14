import type { ComplianceStats, Ref, SubscriptionInfo } from "./types";

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
  /** Added by the company: waiting for IGTS to set its password */
  pending?: boolean;
}

export interface SubscriptionHistoryItem {
  at: string;
  by: string;
  action: "started" | "renewed" | "dates" | "suspended" | "resumed";
  note: string;
}

export interface CompanyDetail {
  subscription: SubscriptionInfo & { history: SubscriptionHistoryItem[] };
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

// ─── Automatic watch (JORT collection, AI drafts) ───────────────────

export type DraftStatus = "pending" | "published" | "rejected";

export interface DraftActor {
  id: number;
  nom: string;
  via: "email" | "platform";
}

export interface VeilleDraft {
  id: number;
  status: DraftStatus;
  createdAt: string;
  updatedAt: string;
  titre: string;
  description: string;
  journal: string;
  date: string;
  num: string;
  type: Ref | null;
  secteur: Ref | null;
  theme: Ref | null;
  pdfUrl: string | null;
  issuePdfUrl: string | null;
  ai: {
    model: string;
    confidence: number;
    reason: string;
    keyPoints: string[];
    ministere: string;
    signedOn: string;
    needsReview: string[];
  };
  source: {
    kind: "iort" | "import";
    issue: string;
    issueKey: string;
    pages: [number, number] | null;
    url: string | null;
  };
  /** Type, sector and theme are set: the draft can be published as is */
  ready: boolean;
  /** Companies subscribed to the theme, which will receive the text */
  companies: number;
  duplicateOf: { id: number; titre: string } | null;
  publishedTextId: number | null;
  publishedAt: string | null;
  publishedBy: DraftActor | null;
  rejectedAt: string | null;
  rejectedBy: DraftActor | null;
  rejectReason: string | null;
}

export interface DraftList {
  counts: Record<DraftStatus, number>;
  items: VeilleDraft[];
}

export interface VeilleRun {
  id: number;
  trigger: "schedule" | "manual" | "catch-up" | "import";
  startedAt: string;
  finishedAt: string | null;
  status: "running" | "ok" | "nothing-new" | "error";
  message: string;
  issues: string[];
  drafts: number;
  steps: string[];
}

export interface VeilleStatus {
  enabled: boolean;
  schedule: string;
  nextRun: string | null;
  aiAvailable: boolean;
  aiModel: string;
  running: VeilleRun | null;
  runs: VeilleRun[];
  issues: { key: string; label: string; processedAt: string; drafts: number; ignored: number }[];
  pending: number;
}

export interface DraftPublishResult {
  textId: number;
  distributedTo: number;
  draft: VeilleDraft;
}

// ─── Statistics (admin) ─────────────────────────────────────────────

export interface ActivityEvent {
  at: string;
  type: "login" | "subscription" | "account" | "feedback" | "text-published" | "veille" | "echeance";
  actor: { kind: "admin" | "company" | "system"; id: number | null; nom: string };
  companyId: number | null;
  label: string;
}

export interface AdminStats {
  generatedAt: string;
  clients: {
    companies: number;
    subAccounts: number;
    accountsToActivate: number;
    subscriptions: Record<"none" | "active" | "expiring" | "expired" | "suspended", number>;
    toFollow: { id: number; name: string; status: "expiring" | "expired" | "suspended"; end: string | null; daysLeft: number | null }[];
  };
  engagement: {
    activeCompanies: number;
    openCompanies: number;
    inactive: { id: number; name: string; lastLogin: string | null }[];
  };
  activity: {
    month: string;
    label: string;
    logins: number;
    evaluations: number;
    actionsCreated: number;
    actionsDone: number;
    textsPublished: number;
    newClients: number;
  }[];
  compliance: {
    average: number | null;
    rated: number;
    notRated: number;
    buckets: { label: string; count: number }[];
    lowest: { id: number; name: string; rate: number | null; toAnalyse: number; nonConforme: number }[];
    highest: { id: number; name: string; rate: number | null; toAnalyse: number; nonConforme: number }[];
    toAnalyse: number;
  };
  texts: {
    total: number;
    last30: number;
    assignments: number;
    evaluatedShare: number | null;
    drafts: number;
    bySecteur: { name: string; count: number }[];
    byType: { name: string; count: number }[];
  };
  feedback: { id: number; title: string; open: boolean; respondents: number; companies: number; average: number | null } | null;
  recent: ActivityEvent[];
}

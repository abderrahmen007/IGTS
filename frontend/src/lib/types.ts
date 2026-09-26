/** Response shapes of the NestJS API (see backend/src/company and backend/src/admin). */

export interface Ref {
  id: number;
  name: string | null;
}

export interface ComplianceStats {
  total: number;
  applicable: number;
  nonApplicable: number;
  toAnalyse: number;
  conforme: number;
  nonConforme: number;
  indicatif: number;
  complianceRate: number | null;
}

export interface TextListItem {
  id: number;
  texteId: number;
  titre: string;
  num: string;
  journal: string;
  date: string;
  excerpt: string;
  type: Ref | null;
  secteur: Ref | null;
  applicabilite: Ref;
  etat: Ref | null;
  assignedAt: string | null;
  evaluatedAt: string | null;
  evaluatedBy: string | null;
  actionsCount?: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface CompanyOverview {
  company: { nom?: string; raisonsociale?: string | null; lastLogin?: string | null };
  stats: ComplianceStats & { openActions: number; unreadNotifications: number };
  bySecteur: (ComplianceStats & { id: number; name: string })[];
  recentTexts: TextListItem[];
}

export interface CompanyFilters {
  secteurs: { id: number; name: string; count: number }[];
  types: Ref[];
  applicabilites: Ref[];
  etats: Ref[];
  actionStates: Ref[];
}

export interface ActionPlan {
  id: number;
  texteSocieteId: number | null;
  description: string;
  responsable: string | null;
  telephone: string | null;
  delai: string | null;
  dateOuverture: string | null;
  dateCloture: string | null;
  effectivite: number | null;
  status: Ref | null;
  createdAt: string | null;
  createdBy: string | null;
  texteTitre?: string;
}

export interface TextDetail {
  id: number;
  texte: {
    id: number;
    titre: string;
    num: string;
    journal: string;
    date: string;
    description: string;
    type: Ref | null;
    theme: Ref | null;
    secteur: Ref | null;
    pdfUrl: string | null;
    addedAt: string | null;
  };
  assignedAt: string | null;
  applicabilite: Ref;
  etat: Ref | null;
  comment: string | null;
  evaluatedAt: string | null;
  evaluatedBy: string | null;
  history: { id: number; date: string | null; by: string | null; etat: string | null; applicabilite: string | null }[];
  actions: ActionPlan[];
  options: { applicabilites: Ref[]; etats: Ref[]; actionStates: Ref[] };
}

export interface ActionsResponse {
  items: ActionPlan[];
  counts: { total: number; byStatus: (Ref & { count: number })[] };
  actionStates: Ref[];
}

export interface NotificationsResponse {
  unread: number;
  items: {
    id: number;
    message: string | null;
    texteTitre: string | null;
    texteSocieteId: number | null;
    createdAt: string | null;
    read: boolean;
  }[];
}

export interface AdminOverview {
  stats: {
    companies: number;
    subAccounts: number;
    texts: number;
    textsLast30: number;
    assignments: number;
    compliance: ComplianceStats;
  };
  recentCompanies: {
    id: number;
    nom: string;
    raisonsociale: string | null;
    email: string;
    createdAt: string;
    activated: boolean;
    stats?: ComplianceStats;
  }[];
  recentTexts: {
    id: number;
    titre: string;
    date: string;
    journal: string;
    type: string | null;
    secteur: string | null;
    createdAt: string | null;
    assignments: number;
  }[];
}

export interface AdminCompany {
  id: number;
  nom: string;
  raisonsociale: string | null;
  email: string;
  ville: string | null;
  tel: string | null;
  fonction: string | null;
  createdAt: string;
  updatedAt: string | null;
  activated: boolean;
  subAccounts: number;
  stats?: ComplianceStats;
}

export interface AdminText {
  id: number;
  titre: string;
  num: string;
  journal: string;
  date: string;
  type: string | null;
  secteur: string | null;
  theme: string | null;
  createdAt: string | null;
  hasPdf: boolean;
  assignments: number;
}

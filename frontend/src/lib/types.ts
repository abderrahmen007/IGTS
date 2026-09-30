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
  /** IGTS changed the text after the company's last evaluation */
  updatedSinceEvaluation?: boolean;
  actionsCount?: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface UpcomingAction {
  id: number;
  texteSocieteId: number | null;
  description: string;
  responsable: string | null;
  dateCloture: string | null;
  dueIn: number | null;
  texteTitre: string;
  theme: string | null;
}

export interface CompanyOverview {
  company: { nom?: string; raisonsociale?: string | null; lastLogin?: string | null };
  me: { nom: string; canEdit: boolean };
  stats: ComplianceStats & {
    openActions: number;
    overdueActions: number;
    /** Non-compliant texts that have no action yet */
    nonConformeSansAction: number;
    unreadNotifications: number;
  };
  bySecteur: (ComplianceStats & { id: number; name: string })[];
  recentTexts: TextListItem[];
  nextToEvaluate: TextListItem[];
  upcomingActions: UpcomingAction[];
}

export interface Counters {
  toEvaluate: number;
  overdueActions: number;
  openActions: number;
  unreadNotifications: number;
}

export interface CompanyFilters {
  secteurs: { id: number; name: string; count: number }[];
  types: Ref[];
  applicabilites: Ref[];
  etats: Ref[];
  actionStates: Ref[];
}

export interface ActionFile {
  name: string;
  url: string;
}

export interface ActionPlan {
  id: number;
  texteSocieteId: number | null;
  number: string | null;
  description: string;
  responsable: string | null;
  telephone: string | null;
  delai: string | null;
  dateOuverture: string | null;
  dateCloture: string | null;
  /** Days until the planned closing date (negative = late) */
  dueIn: number | null;
  effectivite: number | null;
  status: Ref | null;
  files: ActionFile[];
  createdAt: string | null;
  createdBy: string | null;
  updatedAt: string | null;
  /** The text no longer calls for action: kept, but paused */
  onHold?: boolean;
  texte?: {
    titre: string;
    num: string;
    type: string | null;
    secteur: string | null;
    theme: string | null;
    compliant: boolean;
  };
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
    updatedAt: string | null;
  };
  assignedAt: string | null;
  applicabilite: Ref;
  etat: Ref | null;
  comment: string | null;
  evaluatedAt: string | null;
  evaluatedBy: string | null;
  updatedSinceEvaluation: boolean;
  permissions: { canEdit: boolean; actionsAllowed: boolean; actionBlockReason: string | null };
  /** Every action is effective: propose to mark the text compliant */
  suggestCompliance: boolean;
  history: { id: number; date: string | null; by: string | null; etat: string | null; applicabilite: string | null }[];
  actions: ActionPlan[];
  options: { applicabilites: Ref[]; etats: Ref[]; actionStates: Ref[] };
}

export interface ActionsResponse {
  items: ActionPlan[];
  counts: {
    total: number;
    open: number;
    overdue: number;
    /** Open actions paused because their text no longer calls for action */
    onHold: number;
    byStatus: (Ref & { count: number })[];
    averageProgress: number | null;
  };
  readyForCompliance: { texteSocieteId: number; titre: string }[];
  actionStates: Ref[];
  canEdit: boolean;
}

export interface Preferences {
  emailNewTexts: boolean;
  emailReminders: boolean;
  tourSeenAt: string | null;
}

export interface Profile {
  id: number;
  nom: string;
  email: string;
  fonction: string | null;
  tel: string | null;
  company: string;
  isSubAccount: boolean;
  canEdit: boolean;
  memberSince: string | null;
  stats: { evaluatedThisMonth: number; openActionsCreated: number };
  secteurs: Ref[];
  preferences: Preferences;
}

export interface TeamMember {
  id: number;
  nom: string;
  email: string;
  fonction: string | null;
  isMain: boolean;
  canEdit: boolean;
  active: boolean;
  isMe: boolean;
  since: string | null;
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

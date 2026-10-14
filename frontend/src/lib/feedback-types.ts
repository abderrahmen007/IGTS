export interface FeedbackQuestion {
  id: string;
  label: string;
  kind: "rating" | "text";
  required: boolean;
}

/** What a company account sees: the open survey (if any) and whether it answered. */
export interface CompanyFeedback {
  campaign: { id: number; title: string; closesOn: string; questions: FeedbackQuestion[] } | null;
  answered: boolean;
}

export interface FeedbackCampaign {
  id: number;
  title: string;
  year: number;
  openedAt: string;
  closesOn: string;
  closedAt: string | null;
  trigger: "auto" | "manual";
  openedBy: string;
  questions: FeedbackQuestion[];
  open: boolean;
  respondents: number;
  companies: number;
  average: number | null;
}

export interface FeedbackOverview {
  questions: FeedbackQuestion[];
  current: number | null;
  campaigns: FeedbackCampaign[];
}

export type FeedbackQuestionResult =
  | (FeedbackQuestion & { kind: "rating"; count: number; average: number | null; distribution: number[] })
  | (FeedbackQuestion & { kind: "text"; count: number; comments: { nom: string; company: string; text: string; at: string }[] });

export interface FeedbackResults {
  campaign: FeedbackCampaign;
  respondents: number;
  companiesAnswered: number;
  companiesTotal: number;
  average: number | null;
  questions: FeedbackQuestionResult[];
  byCompany: { companyId: number; company: string; respondents: number; average: number | null }[];
}

export const RATING_LABELS = ["Pas du tout", "Peu", "Moyennement", "Plutôt oui", "Tout à fait"];

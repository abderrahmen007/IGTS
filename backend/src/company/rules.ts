import { Prisma } from '@prisma/client';

/**
 * Business rules of the evaluation and of action plans, kept apart from the
 * services so they are easy to read, test and change.
 *
 * Reference: legacy Symfony templates (textesociete/textedetailparsecteur)
 * and FrontCompanyController.
 */

/** Ids of the legacy lookup tables. */
export const APPLICABLE = 1;
export const NON_APPLICABLE = 2;
export const APPLICABILITE_NON_ANALYSEE = 3;

export const CONFORME = 1;
export const NON_CONFORME = 2;
export const INDICATIF = 3;
export const ETAT_NON_ANALYSE = 4;

export const ACTION_EN_COURS = 1;
export const ACTION_EFFICACE = 5;
export const ACTION_NON_EFFICACE = 6;
/** Statuses of an action that still needs work. */
export const OPEN_ACTION_STATES = [ACTION_EN_COURS, ACTION_NON_EFFICACE];

export interface EvaluationState {
  applicabiliteId: number | null | undefined;
  gestionetatId: number | null | undefined;
}

/**
 * Why no action can be created or changed on a text in this state, or null
 * when actions are allowed.
 *
 * Symfony allows actions only on an applicable text whose state is not
 * "À titre indicatif". The new platform also asks the company to say whether
 * it is compliant first (Conforme / Non conforme), so every action is attached
 * to a known situation.
 */
export function actionBlockReason(s: EvaluationState): string | null {
  if (s.applicabiliteId === NON_APPLICABLE) {
    return 'Ce texte ne concerne pas votre entreprise : aucune action n’est possible ni demandée.';
  }
  if (s.applicabiliteId !== APPLICABLE) {
    return 'Indiquez d’abord si ce texte concerne votre entreprise.';
  }
  if (s.gestionetatId === INDICATIF) {
    return 'Ce texte est « pour information » : aucune action n’est à prévoir.';
  }
  if (s.gestionetatId !== CONFORME && s.gestionetatId !== NON_CONFORME) {
    return 'Indiquez d’abord si vous êtes en règle avec ce texte.';
  }
  return null;
}

export const actionsAllowed = (s: EvaluationState) => actionBlockReason(s) === null;

/**
 * Texts whose actions are "live". Actions attached to any other text are kept
 * (nothing is deleted) but put on hold: they are left out of counters, badges
 * and deadline reminders until the company changes its evaluation back.
 */
export const LIVE_ACTIONS_TEXT: Prisma.TexteSocieteWhereInput = {
  applicabiliteId: APPLICABLE,
  gestionetatId: { in: [CONFORME, NON_CONFORME] },
};

/** Normalises the evaluation sent by the client: no compliance state unless applicable. */
export function normaliseEvaluation(applicabiliteId: number, gestionetatId?: number | null): EvaluationState {
  return {
    applicabiliteId,
    gestionetatId: applicabiliteId === APPLICABLE ? (gestionetatId ?? null) : null,
  };
}

/**
 * When every action of a non-compliant text is effective, the company is
 * invited to mark the text compliant (the legacy app never asked, which left
 * texts "Non conforme" although the work was done).
 */
export function suggestsCompliance(
  s: EvaluationState,
  actionStates: (number | null)[],
): boolean {
  return (
    s.applicabiliteId === APPLICABLE &&
    s.gestionetatId === NON_CONFORME &&
    actionStates.length > 0 &&
    actionStates.every((a) => a === ACTION_EFFICACE)
  );
}

/** Legacy dates are "dd/mm/yyyy" strings. Days from today (negative = late), or null. */
export function daysUntil(frenchDate: string | null | undefined, today = new Date()): number | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((frenchDate ?? '').trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / 86_400_000);
}

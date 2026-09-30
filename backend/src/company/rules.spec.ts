import {
  ACTION_EFFICACE,
  ACTION_EN_COURS,
  APPLICABILITE_NON_ANALYSEE,
  APPLICABLE,
  CONFORME,
  ETAT_NON_ANALYSE,
  INDICATIF,
  NON_APPLICABLE,
  NON_CONFORME,
  actionBlockReason,
  actionsAllowed,
  daysUntil,
  normaliseEvaluation,
  suggestsCompliance,
} from './rules';
import { canEditFromRights } from '../common/auth-user';

describe('actions allowed (Symfony parity + evaluate first)', () => {
  const cases: [string, number, number | null, boolean][] = [
    ['non analysé', APPLICABILITE_NON_ANALYSEE, null, false],
    ['non applicable', NON_APPLICABLE, null, false],
    ['applicable, état vide', APPLICABLE, null, false],
    ['applicable, état non analysé', APPLICABLE, ETAT_NON_ANALYSE, false],
    ['applicable, à titre indicatif', APPLICABLE, INDICATIF, false],
    ['applicable, conforme', APPLICABLE, CONFORME, true],
    ['applicable, non conforme', APPLICABLE, NON_CONFORME, true],
  ];
  it.each(cases)('%s', (_label, applicabiliteId, gestionetatId, expected) => {
    expect(actionsAllowed({ applicabiliteId, gestionetatId })).toBe(expected);
    expect(actionBlockReason({ applicabiliteId, gestionetatId }) === null).toBe(expected);
  });

  it('explains why a non-applicable text has no actions (supervisor case)', () => {
    expect(actionBlockReason({ applicabiliteId: NON_APPLICABLE, gestionetatId: null })).toMatch(/ne concerne pas/);
  });
});

describe('normaliseEvaluation', () => {
  it('drops the compliance state when the text is not applicable', () => {
    expect(normaliseEvaluation(NON_APPLICABLE, NON_CONFORME)).toEqual({ applicabiliteId: NON_APPLICABLE, gestionetatId: null });
  });
  it('keeps it when applicable', () => {
    expect(normaliseEvaluation(APPLICABLE, CONFORME)).toEqual({ applicabiliteId: APPLICABLE, gestionetatId: CONFORME });
  });
});

describe('suggestsCompliance', () => {
  const nc = { applicabiliteId: APPLICABLE, gestionetatId: NON_CONFORME };
  it('when every action is effective', () => {
    expect(suggestsCompliance(nc, [ACTION_EFFICACE, ACTION_EFFICACE])).toBe(true);
  });
  it('not while one action is still open', () => {
    expect(suggestsCompliance(nc, [ACTION_EFFICACE, ACTION_EN_COURS])).toBe(false);
  });
  it('not without actions, nor on a compliant text', () => {
    expect(suggestsCompliance(nc, [])).toBe(false);
    expect(suggestsCompliance({ ...nc, gestionetatId: CONFORME }, [ACTION_EFFICACE])).toBe(false);
  });
});

describe('daysUntil', () => {
  const today = new Date(2026, 8, 30);
  it('parses legacy dd/mm/yyyy dates', () => {
    expect(daysUntil('07/10/2026', today)).toBe(7);
    expect(daysUntil('29/09/2026', today)).toBe(-1);
  });
  it('returns null for free text', () => {
    expect(daysUntil('3 mois', today)).toBeNull();
    expect(daysUntil(null, today)).toBeNull();
  });
});

describe('sub-account rights', () => {
  it('main account can always edit', () => expect(canEditFromRights(0, null)).toBe(true));
  it('"Tous les droits" can edit', () => expect(canEditFromRights(207, 2)).toBe(true));
  it('empty right can edit (legacy: null)', () => expect(canEditFromRights(207, null)).toBe(true));
  it('"Annuler tous les droits" is read-only', () => expect(canEditFromRights(207, 1)).toBe(false));
  it('legacy id 5 is read-only', () => expect(canEditFromRights(207, 5)).toBe(false));
});

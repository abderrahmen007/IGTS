import {
  contentHash,
  decodeVector,
  dot,
  encodeVector,
} from './embeddings.service';
import {
  lexicalScores,
  questionStems,
  renumberCitations,
  selectTexts,
} from './retrieval';

const QUESTION =
  'what are the medical obligations that must apply to the domains I work with';

const docs = [
  {
    id: 1,
    title:
      'Arrêté du 25 avril 2006 fixant les modalités de prise en charge des frais de soins et des appareils de prothèse pour les personnes handicapées',
    body: 'Santé publique. Prise en charge des frais de soins.',
  },
  {
    id: 2,
    title:
      'Décret n° 2000-1985 relatif à l’organisation de la médecine du travail',
    body: 'Santé et sécurité au travail. Visite médicale d’embauche et visites périodiques des travailleurs.',
  },
  {
    id: 3,
    title: 'Arrêté portant règlement technique des appareils à pression de gaz',
    body: 'Contrôle périodique des appareils à pression.',
  },
];

describe('assistant — recherche des textes', () => {
  it('garde les mots utiles d’une question en anglais, avec leurs équivalents français', () => {
    const stems = questionStems(QUESTION);
    expect(stems).toContain('medica');
    expect(stems).toContain('medec');
    expect(stems).toContain('obliga');
    expect(stems.includes('the')).toBe(false);
    expect(stems.includes('are')).toBe(false);
  });

  it('trouve la médecine du travail, pas les prothèses ni les appareils à pression', () => {
    // Before: « the » matched « prothèse » and « are » matched « appareils »
    const scores = lexicalScores(questionStems(QUESTION), docs);
    expect((scores.get(2) ?? 0) > 0).toBe(true);
    expect(scores.get(1) ?? 0).toBe(0);
    expect(scores.get(3) ?? 0).toBe(0);
  });

  it('ne garde que les textes proches du meilleur quand la recherche sémantique répond', () => {
    const lexical = lexicalScores(questionStems(QUESTION), docs);
    const similarity = new Map([
      [1, 0.58],
      [2, 0.81],
      [3, 0.57],
    ]);
    const chosen = selectTexts(docs, lexical, similarity, { min: 1 });
    expect(chosen.map((r) => r.id)).toEqual([2]);
  });

  it('sans recherche sémantique, ne garde que les textes qui contiennent les mots', () => {
    const lexical = lexicalScores(questionStems(QUESTION), docs);
    expect(selectTexts(docs, lexical, null).map((r) => r.id)).toEqual([2]);
  });

  it('renumérote les citations dans l’ordre de la réponse', () => {
    const { text, cited } = renumberCitations(
      'a [4] b [4, 5] c [1-2] d [9]',
      5,
    );
    expect(text).toBe('a [1] b [1, 2] c [3, 4] d [9]');
    expect(cited).toEqual([4, 5, 1, 2]);
  });
});

describe('assistant — index sémantique', () => {
  it('range les vecteurs normalisés et les relit à l’identique', () => {
    const v = decodeVector(encodeVector([3, 4]));
    expect(Math.round(v[0] * 1000) / 1000).toBe(0.6);
    expect(Math.round(dot(v, v) * 1000) / 1000).toBe(1);
  });

  it('repère un texte modifié', () => {
    expect(contentHash('abc')).toBe(contentHash('abc'));
    expect(contentHash('abc') === contentHash('abd')).toBe(false);
  });
});

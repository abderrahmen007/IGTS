/**
 * Retrieval helpers of the assistant (pure functions, tested): words of a
 * question, lexical score of a text, mix with the semantic score and choice
 * of the texts given to the model.
 */

const STOPWORDS = new Set(
  // French
  (
    'les des une un le la de du et en au aux pour par sur dans que qui quoi est sont ' +
    'quel quelle quels quelles comment quand avec sans nous vous notre votre nos vos ' +
    'mon ma mes ce cet cette ces il elle ils elles on se sa son ses leur leurs pas plus ' +
    'doit doivent faut faire etre avoir entreprise societe texte textes loi lois ' +
    'quelles sont tous toutes tout aussi alors donc mais comme dont ainsi ' +
    // English
    'the and are was were what which who whom how when where why with without that this ' +
    'these those there their they them have has had must should would could can will ' +
    'for from into onto about apply applies work works working company companies law laws ' +
    'rule rules text texts any all our your you yours its domain domains'
  ).split(' '),
);

/**
 * A few common English words of the field, for questions typed in English
 * (the texts are in French).
 */
const EN_FR: Record<string, string[]> = {
  medical: ['medic', 'medec', 'aptitu'],
  medicine: ['medec'],
  doctor: ['medec'],
  health: ['sante'],
  safety: ['securi'],
  security: ['securi'],
  hygiene: ['hygien'],
  occupational: ['travail', 'profess'],
  workers: ['travai', 'salari'],
  worker: ['travai', 'salari'],
  employees: ['salari', 'travai'],
  employee: ['salari', 'travai'],
  environment: ['enviro'],
  environmental: ['enviro'],
  waste: ['dechet'],
  water: ['eau', 'hydri'],
  air: ['air', 'atmosp'],
  noise: ['bruit'],
  fire: ['incend'],
  extinguisher: ['extinc'],
  extinguishers: ['extinc'],
  electrical: ['electr'],
  electricity: ['electr'],
  pressure: ['pressi'],
  lift: ['ascens', 'levage'],
  lifts: ['ascens', 'levage'],
  elevator: ['ascens'],
  chemical: ['chimiq'],
  chemicals: ['chimiq'],
  hazardous: ['dangere'],
  dangerous: ['dangere'],
  training: ['format'],
  insurance: ['assura'],
  vehicle: ['vehicu'],
  vehicles: ['vehicu'],
  inspection: ['contro', 'inspec', 'visite'],
  inspections: ['contro', 'inspec', 'visite'],
  check: ['contro', 'verifi'],
  checks: ['contro', 'verifi'],
  energy: ['energi'],
  quality: ['qualit'],
  food: ['alimen'],
  accident: ['accide'],
  accidents: ['accide'],
  first: ['secour'],
  aid: ['secour'],
  emergency: ['urgenc', 'secour'],
  protective: ['protec'],
  protection: ['protec'],
  equipment: ['equipe', 'materi'],
  license: ['autori', 'agreme'],
  permit: ['autori', 'agreme'],
  approval: ['agreme'],
  pollution: ['pollut'],
  emissions: ['emissi', 'rejet'],
  discharge: ['rejet'],
  obligation: ['obliga'],
  obligations: ['obliga'],
};

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/œ/g, 'oe');
}

export function words(s: string): string[] {
  return normalize(s)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Stems of a question: meaningful words cut to 6 letters, plus French equivalents of English words. */
export function questionStems(question: string): string[] {
  const out = new Set<string>();
  for (const w of words(question)) {
    if (w.length < 4 || STOPWORDS.has(w)) continue;
    out.add(w.slice(0, 6));
    for (const fr of EN_FR[w] ?? []) out.add(fr);
  }
  return [...out];
}

export interface Doc {
  id: number;
  title: string;
  body: string;
}

/**
 * BM25-like lexical score: a stem counts when a word of the text starts with
 * it, weighted by its rarity among the texts (title twice the body).
 */
export function lexicalScores(
  stems: string[],
  docs: Doc[],
): Map<number, number> {
  const scores = new Map<number, number>();
  if (!stems.length || !docs.length) return scores;
  const tokens = docs.map((d) => ({
    id: d.id,
    title: new Set(words(d.title)),
    body: new Set(words(d.body)),
  }));
  const has = (set: Set<string>, stem: string) => {
    for (const w of set) if (w.startsWith(stem)) return true;
    return false;
  };
  const hits = stems.map((stem) =>
    tokens.map((t) => (has(t.title, stem) ? 2 : has(t.body, stem) ? 1 : 0)),
  );
  const n = docs.length;
  hits.forEach((row) => {
    const df = row.filter((h) => h > 0).length;
    if (!df) return;
    const idf = Math.log(1 + n / df);
    row.forEach((h, i) => {
      if (h)
        scores.set(tokens[i].id, (scores.get(tokens[i].id) ?? 0) + h * idf);
    });
  });
  return scores;
}

export interface Ranked {
  id: number;
  score: number;
  cos: number | null;
  lex: number;
}

/**
 * Mixes the semantic similarity (when available) with the lexical score and
 * keeps the texts close to the best one: at most `max`, at least `min` when
 * there is anything at all.
 */
export function selectTexts(
  docs: Doc[],
  lexical: Map<number, number>,
  similarity: Map<number, number> | null,
  opts: { max?: number; min?: number; margin?: number } = {},
): Ranked[] {
  const max = opts.max ?? 8;
  const min = opts.min ?? 3;
  const margin = opts.margin ?? 0.07;
  const maxLex = Math.max(0, ...lexical.values());
  const ranked: Ranked[] = docs.map((d) => {
    const lex = maxLex ? (lexical.get(d.id) ?? 0) / maxLex : 0;
    const cos = similarity?.get(d.id) ?? null;
    const score = cos !== null ? cos + 0.15 * lex : lex;
    return { id: d.id, score, cos, lex };
  });
  ranked.sort((a, b) => b.score - a.score);

  const withCos = ranked.filter((r) => r.cos !== null);
  if (withCos.length) {
    const top = Math.max(...withCos.map((r) => r.cos!));
    const close = ranked.filter(
      (r) => (r.cos !== null && r.cos >= top - margin) || r.lex >= 0.6,
    );
    return (close.length >= min ? close : ranked.slice(0, min)).slice(0, max);
  }
  return ranked.filter((r) => r.lex > 0).slice(0, Math.min(max, 6));
}

/**
 * Renumbers the citations of an answer in order of first use ([4] becomes
 * [1]…) and returns the cited positions, so the sources listed under the
 * answer match its numbers. Handles « [2, 5] » and « [1-3] ».
 */
export function renumberCitations(
  answer: string,
  count: number,
): { text: string; cited: number[] } {
  const order: number[] = [];
  const expand = (inner: string): number[] => {
    const out: number[] = [];
    for (const part of inner.split(/\s*,\s*/)) {
      const range = /^(\d+)\s*[-–]\s*(\d+)$/.exec(part);
      if (range) {
        for (
          let k = Number(range[1]);
          k <= Number(range[2]) && k - Number(range[1]) < 20;
          k++
        )
          out.push(k);
      } else if (/^\d+$/.test(part)) out.push(Number(part));
    }
    return out.filter((k) => k >= 1 && k <= count);
  };
  const text = answer.replace(
    /\[(\d+(?:\s*(?:,|-|–)\s*\d+)*)\]/g,
    (match, inner: string) => {
      const nums = expand(inner);
      if (!nums.length) return match;
      const mapped = nums.map((k) => {
        let pos = order.indexOf(k);
        if (pos < 0) {
          order.push(k);
          pos = order.length - 1;
        }
        return pos + 1;
      });
      return `[${[...new Set(mapped)].sort((a, b) => a - b).join(', ')}]`;
    },
  );
  return { text, cited: order };
}

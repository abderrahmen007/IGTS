/**
 * Helpers for legacy content. Action plans were typed in CKEditor, so the
 * database contains HTML with named entities (&eacute;, &nbsp;…). The API
 * returns clean plain text so the frontend never has to render raw HTML.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë',
  Eacute: 'É', Egrave: 'È', Ecirc: 'Ê',
  agrave: 'à', acirc: 'â', auml: 'ä', Agrave: 'À', Acirc: 'Â',
  ugrave: 'ù', ucirc: 'û', uuml: 'ü',
  icirc: 'î', iuml: 'ï', ocirc: 'ô', ouml: 'ö', Ocirc: 'Ô',
  ccedil: 'ç', Ccedil: 'Ç', oelig: 'œ', OElig: 'Œ', aelig: 'æ',
  deg: '°', laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘',
  ldquo: '“', rdquo: '”', hellip: '…', ndash: '–', mdash: '—',
  euro: '€', bull: '•', middot: '·', sup2: '²', sup3: '³',
};

export function decodeEntities(input: string): string {
  return input.replace(/&(#x?[0-9a-f]+|[a-z0-9]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x'
        ? parseInt(code.slice(2), 16)
        : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return NAMED_ENTITIES[code] ?? match;
  });
}

/** Converts legacy rich text to readable plain text (keeps list items and paragraphs). */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return '';
  const text = html
    .replace(/\r/g, '')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|ul|ol)>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return decodeEntities(text)
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line) => line !== '')
    .join('\n')
    .replace(/•\n/g, '• ')
    .trim();
}

/** Parses a dd/mm/yyyy string (legacy format) into an ISO date, or null. */
export function parseFrenchDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/** Formats an ISO yyyy-mm-dd string back to the legacy dd/mm/yyyy format. */
export function toFrenchDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

export function clampPage(page?: number, pageSize?: number) {
  const size = Math.min(Math.max(Number(pageSize) || 20, 5), 100);
  const p = Math.max(Number(page) || 1, 1);
  return { page: p, pageSize: size, skip: (p - 1) * size };
}

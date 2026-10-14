import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenerativeAI,
  SchemaType,
  type Part,
  type ResponseSchema,
} from '@google/generative-ai';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

/** A text of the Official Journal that concerns the IGTS watch, as read by the AI. */
export interface AnalyzedText {
  titre: string;
  typeId: number | null;
  num: string;
  signedOn: string;
  ministere: string;
  pages: [number, number] | null;
  secteurId: number | null;
  themeId: number | null;
  confidence: number;
  reason: string;
  summary: string;
  keyPoints: string[];
  needsReview: string[];
}

export interface IssueAnalysis {
  issueNumber: string;
  /** "7 octobre 2026" */
  issueDate: string;
  texts: AnalyzedText[];
  ignoredCount: number;
  /** "42 nominations, 3 délégations de signature…" */
  ignoredSummary: string;
  model: string;
}

interface Reference {
  secteurs: {
    id: number;
    name: string;
    themes: { id: number; name: string }[];
  }[];
  types: { id: number; name: string }[];
}

/** Inline PDFs above this size go through the Gemini File API instead. */
const INLINE_LIMIT = 15 * 1024 * 1024;

const SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    issueNumber: {
      type: SchemaType.STRING,
      description: 'Numéro du JORT, ex. "118". Vide si inconnu.',
    },
    issueDate: {
      type: SchemaType.STRING,
      description:
        'Date du JORT en toutes lettres, ex. "7 octobre 2026". Vide si inconnue.',
    },
    texts: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          titre: { type: SchemaType.STRING },
          typeId: { type: SchemaType.INTEGER },
          num: { type: SchemaType.STRING },
          signedOn: { type: SchemaType.STRING },
          ministere: { type: SchemaType.STRING },
          pageStart: { type: SchemaType.INTEGER },
          pageEnd: { type: SchemaType.INTEGER },
          secteurId: { type: SchemaType.INTEGER },
          themeId: { type: SchemaType.INTEGER },
          confidence: { type: SchemaType.NUMBER },
          reason: { type: SchemaType.STRING },
          summary: { type: SchemaType.STRING },
          keyPoints: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
          needsReview: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
        },
        required: [
          'titre',
          'typeId',
          'num',
          'signedOn',
          'ministere',
          'pageStart',
          'pageEnd',
          'secteurId',
          'themeId',
          'confidence',
          'reason',
          'summary',
          'keyPoints',
          'needsReview',
        ],
      },
    },
    ignoredCount: { type: SchemaType.INTEGER },
    ignoredSummary: { type: SchemaType.STRING },
  },
  required: [
    'issueNumber',
    'issueDate',
    'texts',
    'ignoredCount',
    'ignoredSummary',
  ],
};

function prompt(ref: Reference): string {
  const domains = ref.secteurs
    .map(
      (s) =>
        `- Secteur ${s.id} « ${s.name} » :\n${s.themes.map((t) => `    - thème ${t.id} : ${t.name}`).join('\n')}`,
    )
    .join('\n');
  const types = ref.types.map((t) => `${t.id} = ${t.name}`).join(' ; ');

  return `Tu es juriste chez IGTS, cabinet tunisien de veille réglementaire en santé, sécurité, environnement, énergie, qualité, social et agroalimentaire.
Le document joint est un numéro du Journal Officiel de la République Tunisienne (JORT), ou l'extrait d'un texte publié au JORT.

TA MISSION
1. Lis le document en entier et repère chaque texte publié (loi, décret, arrêté, décision, avis, circulaire…).
2. Retiens UNIQUEMENT les textes de PORTÉE GÉNÉRALE qu'une entreprise suivie par IGTS doit appliquer : ceux qui créent, modifient, complètent ou abrogent des règles, obligations, normes, procédures, taxes ou conditions d'exercice valables pour toutes les entreprises d'une activité, d'un secteur ou du pays, dans les domaines ci-dessous.
3. Écarte tout le reste :
   - les textes individuels ou locaux, même s'ils touchent un domaine de la veille : un projet ou un chantier précis, le plan d'aménagement ou le périmètre d'une localité, une expropriation, une autorisation ou un agrément accordé à une société ou une personne nommée, une liste de diplômes ou de certificats homologués, une concession, un marché public, une création ou dissolution d'établissement ;
   - les nominations, cessations de fonctions, mises à la retraite, délégations de signature, promotions, mutations, concours et examens, grâces, changements de nom ou de prénom, naturalisations, décorations, procès-verbaux ;
   - l'organisation interne d'un ministère ou d'un établissement public, les budgets, les conventions de prêt ou de financement, les ratifications d'accords financiers.
   Un texte qui ne crée aucune obligation nouvelle pour les entreprises n'a rien à faire dans la veille. En cas de vrai doute sur la portée générale, retiens le texte avec une confiance inférieure à 0,5 et écris « Portée générale à confirmer » dans needsReview.

DOMAINES DE LA VEILLE (identifiants à utiliser)
${domains}

TYPES DE TEXTE (identifiants) : ${types}

POUR CHAQUE TEXTE RETENU
- titre : intitulé officiel complet en français, tel qu'il apparaît au JORT, ex. « Décret n° 2026-512 du 2 octobre 2026, fixant les conditions d'exercice… ». Si le document est en arabe, traduis fidèlement et ajoute « Titre traduit de l'arabe » dans needsReview.
- typeId : identifiant du type ci-dessus (0 si aucun ne convient).
- num : numéro officiel sous la forme « n° 2026-512 » ; chaîne vide s'il n'y en a pas (cas des arrêtés).
- signedOn : date de signature en toutes lettres, ex. « 2 octobre 2026 ».
- ministere : autorité signataire ou ministère concerné.
- pageStart / pageEnd : pages du texte DANS LE FICHIER PDF (la 1re page du fichier = 1), pas les numéros imprimés.
- secteurId et themeId : le domaine le plus pertinent ; le thème DOIT appartenir au secteur choisi (0 si aucun thème ne convient).
- confidence : de 0 à 1, ta certitude que le texte concerne la veille ET que le classement est juste. Au-dessus de 0,8 seulement si le texte impose clairement des obligations générales à des entreprises dans le thème choisi ; entre 0,5 et 0,8 si le lien avec le thème est indirect ; en dessous de 0,5 si la portée générale est douteuse.
- reason : une phrase qui explique pourquoi le texte concerne les entreprises suivies.
- summary : résumé de 2 à 4 phrases pour un responsable QHSE : objet du texte, entreprises concernées, obligations principales, date d'entrée en vigueur si elle est indiquée. Style sobre et factuel, sans formule d'introduction.
- keyPoints : 2 à 4 obligations ou changements concrets, une courte phrase chacun.
- needsReview : ce que l'administrateur doit vérifier (thème incertain, texte partiellement lisible, etc.), sinon liste vide.

RÈGLES
- N'invente jamais un numéro, une date ou une obligation absents du document.
- issueNumber et issueDate : numéro et date du JORT lus sur le document (vides si absents).
- ignoredCount : nombre de textes écartés ; ignoredSummary : leur répartition en une phrase, ex. « 38 nominations, 4 délégations de signature ».
- Réponds uniquement avec le JSON demandé.`;
}

/** Gemini could not be reached even after the retries (network, overload). */
export class AiUnavailableError extends Error {}

/** A network cut, a timeout or an overloaded service: worth another try. */
export function isTransientAiError(e: unknown): boolean {
  const { status, message } = (e ?? {}) as {
    status?: number;
    message?: string;
  };
  if (status && [429, 500, 502, 503, 504].includes(status)) return true;
  return /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|network|overloaded|UNAVAILABLE|\[(429|500|502|503|504) /i.test(
    message ?? '',
  );
}

const clamp01 = (n: number) =>
  Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
const clean = (s: unknown) =>
  typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '';

/**
 * Reads an Official Journal PDF with Gemini (it reads scanned and Arabic pages
 * too) and returns the texts that concern the watch, already classified with
 * the platform's own sectors, themes and types. The JORT is public, so sending
 * it to an external model raises no confidentiality issue.
 */
@Injectable()
export class JortAnalyzerService {
  private readonly logger = new Logger(JortAnalyzerService.name);
  private readonly apiKey: string | null;
  readonly model: string;
  /** Waits before the 2nd and 3rd attempts (the issue is then read again tomorrow) */
  retryWaits = [20_000, 60_000];

  constructor(
    private prisma: PrismaService,
    config: ConfigService,
  ) {
    this.apiKey = config.get<string>('GEMINI_API_KEY')?.trim() || null;
    this.model =
      config.get<string>('GEMINI_MODEL')?.trim() || 'gemini-2.5-flash';
  }

  get available(): boolean {
    return Boolean(this.apiKey);
  }

  async reference(): Promise<Reference> {
    const [secteurs, types] = await Promise.all([
      this.prisma.secteur.findMany({
        orderBy: { id: 'asc' },
        select: {
          id: true,
          name: true,
          themes: { select: { id: true, name: true }, orderBy: { id: 'asc' } },
        },
      }),
      this.prisma.type.findMany({
        orderBy: { id: 'asc' },
        select: { id: true, name: true },
      }),
    ]);
    return { secteurs, types };
  }

  async analyze(
    pdf: Buffer,
    pageTotal: number | null,
    onRetry?: (step: string) => void,
  ): Promise<IssueAnalysis> {
    if (!this.apiKey)
      throw new Error(
        'Analyse IA indisponible : GEMINI_API_KEY n’est pas configurée.',
      );
    const ref = await this.reference();
    const genAI = new GoogleGenerativeAI(this.apiKey);
    const model = genAI.getGenerativeModel(
      {
        model: this.model,
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 65536,
          responseMimeType: 'application/json',
          responseSchema: SCHEMA,
        },
      },
      { timeout: 10 * 60_000 },
    );

    const { part, cleanup } = await this.pdfPart(pdf);
    try {
      const result = await this.withRetry(
        () => model.generateContent([part, { text: prompt(ref) }]),
        onRetry,
      );
      const raw = JSON.parse(result.response.text()) as Record<string, unknown>;
      return this.validate(raw, ref, pageTotal);
    } finally {
      await cleanup();
    }
  }

  /**
   * Calls Gemini again after a short wait when the connection drops or the
   * service is overloaded (a reading of 14/10 failed once with « fetch failed »
   * and worked a few minutes later).
   */
  async withRetry<T>(
    call: () => Promise<T>,
    onRetry?: (step: string) => void,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await call();
      } catch (e) {
        if (!isTransientAiError(e)) throw e;
        const detail = (e as Error).message;
        if (attempt >= this.retryWaits.length) {
          this.logger.error(`Gemini injoignable : ${detail}`);
          throw new AiUnavailableError(
            `L’IA (Gemini) n’a pas répondu après ${attempt + 1} essais : connexion coupée ou service saturé.`,
          );
        }
        const wait = this.retryWaits[attempt];
        const step = `L’IA ne répond pas (connexion coupée ou service saturé) : nouvel essai dans ${Math.round(wait / 1000)} s`;
        this.logger.warn(`${step} — ${detail}`);
        onRetry?.(step);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }

  /** Small PDFs travel inline; large issues are uploaded with the File API. */
  private async pdfPart(
    pdf: Buffer,
  ): Promise<{ part: Part; cleanup: () => Promise<void> }> {
    if (pdf.length <= INLINE_LIMIT) {
      return {
        part: {
          inlineData: {
            mimeType: 'application/pdf',
            data: pdf.toString('base64'),
          },
        },
        cleanup: async () => {},
      };
    }
    const { GoogleAIFileManager, FileState } =
      await import('@google/generative-ai/server');
    const files = new GoogleAIFileManager(this.apiKey!);
    const tmp = join(tmpdir(), `jort-${randomBytes(6).toString('hex')}.pdf`);
    await fs.writeFile(tmp, pdf);
    const upload = await files.uploadFile(tmp, {
      mimeType: 'application/pdf',
      displayName: 'JORT',
    });
    let file = upload.file;
    for (let i = 0; i < 60 && file.state === FileState.PROCESSING; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      file = await files.getFile(file.name);
    }
    if (file.state !== FileState.ACTIVE)
      throw new Error('Le PDF n’a pas pu être transmis à l’IA.');
    return {
      part: { fileData: { mimeType: 'application/pdf', fileUri: file.uri } },
      cleanup: async () => {
        await fs.unlink(tmp).catch(() => undefined);
        await files.deleteFile(file.name).catch(() => undefined);
      },
    };
  }

  /**
   * Keeps only identifiers that exist and a theme that belongs to its sector,
   * and drops texts whose title shows an individual or local scope even when
   * the AI kept them (it did keep a list of homologated diplomas at 0.9).
   */
  validate(
    raw: Record<string, unknown>,
    ref: Reference,
    pageTotal: number | null,
  ): IssueAnalysis {
    const typeIds = new Set(ref.types.map((t) => t.id));
    const texts = (Array.isArray(raw.texts) ? raw.texts : []) as Record<
      string,
      unknown
    >[];

    const out: AnalyzedText[] = [];
    const excluded: string[] = [];
    for (const t of texts) {
      const titre = clean(t.titre);
      if (titre.length < 5) continue;
      const rule = excludedScope(titre);
      if (rule) {
        excluded.push(rule);
        continue;
      }
      const review = (Array.isArray(t.needsReview) ? t.needsReview : [])
        .map(clean)
        .filter(Boolean);

      const typeId = typeIds.has(Number(t.typeId)) ? Number(t.typeId) : null;
      if (!typeId) review.push('Type de texte à choisir');

      const secteur =
        ref.secteurs.find((s) => s.id === Number(t.secteurId)) ?? null;
      const theme =
        secteur?.themes.find((th) => th.id === Number(t.themeId)) ?? null;
      if (!secteur) review.push('Secteur à choisir');
      else if (!theme) review.push('Thème à choisir');

      let pages: [number, number] | null = null;
      const a = Math.floor(Number(t.pageStart));
      const b = Math.floor(Number(t.pageEnd));
      if (a >= 1 && b >= a && (!pageTotal || b <= pageTotal) && b - a < 60)
        pages = [a, b];

      out.push({
        titre,
        typeId,
        num: clean(t.num),
        signedOn: clean(t.signedOn),
        ministere: clean(t.ministere),
        pages,
        secteurId: secteur?.id ?? null,
        themeId: theme?.id ?? null,
        confidence: clamp01(Number(t.confidence)),
        reason: clean(t.reason),
        summary: typeof t.summary === 'string' ? t.summary.trim() : '',
        keyPoints: (Array.isArray(t.keyPoints) ? t.keyPoints : [])
          .map(clean)
          .filter(Boolean)
          .slice(0, 6),
        needsReview: [...new Set(review)],
      });
    }

    const summary = clean(raw.ignoredSummary);
    const extra = excluded.length
      ? `${excluded.length} écarté(s) après lecture (${[...new Set(excluded)].join(', ')})`
      : '';
    return {
      issueNumber: clean(raw.issueNumber).replace(/^n[°o]\s*/i, ''),
      issueDate: clean(raw.issueDate),
      texts: out,
      ignoredCount:
        Math.max(0, Math.floor(Number(raw.ignoredCount) || 0)) +
        excluded.length,
      ignoredSummary: [summary, extra].filter(Boolean).join(' ; '),
      model: this.model,
    };
  }
}

/**
 * Titles that are individual or local by nature: never a general obligation
 * for companies. Returns the reason, or null when the text may be kept.
 */
const EXCLUDED_SCOPES: [RegExp, string][] = [
  [
    /homologation[^.]*\b(dipl[ôo]mes?|certificats?)\b/i,
    'homologation de diplômes',
  ],
  [/\bportant nominations?\b/i, 'nomination'],
  [/\bd[ée]l[ée]gation de signature\b/i, 'délégation de signature'],
  [/\bcessation de fonctions?\b/i, 'cessation de fonctions'],
  [/\bchangement (de |du )?(nom|pr[ée]nom)s?\b/i, 'changement de nom'],
  [/\bexpropriation\b/i, 'expropriation'],
  [
    /\bconcours (interne|externe|sur dossiers?|sur [ée]preuves)\b/i,
    'concours de recrutement',
  ],
];

export function excludedScope(titre: string): string | null {
  return EXCLUDED_SCOPES.find(([re]) => re.test(titre))?.[1] ?? null;
}

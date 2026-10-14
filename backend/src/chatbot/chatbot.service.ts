import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/auth-user';
import { htmlToText } from '../common/text-utils';
import {
  APPLICABLE,
  CONFORME,
  INDICATIF,
  NON_APPLICABLE,
  NON_CONFORME,
} from '../company/rules';
import { isTransientAiError } from '../scraper/jort-analyzer.service';
import { EmbeddingsService, docContent, dot } from './embeddings.service';
import {
  lexicalScores,
  questionStems,
  renumberCitations,
  selectTexts,
} from './retrieval';

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

function evaluationLabel(
  applicabiliteId: number,
  gestionetatId: number | null,
) {
  if (applicabiliteId === NON_APPLICABLE)
    return 'jugé non applicable par l’entreprise';
  if (applicabiliteId !== APPLICABLE)
    return 'pas encore évalué par l’entreprise';
  if (gestionetatId === CONFORME)
    return 'applicable, l’entreprise s’est déclarée conforme';
  if (gestionetatId === NON_CONFORME)
    return 'applicable, l’entreprise s’est déclarée NON conforme';
  if (gestionetatId === INDICATIF) return 'applicable, à titre indicatif';
  return 'applicable, conformité pas encore évaluée';
}

/**
 * Legal assistant restricted to the texts of the caller's company.
 *
 * Retrieval: semantic search over a persistent index (EmbeddingsService)
 * mixed with a lexical score that understands accents, word forms and common
 * English terms, then only the texts close to the best match are given to
 * the model, with the company's domains and its own evaluations. The model
 * answers in the language of the question and cites only what it uses.
 */
@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);
  private readonly genAI: GoogleGenerativeAI | null = null;
  private readonly model: string;

  constructor(
    private prisma: PrismaService,
    private embeddings: EmbeddingsService,
    config: ConfigService,
  ) {
    const apiKey = config.get<string>('GEMINI_API_KEY')?.trim();
    if (apiKey) this.genAI = new GoogleGenerativeAI(apiKey);
    else
      this.logger.warn(
        'GEMINI_API_KEY is not set. The chatbot will be unavailable.',
      );
    this.model =
      config.get<string>('GEMINI_MODEL')?.trim() || 'gemini-2.5-flash';
  }

  async ask(
    user: AuthUser,
    question: string,
    focusId?: number,
    history: ChatTurn[] = [],
  ) {
    const ownerId = user.ownerId!;
    const [rows, company, secteurs, themes] = await Promise.all([
      this.prisma.texteSociete.findMany({
        where: {
          companyId: ownerId,
          OR: [{ deleted: false }, { deleted: null }],
          texte: { deleted: false },
        },
        select: {
          id: true,
          applicabiliteId: true,
          gestionetatId: true,
          texte: {
            select: {
              id: true,
              titre: true,
              num: true,
              description: true,
              date: true,
              type: { select: { name: true } },
              secteur: { select: { name: true } },
              theme: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.company.findUnique({
        where: { id: ownerId },
        select: { nom: true, raisonsociale: true },
      }),
      this.prisma.companySecteurTheme.findMany({
        where: { companyId: ownerId },
        select: { secteur: { select: { id: true, name: true } } },
      }),
      this.prisma.companyTheme.findMany({
        where: { companyId: ownerId },
        select: { secteurId: true, theme: { select: { name: true } } },
      }),
    ]);
    const texts = rows.filter((r) => r.texte);

    // Short follow-up (« et pour l’environnement ? »): search with the previous question too
    const lastUser = [...history]
      .reverse()
      .find((t) => t.role === 'user')?.text;
    const searchText =
      lastUser && question.split(/\s+/).length < 7
        ? `${lastUser}\n${question}`
        : question;

    // Semantic index: the company's texts first, then the question
    const docs = texts.map((r) => ({
      id: r.texte!.id,
      title: r.texte!.titre,
      content: docContent(r.texte!),
    }));
    await this.embeddings.ensure(docs, 100);
    const qv = await this.embeddings.embedQuery(searchText);
    let similarity: Map<number, number> | null = null;
    if (qv) {
      similarity = new Map();
      for (const r of texts) {
        const v = this.embeddings.vector(r.texte!.id);
        if (v) similarity.set(r.id, dot(qv, v));
      }
      if (!similarity.size) similarity = null;
    }

    const lexDocs = texts.map((r) => ({
      id: r.id,
      title: r.texte!.titre,
      body: `${r.texte!.secteur?.name ?? ''} ${r.texte!.theme?.name ?? ''} ${htmlToText(r.texte!.description)}`,
    }));
    const lexical = lexicalScores(questionStems(searchText), lexDocs);
    let chosen = selectTexts(lexDocs, lexical, similarity).map((r) => r.id);
    if (focusId && texts.some((r) => r.id === focusId)) {
      chosen = [focusId, ...chosen.filter((id) => id !== focusId)].slice(0, 8);
    }
    const byId = new Map(texts.map((r) => [r.id, r]));
    const picked = chosen.map((id) => byId.get(id)!).filter(Boolean);

    // Company context: its domains, so « my domains » means something
    const domainNames = new Map<number, { name: string; themes: string[] }>();
    for (const s of secteurs)
      if (s.secteur)
        domainNames.set(s.secteur.id, { name: s.secteur.name, themes: [] });
    for (const t of themes) {
      if (t.secteurId && t.theme && domainNames.has(t.secteurId))
        domainNames.get(t.secteurId)!.themes.push(t.theme.name);
    }
    const domains = [...domainNames.values()]
      .map((d) =>
        d.themes.length
          ? `${d.name} (thèmes : ${d.themes.slice(0, 12).join(', ')})`
          : d.name,
      )
      .join(' ; ');

    const context = picked.length
      ? picked
          .map((r, i) => {
            const t = r.texte!;
            const meta = [
              t.type?.name,
              [t.secteur?.name, t.theme?.name].filter(Boolean).join(' / '),
              t.date ? `publié le ${t.date}` : null,
            ]
              .filter(Boolean)
              .join(' · ');
            return `[${i + 1}] ${t.titre}${t.num && !t.titre.includes(t.num) ? ` (${t.num})` : ''}\n${meta}\nÉvaluation : ${evaluationLabel(r.applicabiliteId, r.gestionetatId)}\nRésumé : ${htmlToText(t.description).slice(0, 1400)}`;
          })
          .join('\n\n')
      : 'Aucun texte de la veille ne semble porter sur cette question.';

    const conversation = history
      .slice(-4)
      .map(
        (t) =>
          `${t.role === 'user' ? 'Utilisateur' : 'Assistant'} : ${t.text.slice(0, 800)}`,
      )
      .join('\n');

    const prompt = `Tu es l'assistant de « IGTS Veille », la plateforme de veille réglementaire (santé-sécurité, environnement, qualité, énergie) d'IGTS pour des entreprises tunisiennes.

ENTREPRISE : ${company?.raisonsociale || company?.nom || 'entreprise cliente'}
DOMAINES SUIVIS : ${domains || 'non renseignés'}
SA VEILLE : ${texts.length} texte(s). Ci-dessous, ceux qui semblent les plus proches de la question.

RÈGLES
1. Réponds dans la langue de la question : français par défaut, anglais si la question est en anglais, arabe si elle est en arabe.
2. Pour la réglementation, appuie-toi UNIQUEMENT sur les textes ci-dessous. N'invente jamais une obligation, un numéro de texte, un délai ou une date.
3. Cite chaque obligation avec le numéro du texte entre crochets, par exemple [2]. N'utilise et ne cite que les textes qui répondent vraiment à la question ; ignore les autres sans les mentionner.
4. Si aucun texte ne répond, dis-le en une ou deux phrases : la veille de l'entreprise ne contient pas de texte sur ce sujet, et elle peut demander à son conseiller IGTS de l'ajouter. N'énumère pas de textes hors sujet.
5. Présentation : une phrase de réponse directe, puis les obligations en liste courte (une ligne par obligation, commençant par « • », avec sa citation). Signale quand l'entreprise a évalué un texte non conforme ou ne l'a pas encore évalué. Pas de Markdown (ni astérisques ni titres).
6. Questions sur l'utilisation de la plateforme : réponds simplement à partir des menus Accueil, À évaluer, Mes textes, Plan d'action, Échéances, Mon équipe et Mon profil.
7. Reste concis : 180 mots au plus, sauf si la question demande du détail.
${conversation ? `\nÉCHANGE PRÉCÉDENT\n${conversation}\n` : ''}
TEXTES
${context}

QUESTION
${question}`;

    const sourceOf = (r: (typeof picked)[number]) => ({
      id: r.id,
      titre: r.texte!.titre,
    });

    if (!this.genAI) {
      return {
        answer:
          'L’assistant est momentanément indisponible (clé API non configurée). Voici les textes de votre veille les plus proches de votre question.',
        sources: picked.slice(0, 5).map(sourceOf),
        unavailable: true,
      };
    }

    try {
      const model = this.genAI.getGenerativeModel({
        model: this.model,
        generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
      });
      let raw = '';
      for (let attempt = 0; ; attempt++) {
        try {
          raw = (await model.generateContent(prompt)).response.text();
          break;
        } catch (e) {
          if (attempt >= 1 || !isTransientAiError(e)) throw e;
          await new Promise((r) => setTimeout(r, 2500));
        }
      }
      // The sources listed under the answer follow its own numbering
      const { text, cited } = renumberCitations(raw.trim(), picked.length);
      return {
        answer: text,
        sources: cited.map((k) => sourceOf(picked[k - 1])),
      };
    } catch (error) {
      this.logger.error(`Gemini API unavailable: ${(error as Error).message}`);
      return {
        answer:
          'L’assistant est momentanément indisponible. Voici les textes de votre veille les plus proches de votre question.',
        sources: picked.slice(0, 5).map(sourceOf),
        unavailable: true,
      };
    }
  }
}

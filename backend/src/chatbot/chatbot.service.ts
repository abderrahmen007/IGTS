import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/auth-user';
import { GoogleGenerativeAI } from '@google/generative-ai';

const STOPWORDS = new Set(
  (
    'les des une un le la de du et en au aux pour par sur dans que qui quoi est sont ' +
    'quel quelle quels quelles comment quand avec sans nous vous notre votre nos vos ' +
    'mon ma mes ce cet cette ces il elle ils elles on se sa son ses leur leurs pas plus ' +
    'doit doivent faut faire être avoir entreprise société texte textes loi'
  ).split(' '),
);

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function keywords(question: string) {
  return [
    ...new Set(
      normalize(question)
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 3 && !STOPWORDS.has(w)),
    ),
  ];
}

/**
 * Legal assistant restricted to the texts assigned to the caller's company.
 *
 * Retrieval: keyword scoring over titles and summaries (no vector store yet).
 * Only the most relevant texts are sent to the LLM (Gemini), and the model is told
 * to answer from them only and to say so when the answer is not there.
 */
@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);
  private readonly genAI: GoogleGenerativeAI | null = null;

  constructor(
    private prisma: PrismaService,
    config: ConfigService,
  ) {
    const apiKey = config.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    } else {
      this.logger.warn('GEMINI_API_KEY is not set. The chatbot will be unavailable.');
    }
  }

  async ask(user: AuthUser, question: string, focusId?: number) {
    const rows = await this.prisma.texteSociete.findMany({
      where: {
        companyId: user.ownerId!,
        OR: [{ deleted: false }, { deleted: null }],
        texte: { deleted: false },
      },
      select: { id: true, texte: { select: { titre: true, description: true, date: true } } },
    });

    const terms = keywords(question);
    const ranked = rows
      .map((r) => {
        const titre = normalize(r.texte!.titre);
        const desc = normalize(r.texte!.description);
        let score = 0;
        for (const t of terms) {
          if (titre.includes(t)) score += 3;
          score += Math.min(desc.split(t).length - 1, 5);
        }
        return { r, score };
      })
      .map((x) => (x.r.id === focusId ? { ...x, score: x.score + 1000 } : x))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    const sources = ranked.map(({ r }) => ({ id: r.id, titre: r.texte!.titre }));

    const context = ranked.length > 0
      ? ranked
          .map(({ r }, i) => `[${i + 1}] ${r.texte!.titre} (${r.texte!.date})\n${r.texte!.description}`)
          .join('\n\n')
      : "Aucun texte juridique spécifique n'a été trouvé pour cette question.";

    const prompt = `Tu es l'assistant IA de l'application "IGTS Veille", une plateforme de veille réglementaire pour les entreprises tunisiennes.
Ton rôle est de faciliter la vie de l'utilisateur pour tout ce qui concerne l'application et la veille réglementaire.

RÈGLES DE RÉPONSE :
1. Si la question porte sur la réglementation ou la loi, réponds UNIQUEMENT à partir des textes applicables fournis ci-dessous. Cite les textes utilisés par leur numéro entre crochets, par exemple [1].
2. Si la question porte sur l'utilisation de l'application (ex: "comment modifier mon profil", "comment ajouter une action"), réponds de façon utile et courtoise. (Pour le profil, l'utilisateur peut aller dans "Mon compte" ou utiliser le menu de navigation).
3. Si la question est une salutation ou d'ordre général, sois poli et propose ton aide.
4. Réponds toujours en français, de façon claire, concise et professionnelle.

Textes applicables à l'entreprise pour cette question :
${context}

Question de l'utilisateur : ${question}

Réponse :`;

    if (!this.genAI) {
      return {
        answer:
          "L'assistant est momentanément indisponible (clé API non configurée). Voici les textes de votre veille les plus proches de votre question.",
        sources,
        unavailable: true,
      };
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { temperature: 0.1 } });
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      // Ne renvoyer que les sources qui ont été effectivement citées dans la réponse
      const usedSources = sources.filter((_, i) => responseText.includes(`[${i + 1}]`));

      return { answer: responseText.trim(), sources: usedSources };
    } catch (error) {
      this.logger.error(`Gemini API unavailable: ${(error as Error).message}`);
      return {
        answer:
          "L'assistant est momentanément indisponible. Voici les textes de votre veille les plus proches de votre question.",
        sources,
        unavailable: true,
      };
    }
  }
}


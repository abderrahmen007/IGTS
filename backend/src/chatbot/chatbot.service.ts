import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/auth-user';

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
 * Only the most relevant texts are sent to the local LLM, and the model is told
 * to answer from them only and to say so when the answer is not there.
 */
@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);
  private readonly ollamaUrl: string;
  private readonly model: string;

  constructor(
    private prisma: PrismaService,
    config: ConfigService,
  ) {
    this.ollamaUrl = (config.get<string>('OLLAMA_URL') ?? 'http://localhost:11434').replace(/\/$/, '');
    this.model = config.get<string>('OLLAMA_MODEL') ?? 'llama3';
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

    if (ranked.length === 0) {
      return {
        answer:
          "Je n'ai trouvé aucun texte de votre veille en lien avec cette question. " +
          'Essayez avec d’autres mots-clés (ex. « médecine du travail », « déchets », « audit énergétique »).',
        sources: [],
      };
    }

    const context = ranked
      .map(({ r }, i) => `[${i + 1}] ${r.texte!.titre} (${r.texte!.date})\n${r.texte!.description}`)
      .join('\n\n');

    const prompt = `Tu es l'assistant de veille réglementaire d'IGTS pour des entreprises tunisiennes.
Réponds en français, de façon claire et concise, UNIQUEMENT à partir des textes ci-dessous.
Cite les textes utilisés par leur numéro entre crochets, par exemple [1].
Si les textes ne permettent pas de répondre, dis-le simplement et n'invente rien.

Textes applicables à l'entreprise :
${context}

Question : ${question}

Réponse :`;

    try {
      const res = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, prompt, stream: false, options: { temperature: 0.1 } }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
      const data = (await res.json()) as { response?: string };
      return { answer: (data.response ?? '').trim(), sources };
    } catch (error) {
      this.logger.error(`Ollama unavailable: ${(error as Error).message}`);
      return {
        answer:
          "L'assistant est momentanément indisponible. Voici les textes de votre veille les plus proches de votre question.",
        sources,
        unavailable: true,
      };
    }
  }
}

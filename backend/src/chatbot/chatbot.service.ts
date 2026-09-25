import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatbotService {
  constructor(private prisma: PrismaService) {}

  async askQuestion(question: string, companyId: number) {
    // 1. Fetch the texts that this company has access to as context
    const companyTexts = await this.prisma.texteSociete.findMany({
      where: { companyId },
      include: { texte: true },
      take: 10 // Limit context for now
    });

    const contextTexts = companyTexts.map(ct => `Titre: ${ct.texte.name}\nRésumé: ${ct.texte.ntext}`).join('\n\n');

    // 2. Build the prompt for the local Ollama model
    const prompt = `Tu es un assistant juridique expert en droit tunisien pour la plateforme IGTS Veille.
Utilise le contexte suivant pour répondre à la question de l'entreprise. Si la réponse n'est pas dans le contexte, utilise tes connaissances générales mais précise-le.

Contexte des textes de loi de l'entreprise:
${contextTexts}

Question de l'utilisateur: ${question}

Réponse:`;

    try {
      // Fetch from local Ollama instance (default port 11434)
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama3', // or 'mistral', 'mixtral' etc.
          prompt: prompt,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error('Ollama connection failed');
      }

      const data = await response.json();
      return { answer: data.response };
    } catch (error) {
      console.error('AI Error:', error);
      // Fallback response if Ollama is not running
      return { 
        answer: "L'intelligence artificielle est actuellement indisponible (Ollama n'est pas démarré localement). Veuillez réessayer plus tard ou contacter l'administrateur." 
      };
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import * as cheerio from 'cheerio';

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Run the scraper every day at midnight.
   * Target: iort.gov.tn or other legal sources
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async scrapeLegalTexts() {
    this.logger.log('Lancement du scraper iort.gov.tn...');

    try {
      // 1. Fetch the HTML from the target website
      // NOTE: iort.gov.tn may require a more complex puppeteer setup if it uses JS extensively,
      // but for demonstration purposes, we are simulating a standard fetch.
      // const response = await axios.get('http://www.iort.gov.tn/WD120AWP/WD120Awp.exe/CONNECT/SITEIORT');
      
      this.logger.log('Simulation de récupération des textes...');

      // Mocked new text that the scraper found
      const scrapedTexts = [
        {
          title: "Arrêté du ministre des finances du 15 septembre 2026",
          description: "Fixant les modalités d'application de la nouvelle taxe écologique sur les entreprises.",
          date: new Date(),
          source: "JORT N° 124"
        }
      ];

      // 2. Pass data to local AI (Ollama) for classification/summarization
      for (const text of scrapedTexts) {
        const aiAnalysis = await this.analyzeTextWithAI(text.title, text.description);

        // 3. Save to database
        await this.prisma.texte.create({
          data: {
            name: text.title,
            ntext: aiAnalysis.summary, // We store the AI generated summary
            datetext: text.date,
            njournal: text.source,
            created: new Date(),
            lang: 'fr',
            published: true,
            // Assuming sector ID 1 is dynamically extracted by AI in a real scenario
            secteurId: 1
          }
        });
        
        this.logger.log(`Nouveau texte enregistré: ${text.title}`);
      }

      this.logger.log('Scraping terminé avec succès.');

    } catch (error) {
      this.logger.error('Erreur lors du scraping', error);
    }
  }

  /**
   * Internal function to send scraped raw data to Ollama for structuring
   */
  private async analyzeTextWithAI(title: string, content: string) {
    const prompt = `Tu es un assistant juridique d'extraction de données.
Lis le texte de loi tunisien suivant et retourne un résumé concis et clair en 3 phrases maximum.

Titre: ${title}
Texte original: ${content}

Résumé court:`;

    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3', 
          prompt: prompt,
          stream: false,
        }),
      });

      if (!response.ok) throw new Error();
      const data = await response.json();
      return { summary: data.response };
    } catch {
      // Fallback if AI is offline
      return { summary: content };
    }
  }
}

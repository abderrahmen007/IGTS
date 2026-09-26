import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

export interface ScrapedText {
  titre: string;
  num: string;
  journal: string;
  date: string;
  content: string;
}

/**
 * Nightly collection of new legal texts.
 *
 * Status: the source connector (iort.gov.tn) is NOT implemented yet. The job is
 * disabled unless SCRAPER_ENABLED=true, and it never publishes on its own:
 * texts are saved as drafts (enabled=false) for an IGTS reviewer to validate.
 */
@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async nightlyRun() {
    if (this.config.get<string>('SCRAPER_ENABLED') !== 'true') return;
    const texts = await this.fetchNewTexts();
    for (const t of texts) await this.saveDraft(t);
    this.logger.log(`Scraper: ${texts.length} nouveau(x) texte(s) enregistré(s) en brouillon`);
  }

  /** TODO: implement the iort.gov.tn connector (session-based WebDev site, PDFs, some scanned). */
  private async fetchNewTexts(): Promise<ScrapedText[]> {
    this.logger.warn('Scraper enabled but no source connector is implemented yet');
    return [];
  }

  private async saveDraft(t: ScrapedText) {
    const exists = await this.prisma.texte.findFirst({ where: { num: t.num, titre: t.titre } });
    if (exists) return;
    const summary = await this.summarize(t.titre, t.content);
    await this.prisma.texte.create({
      data: {
        titre: t.titre,
        num: t.num,
        journal: t.journal,
        date: t.date,
        description: summary,
        createdAt: new Date(),
        deleted: false,
        enabled: false, // draft — must be reviewed before clients see it
        active: false,
      },
    });
  }

  private async summarize(titre: string, content: string): Promise<string> {
    const url = (this.config.get<string>('OLLAMA_URL') ?? 'http://localhost:11434').replace(/\/$/, '');
    const prompt = `Résume ce texte juridique tunisien en 3 phrases maximum, en français, sans rien inventer.

Titre : ${titre}
Texte : ${content}

Résumé :`;
    try {
      const res = await fetch(`${url}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.get<string>('OLLAMA_MODEL') ?? 'llama3',
          prompt,
          stream: false,
          options: { temperature: 0.1 },
        }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { response?: string };
      return data.response?.trim() || content;
    } catch {
      return content;
    }
  }
}

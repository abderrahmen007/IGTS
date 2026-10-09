import {
  ConflictException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import { DraftsStore, type Draft, type RunRecord } from './drafts.store';
import { DraftsService, normalizeTitle } from './drafts.service';
import { IortError, IortSource, type JortIssue } from './iort.source';
import { JortAnalyzerService } from './jort-analyzer.service';
import { extractPages, isPdf, pageCount } from './pdf-pages';
import { PrismaService } from '../prisma/prisma.service';

export const SCHEDULE = '30 8 * * *';
export const TIME_ZONE = 'Africa/Tunis';
const JOB = 'veille-jort';

const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/** "09/10/2026" → "9 octobre 2026" (the format used by the existing texts). */
export function frenchDate(ddmmyyyy: string): string {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(ddmmyyyy.trim());
  if (!m) return ddmmyyyy;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${Number(m[1])} ${month} ${m[3]}` : ddmmyyyy;
}

/** Hour and minute now in Tunis, plus the date (YYYY-MM-DD). */
function tunisNow(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return {
    day: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

interface Source {
  kind: 'iort' | 'import';
  issueKey: string;
  /** "JORT n° 099 du 09/10/2026" (when known before the analysis) */
  label: string | null;
  numero: string | null;
  date: string | null;
  url: string | null;
}

/**
 * Daily collection of the Official Journal (every day at 8:30, Tunis time).
 *
 *  1. lists the latest issues on www.iort.tn and keeps those not read yet;
 *  2. downloads each French PDF and has the AI pick the texts that concern
 *     the watch, classify them and write their summary;
 *  3. saves them as drafts, cuts each text's pages into its own PDF;
 *  4. e-mails the administrators, who publish with one click (or after a
 *     review on the platform). Nothing reaches a client before that.
 *
 * Runs only when SCRAPER_ENABLED=true. If the server was off at 8:30, the
 * collection runs a minute after it starts again.
 */
@Injectable()
export class ScraperService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ScraperService.name);
  private readonly enabled: boolean;
  private readonly firstRunIssues: number;
  private current: RunRecord | null = null;

  constructor(
    private store: DraftsStore,
    private drafts: DraftsService,
    private iort: IortSource,
    private analyzer: JortAnalyzerService,
    private prisma: PrismaService,
    private scheduler: SchedulerRegistry,
    config: ConfigService,
  ) {
    this.enabled = config.get<string>('SCRAPER_ENABLED') === 'true';
    this.firstRunIssues = Math.max(
      1,
      Number(config.get<string>('SCRAPER_FIRST_RUN_ISSUES') ?? 1) || 1,
    );
  }

  onApplicationBootstrap() {
    if (!this.enabled) {
      this.logger.log(
        'Collecte automatique du JORT désactivée (SCRAPER_ENABLED=false)',
      );
      return;
    }
    this.logger.log(
      `Collecte automatique du JORT : tous les jours à 8 h 30 (${TIME_ZONE})`,
    );
    if (this.missedToday()) {
      this.logger.log(
        'La collecte de 8 h 30 n’a pas eu lieu aujourd’hui : rattrapage dans une minute',
      );
      setTimeout(
        () => void this.start('catch-up').catch(() => undefined),
        60_000,
      ).unref();
    }
  }

  /** True when it is past 8:30 in Tunis and no collection has completed since. */
  private missedToday(): boolean {
    const now = tunisNow();
    if (now.minutes < 8 * 60 + 30) return false;
    return !this.store
      .runs()
      .some(
        (r) =>
          r.trigger !== 'import' &&
          r.status !== 'error' &&
          r.status !== 'running' &&
          tunisNow(new Date(r.startedAt)).day === now.day,
      );
  }

  @Cron(SCHEDULE, { name: JOB, timeZone: TIME_ZONE })
  async scheduled() {
    if (!this.enabled) return;
    await this.start('schedule').catch(() => undefined);
  }

  status() {
    let nextRun: string | null = null;
    try {
      nextRun = this.enabled
        ? this.scheduler.getCronJob(JOB).nextDate().toISO()
        : null;
    } catch {
      nextRun = null;
    }
    return {
      enabled: this.enabled,
      schedule: 'Tous les jours à 8 h 30 (heure de Tunis)',
      nextRun,
      aiAvailable: this.analyzer.available,
      aiModel: this.analyzer.model,
      running: this.current,
      runs: this.store.runs().slice(0, 10),
      issues: this.store.issues().slice(0, 10),
      pending: this.store.pendingCount(),
    };
  }

  run(id: number): RunRecord | null {
    return this.store.runs().find((r) => r.id === id) ?? null;
  }

  /** Starts a collection in the background and returns its record at once. */
  async start(trigger: 'schedule' | 'manual' | 'catch-up'): Promise<RunRecord> {
    const run = await this.begin(trigger);
    void this.collect(run);
    return run;
  }

  /** Reads a PDF given by an administrator (an issue or a single text). */
  async startImport(pdf: Buffer, fileName: string): Promise<RunRecord> {
    if (!isPdf(pdf))
      throw new ConflictException('Le fichier doit être un PDF.');
    const run = await this.begin('import');
    void (async () => {
      try {
        run.steps.push(`Fichier importé : ${fileName}`);
        const { drafts: created } = await this.processPdf(
          pdf,
          {
            kind: 'import',
            issueKey: `import-${Date.now()}`,
            label: null,
            numero: null,
            date: null,
            url: null,
          },
          run,
        );
        await this.finish(
          run,
          created.length ? 'ok' : 'nothing-new',
          created.length
            ? `${created.length} texte(s) préparé(s) à partir de « ${fileName} »`
            : `Aucun texte de « ${fileName} » ne concerne la veille`,
        );
      } catch (e) {
        await this.finish(run, 'error', (e as Error).message);
      }
    })();
    return run;
  }

  private async begin(trigger: RunRecord['trigger']): Promise<RunRecord> {
    if (this.current)
      throw new ConflictException(
        'Une collecte est déjà en cours. Réessayez dans quelques minutes.',
      );
    if (!this.analyzer.available) {
      throw new ServiceUnavailableException(
        'L’analyse IA est indisponible : ajoutez GEMINI_API_KEY dans backend/.env.',
      );
    }
    const run = await this.store.startRun(trigger);
    this.current = run;
    return run;
  }

  private async finish(
    run: RunRecord,
    status: RunRecord['status'],
    message: string,
  ) {
    await this.store.finishRun(run, { status, message });
    this.current = null;
    this.logger.log(`Collecte n° ${run.id} : ${message}`);
  }

  private async collect(run: RunRecord) {
    const created: Draft[] = [];
    const read: string[] = [];
    const ignored: string[] = [];
    const log = (step: string) => {
      run.steps.push(step);
      void this.store.saveRun(run);
    };
    try {
      const { issues, page } = await this.iort.latestIssues(log);
      const firstRun = this.store.issues().length === 0;
      let todo = issues.filter((i) => !this.store.hasIssue(i.key));

      if (firstRun && todo.length > this.firstRunIssues) {
        // First collection: start from the latest issue(s) instead of the whole list
        const skipped = todo.slice(this.firstRunIssues);
        todo = todo.slice(0, this.firstRunIssues);
        for (const s of skipped) {
          await this.store.addIssue({
            key: s.key,
            label: s.label,
            processedAt: new Date().toISOString(),
            drafts: 0,
            ignored: 0,
          });
        }
        log(
          `Première collecte : numéros antérieurs non lus (${skipped.map((s) => s.numero).join(', ')})`,
        );
      }

      if (!todo.length) {
        await this.finish(
          run,
          'nothing-new',
          `Pas de nouveau numéro (dernier paru : ${issues[0]?.label ?? '—'})`,
        );
        return;
      }

      // Oldest first, so drafts follow the order of publication
      for (const issue of [...todo].reverse()) {
        const pdf = await this.iort.download(page, issue);
        const result = await this.processPdf(pdf, this.sourceOf(issue), run);
        created.push(...result.drafts);
        read.push(issue.label);
        run.issues = [...read];
        if (result.ignored) ignored.push(`${issue.label} : ${result.ignored}`);
      }

      await this.finish(
        run,
        'ok',
        created.length
          ? `${created.length} texte(s) à valider dans le ${read.join(' et le ')}`
          : `${read.join(', ')} lu : aucun texte ne concerne la veille`,
      );
      await this.drafts.notifyNewDrafts(created, read, ignored.join(' ; '));
    } catch (e) {
      const message =
        e instanceof IortError
          ? e.message
          : `Erreur inattendue : ${(e as Error).message}`;
      this.logger.error(message);
      await this.finish(run, 'error', message);
      if (created.length) await this.drafts.notifyNewDrafts(created, read, '');
      if (run.trigger !== 'manual') await this.drafts.notifyFailure(message);
    }
  }

  private sourceOf(issue: JortIssue): Source {
    return {
      kind: 'iort',
      issueKey: issue.key,
      label: issue.label,
      numero: String(Number(issue.numero)),
      date: issue.date,
      url: 'https://www.iort.tn/siteiort/',
    };
  }

  /** AI reading of one PDF, then one draft per text that concerns the watch. */
  private async processPdf(
    pdf: Buffer,
    source: Source,
    run: RunRecord,
  ): Promise<{ drafts: Draft[]; ignored: string }> {
    const pages = await pageCount(pdf);
    const issuePdf = await this.store.saveFile(
      source.kind === 'iort' ? `jort-${source.issueKey}` : 'import',
      pdf,
    );
    run.steps.push(
      `Lecture par l’IA${source.label ? ` du ${source.label}` : ''}${pages ? ` (${pages} pages)` : ''}…`,
    );
    await this.store.saveRun(run);

    const analysis = await this.analyzer.analyze(pdf, pages);
    const numero =
      source.numero ??
      (analysis.issueNumber
        ? String(Number(analysis.issueNumber) || analysis.issueNumber)
        : '');
    const longDate = source.date ? frenchDate(source.date) : analysis.issueDate;
    const label =
      source.label ??
      (numero
        ? `JORT n° ${numero}${longDate ? ` du ${longDate}` : ''}`
        : 'PDF importé');
    const journal = numero ? `JORT n° ${numero}` : '';

    // Already in the base, or already drafted from an earlier reading
    const known = new Set(
      (
        await this.prisma.texte.findMany({
          where: { deleted: false },
          select: { titre: true },
        })
      ).map((t) => normalizeTitle(t.titre)),
    );
    for (const d of this.store.list()) known.add(normalizeTitle(d.titre));

    const created: Draft[] = [];
    let duplicates = 0;
    for (const t of analysis.texts) {
      if (known.has(normalizeTitle(t.titre))) {
        duplicates++;
        continue;
      }
      known.add(normalizeTitle(t.titre));
      let file = issuePdf;
      if (t.pages) {
        const part = await extractPages(pdf, t.pages[0], t.pages[1]);
        if (part)
          file = await this.store.saveFile(
            `texte-${source.issueKey}-p${t.pages[0]}`,
            part,
          );
      }
      created.push(
        await this.store.add({
          titre: t.titre,
          description: t.summary,
          journal,
          date: longDate,
          num: t.num,
          typeId: t.typeId,
          secteurId: t.secteurId,
          themeId: t.themeId,
          pdf: file,
          ai: {
            model: analysis.model,
            confidence: t.confidence,
            reason: t.reason,
            keyPoints: t.keyPoints,
            ministere: t.ministere,
            signedOn: t.signedOn,
            needsReview: t.needsReview,
          },
          source: {
            kind: source.kind,
            issue: label,
            issueKey: source.issueKey,
            pages: t.pages,
            url: source.url,
            issuePdf,
          },
        }),
      );
    }

    await this.store.addIssue({
      key: source.issueKey,
      label,
      processedAt: new Date().toISOString(),
      drafts: created.length,
      ignored: analysis.ignoredCount,
    });
    run.steps.push(
      `${label} : ${created.length} texte(s) retenu(s)` +
        (duplicates ? `, ${duplicates} déjà connu(s)` : '') +
        (analysis.ignoredSummary
          ? ` ; écartés : ${analysis.ignoredSummary}`
          : ''),
    );
    run.drafts += created.length;
    await this.store.saveRun(run);
    return { drafts: created, ignored: analysis.ignoredSummary };
  }
}

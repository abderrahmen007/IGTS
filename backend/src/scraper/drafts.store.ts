import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { existsSync, mkdirSync, readFileSync, promises as fs } from 'fs';
import { basename, dirname, join, resolve } from 'path';

export type DraftStatus = 'pending' | 'published' | 'rejected';

/** Who acted on a draft, and from where (the e-mail link or the platform). */
export interface DraftActor {
  id: number;
  nom: string;
  via: 'email' | 'platform';
}

/**
 * A text found in the Official Journal and prepared by the AI. It becomes a
 * real `texte` only when an IGTS administrator publishes it.
 */
export interface Draft {
  id: number;
  status: DraftStatus;
  createdAt: string;
  updatedAt: string;

  // Fields of the future text (same meaning as in the `texte` table)
  titre: string;
  description: string;
  journal: string;
  date: string;
  num: string;
  typeId: number | null;
  secteurId: number | null;
  themeId: number | null;
  /** PDF of this text only (pages cut from the issue), in UPLOADS_DIR/brouillons */
  pdf: string | null;

  ai: {
    model: string;
    /** 0–1: how sure the AI is that the text concerns the watch and is well classified */
    confidence: number;
    /** Why it belongs to the watch, in one sentence */
    reason: string;
    keyPoints: string[];
    ministere: string;
    signedOn: string;
    /** Points the reviewer should check (uncertain theme, translated title…) */
    needsReview: string[];
  };

  source: {
    kind: 'iort' | 'import';
    /** "JORT n° 118 du 7 octobre 2026" */
    issue: string;
    issueKey: string;
    /** Pages of the text in the issue PDF (1 = first page of the file) */
    pages: [number, number] | null;
    url: string | null;
    /** Whole issue PDF kept for reference, in UPLOADS_DIR/brouillons */
    issuePdf: string | null;
  };

  publishedTextId?: number;
  publishedAt?: string;
  publishedBy?: DraftActor;
  rejectedAt?: string;
  rejectedBy?: DraftActor;
  rejectReason?: string;
}

export interface IssueRecord {
  key: string;
  label: string;
  processedAt: string;
  drafts: number;
  ignored: number;
}

export interface RunRecord {
  id: number;
  trigger: 'schedule' | 'manual' | 'catch-up' | 'import';
  startedAt: string;
  finishedAt: string | null;
  status: 'running' | 'ok' | 'nothing-new' | 'error';
  message: string;
  issues: string[];
  drafts: number;
  /** Steps followed on the source site, shown to the admin when something fails */
  steps: string[];
}

interface StoreData {
  nextId: number;
  drafts: Draft[];
  issues: IssueRecord[];
  runs: RunRecord[];
}

const EMPTY: StoreData = { nextId: 1, drafts: [], issues: [], runs: [] };
const KEEP_RUNS = 60;

/**
 * Drafts and run history, kept in a JSON file (VEILLE_DATA_FILE) and their
 * PDFs in UPLOADS_DIR/brouillons. Like the preferences, nothing is written to
 * the MySQL database shared with the legacy Symfony app until a draft is
 * published: unpublished drafts can never reach a client or the old admin.
 */
@Injectable()
export class DraftsStore {
  private readonly logger = new Logger(DraftsStore.name);
  private readonly file: string;
  readonly filesDir: string;
  private data: StoreData = structuredClone(EMPTY);
  private writing: Promise<void> = Promise.resolve();

  constructor(config: ConfigService) {
    this.file = resolve(
      config.get<string>('VEILLE_DATA_FILE') ?? 'data/veille.json',
    );
    this.filesDir = resolve(
      config.get<string>('UPLOADS_DIR') ?? 'uploads',
      'brouillons',
    );
    mkdirSync(dirname(this.file), { recursive: true });
    mkdirSync(this.filesDir, { recursive: true });
    if (existsSync(this.file)) {
      try {
        this.data = {
          ...structuredClone(EMPTY),
          ...(JSON.parse(readFileSync(this.file, 'utf8')) as StoreData),
        };
      } catch (e) {
        this.logger.error(
          `Brouillons illisibles (${this.file}) : ${(e as Error).message}`,
        );
      }
    }
    // A collection cut short by a restart of the server would stay "running" forever
    for (const r of this.data.runs) {
      if (r.status !== 'running') continue;
      r.status = 'error';
      r.message = 'Interrompue par un redémarrage du serveur';
      r.finishedAt = r.finishedAt ?? new Date().toISOString();
    }
  }

  // ─── Drafts ─────────────────────────────────────────────────────────

  list(status?: DraftStatus): Draft[] {
    const all = status
      ? this.data.drafts.filter((d) => d.status === status)
      : this.data.drafts;
    return [...all].sort((a, b) => b.id - a.id);
  }

  get(id: number): Draft | null {
    return this.data.drafts.find((d) => d.id === id) ?? null;
  }

  pendingCount(): number {
    return this.data.drafts.filter((d) => d.status === 'pending').length;
  }

  async add(
    draft: Omit<Draft, 'id' | 'createdAt' | 'updatedAt' | 'status'>,
  ): Promise<Draft> {
    const now = new Date().toISOString();
    const d: Draft = {
      ...draft,
      id: this.data.nextId++,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    this.data.drafts.push(d);
    await this.persist();
    return d;
  }

  async update(id: number, patch: Partial<Draft>): Promise<Draft> {
    const d = this.get(id);
    if (!d) throw new Error(`Brouillon ${id} introuvable`);
    Object.assign(d, patch, { updatedAt: new Date().toISOString() });
    await this.persist();
    return d;
  }

  // ─── Issues already read and runs ───────────────────────────────────

  hasIssue(key: string): boolean {
    return this.data.issues.some((i) => i.key === key);
  }

  issues(): IssueRecord[] {
    return [...this.data.issues].sort((a, b) =>
      b.processedAt.localeCompare(a.processedAt),
    );
  }

  async addIssue(rec: IssueRecord) {
    this.data.issues = this.data.issues.filter((i) => i.key !== rec.key);
    this.data.issues.push(rec);
    await this.persist();
  }

  runs(): RunRecord[] {
    return [...this.data.runs].sort((a, b) => b.id - a.id);
  }

  async startRun(trigger: RunRecord['trigger']): Promise<RunRecord> {
    const id = (this.data.runs.reduce((m, r) => Math.max(m, r.id), 0) || 0) + 1;
    const run: RunRecord = {
      id,
      trigger,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      status: 'running',
      message: '',
      issues: [],
      drafts: 0,
      steps: [],
    };
    this.data.runs.push(run);
    this.data.runs = this.data.runs
      .sort((a, b) => a.id - b.id)
      .slice(-KEEP_RUNS);
    await this.persist();
    return run;
  }

  /** Saves the progress of a running collection (shown live to the admin). */
  async saveRun(run: RunRecord) {
    await this.persist();
    return run;
  }

  async finishRun(run: RunRecord, patch: Partial<RunRecord>) {
    Object.assign(run, patch, { finishedAt: new Date().toISOString() });
    await this.persist();
  }

  // ─── Files ──────────────────────────────────────────────────────────

  async saveFile(prefix: string, buffer: Buffer): Promise<string> {
    const name = `${prefix}-${randomBytes(8).toString('hex')}.pdf`;
    await fs.writeFile(join(this.filesDir, name), buffer);
    return name;
  }

  async readFile(name: string): Promise<Buffer> {
    return fs.readFile(this.path(name));
  }

  /** Absolute path of a stored file (the name is reduced to its base name). */
  path(name: string): string {
    return join(this.filesDir, basename(name));
  }

  exists(name: string): boolean {
    return existsSync(this.path(name));
  }

  /** Writes are queued and atomic (temp file + rename). */
  private persist() {
    const snapshot = JSON.stringify(this.data, null, 2);
    const job = this.writing.then(async () => {
      const tmp = `${this.file}.tmp`;
      await fs.writeFile(tmp, snapshot);
      await fs.rename(tmp, this.file);
    });
    this.writing = job.catch((e: Error) =>
      this.logger.error(`Écriture des brouillons impossible : ${e.message}`),
    );
    return job;
  }
}

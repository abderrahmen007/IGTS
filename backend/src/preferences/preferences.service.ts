import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, readFileSync, promises as fs } from 'fs';
import { dirname, resolve } from 'path';

/** Personal settings of a company user (main account or sub-account). */
export interface UserPreferences {
  /** E-mail when new texts arrive in the watch list */
  emailNewTexts: boolean;
  /** E-mail reminders 7 days / 1 day before an action deadline, and when late */
  emailReminders: boolean;
  /** When the guided tour was finished or skipped (null = show it on next visit) */
  tourSeenAt: string | null;
}

/** Drops undefined keys (validated DTO instances carry every declared field). */
function defined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  emailNewTexts: true,
  emailReminders: true,
  tourSeenAt: null,
};

/**
 * Stores user preferences in a small JSON file (PREFERENCES_FILE) instead of
 * the shared MySQL database, which the legacy Symfony app still uses and whose
 * schema must not change for now. Move to a table once Symfony is retired.
 */
@Injectable()
export class PreferencesService {
  private readonly logger = new Logger(PreferencesService.name);
  private readonly file: string;
  private data: Record<string, Partial<UserPreferences>> = {};
  private writing: Promise<void> = Promise.resolve();

  constructor(config: ConfigService) {
    this.file = resolve(config.get<string>('PREFERENCES_FILE') ?? 'data/preferences.json');
    mkdirSync(dirname(this.file), { recursive: true });
    if (existsSync(this.file)) {
      try {
        this.data = JSON.parse(readFileSync(this.file, 'utf8')) as typeof this.data;
      } catch (e) {
        this.logger.error(`Préférences illisibles (${this.file}) : ${(e as Error).message}`);
      }
    }
  }

  get(accountId: number): UserPreferences {
    return { ...DEFAULT_PREFERENCES, ...defined(this.data[String(accountId)] ?? {}) };
  }

  async update(accountId: number, patch: Partial<UserPreferences>): Promise<UserPreferences> {
    const next = { ...this.get(accountId), ...defined(patch) };
    this.data[String(accountId)] = next;
    await this.persist();
    return next;
  }

  /** Keeps only the e-mails of accounts that accept this kind of message. */
  filter<T extends { id: number }>(accounts: T[], key: 'emailNewTexts' | 'emailReminders'): T[] {
    return accounts.filter((a) => this.get(a.id)[key]);
  }

  /** Writes are queued and atomic (temp file + rename). */
  private persist() {
    const snapshot = JSON.stringify(this.data, null, 2);
    const job = this.writing.then(async () => {
      const tmp = `${this.file}.tmp`;
      await fs.writeFile(tmp, snapshot);
      await fs.rename(tmp, this.file);
    });
    // A failed write must not block the next ones
    this.writing = job.catch((e: Error) => this.logger.error(`Écriture des préférences impossible : ${e.message}`));
    return job;
  }
}

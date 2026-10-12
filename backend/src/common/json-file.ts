import { Logger } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, promises as fs } from 'fs';
import { dirname, resolve } from 'path';

/**
 * A small JSON document on disk, for data that must not go into the MySQL
 * database shared with the legacy Symfony app (its schema stays untouched
 * until Symfony is retired). Reads are from memory; writes are queued and
 * atomic (temporary file, then rename).
 */
export class JsonFile<T extends object> {
  private readonly logger: Logger;
  readonly path: string;
  data: T;
  private writing: Promise<void> = Promise.resolve();

  constructor(path: string, empty: () => T, name = 'JsonFile') {
    this.logger = new Logger(name);
    this.path = resolve(path);
    mkdirSync(dirname(this.path), { recursive: true });
    this.data = empty();
    if (existsSync(this.path)) {
      try {
        this.data = {
          ...empty(),
          ...(JSON.parse(readFileSync(this.path, 'utf8')) as T),
        };
      } catch (e) {
        this.logger.error(
          `Fichier illisible (${this.path}) : ${(e as Error).message}`,
        );
      }
    }
  }

  save(): Promise<void> {
    const snapshot = JSON.stringify(this.data, null, 2);
    const job = this.writing.then(async () => {
      const tmp = `${this.path}.tmp`;
      await fs.writeFile(tmp, snapshot);
      await fs.rename(tmp, this.path);
    });
    this.writing = job.catch((e: Error) =>
      this.logger.error(`Écriture impossible (${this.path}) : ${e.message}`),
    );
    return job;
  }
}

/** Today as YYYY-MM-DD in Tunis (the dates IGTS and its clients reason in). */
export function tunisDay(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Tunis',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );
}

/** YYYY-MM-DD + n days. */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** YYYY-MM-DD + n years (29 February → 28 February). */
export function addYears(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y + n, m - 1, d));
  if (date.getUTCMonth() !== m - 1) date.setUTCDate(0);
  return date.toISOString().slice(0, 10);
}

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

/** "2026-11-12" → "12 novembre 2026". */
export function frenchDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JsonFile } from '../common/json-file';

export type ActivityType =
  | 'login'
  | 'subscription'
  | 'account'
  | 'feedback'
  | 'text-published'
  | 'veille';

export interface ActivityEvent {
  at: string;
  type: ActivityType;
  actor: {
    kind: 'admin' | 'company' | 'system';
    id: number | null;
    nom: string;
  };
  /** Main company concerned, when there is one */
  companyId: number | null;
  /** Sentence shown in the admin's activity feed */
  label: string;
}

const KEEP = 20_000;

/**
 * Journal of what happens on the platform that the database does not record
 * by itself (sign-ins, subscription changes, accounts, surveys…), for the
 * administrators' statistics. Evaluations and actions are read from their
 * own legacy tables.
 */
@Injectable()
export class ActivityService {
  private readonly file: JsonFile<{ events: ActivityEvent[] }>;

  constructor(config: ConfigService) {
    this.file = new JsonFile(
      config.get<string>('ACTIVITY_FILE') ?? 'data/activity.json',
      () => ({ events: [] }),
      'ActivityService',
    );
  }

  log(event: Omit<ActivityEvent, 'at'>) {
    this.file.data.events.push({ ...event, at: new Date().toISOString() });
    if (this.file.data.events.length > KEEP)
      this.file.data.events.splice(0, this.file.data.events.length - KEEP);
    void this.file.save();
  }

  /** Newest first. */
  recent(limit = 50, filter?: (e: ActivityEvent) => boolean): ActivityEvent[] {
    const out: ActivityEvent[] = [];
    const events = this.file.data.events;
    for (let i = events.length - 1; i >= 0 && out.length < limit; i--) {
      if (!filter || filter(events[i])) out.push(events[i]);
    }
    return out;
  }

  since(fromIso: string, type?: ActivityType): ActivityEvent[] {
    return this.file.data.events.filter(
      (e) => e.at >= fromIso && (!type || e.type === type),
    );
  }

  /** Last sign-in of each company (any of its accounts). */
  lastLogins(): Map<number, string> {
    const last = new Map<number, string>();
    for (const e of this.file.data.events) {
      if (e.type === 'login' && e.companyId) last.set(e.companyId, e.at);
    }
    return last;
  }
}

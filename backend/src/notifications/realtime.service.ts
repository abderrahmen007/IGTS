import { Injectable } from '@nestjs/common';
import { Observable, Subject, filter, interval, map, merge } from 'rxjs';

export interface LiveEvent {
  type: 'notification' | 'refresh';
  unread?: number;
  item?: {
    id?: number;
    message: string;
    texteTitre?: string | null;
    texteSocieteId?: number | null;
    createdAt: string;
  };
}

interface Envelope {
  ownerId: number;
  event: LiveEvent;
}

/** In-memory event bus pushed to browsers over Server-Sent Events. */
@Injectable()
export class RealtimeService {
  private readonly bus = new Subject<Envelope>();

  publish(ownerId: number, event: LiveEvent) {
    this.bus.next({ ownerId, event });
  }

  /** Stream for one company (main account and its sub-accounts share it). */
  stream(ownerId: number): Observable<{ data: LiveEvent | { type: 'ping' } }> {
    const events = this.bus.pipe(
      filter((e) => e.ownerId === ownerId),
      map((e) => ({ data: e.event })),
    );
    // Heartbeat keeps proxies from closing idle connections
    const pings = interval(25_000).pipe(map(() => ({ data: { type: 'ping' as const } })));
    return merge(events, pings);
  }
}

import { Controller, Query, Sse, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Observable } from 'rxjs';
import { RealtimeService } from './realtime.service';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private jwt: JwtService,
    private realtime: RealtimeService,
  ) {}

  /**
   * GET /api/notifications/stream?token=… — Server-Sent Events.
   * Browsers' EventSource cannot send headers, so the JWT comes in the query.
   */
  @Sse('stream')
  stream(@Query('token') token?: string): Observable<{ data: unknown }> {
    let payload: { type?: string; ownerId?: number | null };
    try {
      payload = this.jwt.verify(token ?? '');
    } catch {
      throw new UnauthorizedException();
    }
    if (payload.type !== 'company' || !payload.ownerId) throw new UnauthorizedException();
    return this.realtime.stream(payload.ownerId);
  }
}

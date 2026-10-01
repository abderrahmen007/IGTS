import { Controller, HttpCode, Post, Query, Sse, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { Observable } from 'rxjs';
import { CompanyOnlyGuard, CurrentUser } from '../common/auth-user';
import type { AuthUser } from '../common/auth-user';
import { RealtimeService } from './realtime.service';

/** Lifetime of a live-stream token: just long enough to open the connection. */
const STREAM_TOKEN_TTL = 60; // seconds

@Controller('notifications')
export class NotificationsController {
  constructor(
    private jwt: JwtService,
    private realtime: RealtimeService,
  ) {}

  /**
   * POST /api/notifications/stream-token — a one-minute token used only to
   * open the live stream. Browsers' EventSource cannot send headers, so the
   * token travels in the URL, where proxies and tunnels log it: it must not be
   * the session token.
   */
  @UseGuards(AuthGuard('jwt'), CompanyOnlyGuard)
  @Post('stream-token')
  @HttpCode(200)
  streamToken(@CurrentUser() me: AuthUser) {
    return {
      token: this.jwt.sign({ type: 'stream', sub: me.id, ownerId: me.ownerId }, { expiresIn: STREAM_TOKEN_TTL }),
    };
  }

  /** GET /api/notifications/stream?token=… — Server-Sent Events. */
  @Sse('stream')
  stream(@Query('token') token?: string): Observable<{ data: unknown }> {
    let payload: { type?: string; ownerId?: number | null };
    try {
      payload = this.jwt.verify(token ?? '');
    } catch {
      throw new UnauthorizedException();
    }
    if (payload.type !== 'stream' || !payload.ownerId) throw new UnauthorizedException();
    return this.realtime.stream(payload.ownerId);
  }
}

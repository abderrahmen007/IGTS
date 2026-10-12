import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser, canEditFromRights } from '../../common/auth-user';
import { PrismaService } from '../../prisma/prisma.service';
import { requireJwtSecret } from '../jwt-secret';
import { SUBSCRIPTION_LOCKED, SubscriptionsService } from '../../accounts/subscriptions.service';

interface JwtPayload {
  sub: number;
  type: AuthUser['type'];
  email: string;
  nom: string;
  ownerId: number | null;
}

const DISABLED = 'Ce compte est désactivé. Contactez IGTS.';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
    private subscriptions: SubscriptionsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: requireJwtSecret(config),
    });
  }

  /**
   * The token proves identity; the account itself is re-read so that a
   * deactivation or a change of rights by IGTS applies without waiting for
   * the token to expire.
   */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (payload.type === 'admin') {
      const admin = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, nomComplet: true, username: true, valid: true, deleted: true },
      });
      if (!admin || !admin.valid || admin.deleted) throw new UnauthorizedException(DISABLED);
      return {
        id: admin.id,
        type: 'admin',
        email: admin.email,
        nom: admin.nomComplet || admin.username,
        ownerId: null,
        canEdit: true,
      };
    }

    // Only session tokens open the API (not, e.g., the short-lived live-stream tokens)
    if (payload.type !== 'company') throw new UnauthorizedException();

    const company = await this.prisma.company.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, nom: true, multicompte: true, droitacceeId: true, deleted: true, activated: true },
    });
    if (!company || company.deleted || !company.activated) throw new UnauthorizedException(DISABLED);
    const ownerId = company.multicompte > 0 ? company.multicompte : company.id;
    const subscription = this.subscriptions.info(ownerId);
    if (subscription.locked) {
      // The web app recognises the code and shows the message on the sign-in page
      throw new UnauthorizedException({ statusCode: 401, code: SUBSCRIPTION_LOCKED, message: subscription.message });
    }
    return {
      id: company.id,
      type: 'company',
      email: company.email,
      nom: company.nom,
      ownerId,
      canEdit: canEditFromRights(company.multicompte, company.droitacceeId),
    };
  }
}

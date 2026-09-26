import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser } from '../../common/auth-user';
import { requireJwtSecret } from '../jwt-secret';

interface JwtPayload {
  sub: number;
  type: AuthUser['type'];
  email: string;
  nom: string;
  ownerId: number | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: requireJwtSecret(config),
    });
  }

  validate(payload: JwtPayload): AuthUser {
    return {
      id: payload.sub,
      type: payload.type,
      email: payload.email,
      nom: payload.nom,
      ownerId: payload.ownerId ?? null,
    };
  }
}

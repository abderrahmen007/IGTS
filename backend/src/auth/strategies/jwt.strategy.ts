import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'igts-veille-secret-key-2026',
    });
  }

  async validate(payload: any) {
    return {
      id: payload.sub,
      email: payload.email,
      nom: payload.nom,
      roles: payload.roles,
      type: payload.type,
    };
  }
}

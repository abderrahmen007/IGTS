import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  createParamDecorator,
} from '@nestjs/common';

export type AccountType = 'company' | 'admin';

/** Shape of `req.user` after JWT validation. */
export interface AuthUser {
  id: number;
  type: AccountType;
  email: string;
  nom: string;
  /**
   * Company whose texts this account works on. For a sub-account
   * ("multicompte") this is the parent company, otherwise the company itself.
   * Always null for admins.
   */
  ownerId: number | null;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest().user,
);

@Injectable()
export class CompanyOnlyGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const user: AuthUser | undefined = ctx.switchToHttp().getRequest().user;
    if (user?.type !== 'company' || !user.ownerId) {
      throw new ForbiddenException('Accès réservé aux comptes entreprise');
    }
    return true;
  }
}

@Injectable()
export class AdminOnlyGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const user: AuthUser | undefined = ctx.switchToHttp().getRequest().user;
    if (user?.type !== 'admin') {
      throw new ForbiddenException('Accès réservé aux administrateurs');
    }
    return true;
  }
}

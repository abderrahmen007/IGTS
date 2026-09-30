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
  /**
   * False for read-only sub-accounts. Re-read from the database on every
   * request, so a change of rights applies immediately.
   */
  canEdit: boolean;
}

/** Legacy `droitaccee` ids: 2 = "Tous les droits"; 1 and 5 = read-only. */
export const DROIT_TOUS = 2;

/**
 * Same rule as the Symfony templates: the main account and sub-accounts whose
 * right is empty or "Tous les droits" may modify; the others only read.
 */
export function canEditFromRights(multicompte: number, droitacceeId: number | null): boolean {
  return multicompte <= 0 || droitacceeId === null || droitacceeId === DROIT_TOUS;
}

export const READ_ONLY_MESSAGE =
  'Votre compte est en lecture seule. Demandez l’accès à l’administrateur de votre compte.';

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

/** Blocks read-only sub-accounts on endpoints that change evaluations or actions. */
@Injectable()
export class EditorGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const user: AuthUser | undefined = ctx.switchToHttp().getRequest().user;
    if (!user?.canEdit) throw new ForbiddenException(READ_ONLY_MESSAGE);
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

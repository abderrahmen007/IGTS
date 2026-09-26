import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { AuthUser } from '../common/auth-user';

const INVALID = 'Adresse e-mail ou mot de passe incorrect';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  /**
   * Verifies a password hashed by the legacy Symfony app.
   * Symfony's "auto" hasher produced argon2id hashes; one legacy account still
   * has a bcrypt ($2y$) hash, which is refused cleanly instead of crashing.
   */
  private async verifyPassword(hash: string, plain: string): Promise<boolean> {
    if (hash.startsWith('$argon2')) {
      try {
        return await argon2.verify(hash, plain);
      } catch (e) {
        this.logger.warn(`Malformed argon2 hash: ${(e as Error).message}`);
        return false;
      }
    }
    if (/^\$2[aby]\$/.test(hash)) {
      this.logger.warn('Login refused: account uses a legacy bcrypt hash — password must be reset');
    }
    return false;
  }

  async loginCompany(dto: LoginDto) {
    const company = await this.prisma.company.findUnique({ where: { email: dto.email.trim() } });
    if (!company || !(await this.verifyPassword(company.password, dto.password))) {
      throw new UnauthorizedException(INVALID);
    }
    if (!company.enabled || company.deleted) {
      throw new UnauthorizedException('Ce compte est désactivé. Contactez IGTS.');
    }

    const ownerId = company.multicompte > 0 ? company.multicompte : company.id;
    const user: AuthUser = {
      id: company.id,
      type: 'company',
      email: company.email,
      nom: company.nom,
      ownerId,
    };

    return {
      access_token: this.sign(user),
      user: {
        ...user,
        raisonsociale: company.raisonsociale,
        fonction: company.fonction,
        isSubAccount: company.multicompte > 0,
      },
    };
  }

  async loginAdmin(dto: LoginDto) {
    const admin = await this.prisma.user.findUnique({ where: { email: dto.email.trim() } });
    if (!admin || !(await this.verifyPassword(admin.password, dto.password))) {
      throw new UnauthorizedException(INVALID);
    }
    if (!admin.valid || admin.deleted) {
      throw new UnauthorizedException('Ce compte est désactivé.');
    }

    const user: AuthUser = {
      id: admin.id,
      type: 'admin',
      email: admin.email,
      nom: admin.nomComplet || admin.username,
      ownerId: null,
    };
    return { access_token: this.sign(user), user };
  }

  private sign(user: AuthUser) {
    return this.jwtService.sign({
      sub: user.id,
      type: user.type,
      email: user.email,
      nom: user.nom,
      ownerId: user.ownerId,
    });
  }

  async getProfile(user: AuthUser) {
    if (user.type === 'admin') {
      const admin = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, email: true, nomComplet: true, username: true, roles: true },
      });
      return admin && { ...admin, type: 'admin' };
    }
    const company = await this.prisma.company.findUnique({
      where: { id: user.id },
      select: {
        id: true, email: true, nom: true, raisonsociale: true, fonction: true,
        tel: true, adresse: true, ville: true, multicompte: true,
      },
    });
    return company && { ...company, type: 'company', ownerId: user.ownerId };
  }
}

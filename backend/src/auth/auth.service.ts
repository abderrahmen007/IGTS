import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { AuthUser, canEditFromRights } from '../common/auth-user';
import { verifyPassword } from '../common/password';

const INVALID = 'Adresse e-mail ou mot de passe incorrect';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async loginCompany(dto: LoginDto) {
    const company = await this.prisma.company.findUnique({ where: { email: dto.email.trim() } });
    if (!company || !(await verifyPassword(company.password, dto.password))) {
      throw new UnauthorizedException(INVALID);
    }
    // Same rule as the legacy CompanyChecker: deleted accounts and
    // deactivated ("activated = false") accounts cannot log in.
    if (company.deleted || !company.activated) {
      throw new UnauthorizedException('Ce compte est désactivé. Contactez IGTS.');
    }

    const ownerId = company.multicompte > 0 ? company.multicompte : company.id;
    const user: AuthUser = {
      id: company.id,
      type: 'company',
      email: company.email,
      nom: company.nom,
      ownerId,
      canEdit: canEditFromRights(company.multicompte, company.droitacceeId),
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
    if (!admin || !(await verifyPassword(admin.password, dto.password))) {
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
      canEdit: true,
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
    return company && { ...company, type: 'company', ownerId: user.ownerId, canEdit: user.canEdit };
  }
}

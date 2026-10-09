import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DROIT_LECTURE, DROIT_TOUS } from '../common/auth-user';
import type { AuthUser } from '../common/auth-user';
import { hashPassword } from '../common/password';
import { MailerService } from '../notifications/mailer.service';
import { welcomeEmail } from '../notifications/email-templates';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyService } from './company.service';
import { CreateTeamMemberDto, ResetMemberPasswordDto, UpdateTeamMemberDto } from './company.dto';

const clean = (v?: string | null) => (v?.trim() ? v.trim() : null);

/**
 * The company's main account manages its employees' accounts ("comptes
 * secondaires"): creation, access rights (Lecture seule / Lecture et
 * modification), activation and password reset. Accounts are stored exactly
 * as Symfony creates them (company row with `multicompte` = main account id),
 * so they also work on the legacy platform.
 */
@Injectable()
export class TeamService {
  constructor(
    private prisma: PrismaService,
    private company: CompanyService,
    private mailer: MailerService,
  ) {}

  /** A secondary account of the caller's company (never the main account itself). */
  private async member(user: AuthUser, id: number) {
    const m = await this.prisma.company.findFirst({ where: { id, multicompte: user.ownerId!, deleted: false } });
    if (!m) throw new NotFoundException('Ce compte ne fait pas partie de votre équipe.');
    return m;
  }

  private async assertEmailFree(email: string, exceptId?: number) {
    const other = await this.prisma.company.findFirst({
      where: { email: email.trim().toLowerCase(), ...(exceptId ? { NOT: { id: exceptId } } : {}) },
      select: { id: true },
    });
    if (other) throw new ConflictException('Cette adresse e-mail est déjà utilisée par un autre compte.');
  }

  async create(user: AuthUser, dto: CreateTeamMemberDto) {
    const owner = await this.prisma.company.findUnique({ where: { id: user.ownerId! } });
    if (!owner) throw new NotFoundException('Entreprise introuvable');
    const email = dto.email.trim().toLowerCase();
    await this.assertEmailFree(email);

    await this.prisma.company.create({
      data: {
        nom: dto.nom.trim(),
        email,
        tel: clean(dto.tel),
        fonction: clean(dto.fonction),
        password: await hashPassword(dto.password),
        roles: JSON.stringify(['ROLE_COMPANY']),
        multicompte: owner.id,
        raisonsociale: owner.raisonsociale,
        tmpphoto: owner.tmpphoto,
        droit: 1,
        droitacceeId: dto.canEdit ? DROIT_TOUS : DROIT_LECTURE,
        activated: true,
        enabled: true,
        deleted: false,
        createdAt: new Date(),
      },
    });

    // The password is never e-mailed: the main account hands it over itself
    void this.mailer.send({
      to: [email],
      ...welcomeEmail({
        name: dto.nom.trim(),
        inviter: user.nom,
        company: owner.raisonsociale || owner.nom,
        email,
        canEdit: dto.canEdit,
        appUrl: process.env.APP_URL ?? 'http://localhost:3000',
      }),
    });

    return this.company.team(user);
  }

  async update(user: AuthUser, id: number, dto: UpdateTeamMemberDto) {
    await this.member(user, id);
    const email = dto.email?.trim().toLowerCase();
    if (email) await this.assertEmailFree(email, id);
    await this.prisma.company.update({
      where: { id },
      data: {
        ...(dto.nom !== undefined ? { nom: dto.nom.trim() } : {}),
        ...(email ? { email } : {}),
        ...(dto.fonction !== undefined ? { fonction: clean(dto.fonction) } : {}),
        ...(dto.tel !== undefined ? { tel: clean(dto.tel) } : {}),
        ...(dto.canEdit !== undefined ? { droitacceeId: dto.canEdit ? DROIT_TOUS : DROIT_LECTURE } : {}),
        ...(dto.active !== undefined ? { activated: dto.active } : {}),
        updatedAt: new Date(),
      },
    });
    // Rights and activation are re-read on every request: they apply at once
    return this.company.team(user);
  }

  async resetPassword(user: AuthUser, id: number, dto: ResetMemberPasswordDto) {
    await this.member(user, id);
    await this.prisma.company.update({
      where: { id },
      data: { password: await hashPassword(dto.password), updatedAt: new Date() },
    });
    return { ok: true };
  }
}

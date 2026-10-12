import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DROIT_LECTURE, DROIT_TOUS } from '../common/auth-user';
import type { AuthUser } from '../common/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { AccountRequestsService } from '../accounts/account-requests.service';
import { CompanyService } from './company.service';
import { CreateTeamMemberDto, UpdateTeamMemberDto } from './company.dto';

const clean = (v?: string | null) => (v?.trim() ? v.trim() : null);

/**
 * The company's main account manages its employees' accounts ("comptes
 * secondaires"): it adds them, sets their access rights (Lecture seule /
 * Lecture et modification) and can switch them off. Passwords are managed by
 * IGTS only: a new account waits, switched off, until IGTS sets its password
 * (AccountRequestsService). Accounts are stored exactly as Symfony creates
 * them (company row with `multicompte` = main account id).
 */
@Injectable()
export class TeamService {
  constructor(
    private prisma: PrismaService,
    private company: CompanyService,
    private requests: AccountRequestsService,
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

    const created = await this.prisma.company.create({
      data: {
        nom: dto.nom.trim(),
        email,
        tel: clean(dto.tel),
        fonction: clean(dto.fonction),
        // Unusable until IGTS sets the real password and switches the account on
        password: await AccountRequestsService.unusablePassword(),
        roles: JSON.stringify(['ROLE_COMPANY']),
        multicompte: owner.id,
        raisonsociale: owner.raisonsociale,
        tmpphoto: owner.tmpphoto,
        droit: 1,
        droitacceeId: dto.canEdit ? DROIT_TOUS : DROIT_LECTURE,
        activated: false,
        enabled: true,
        deleted: false,
        createdAt: new Date(),
      },
    });

    // IGTS is told; the colleague is welcomed once IGTS has activated the account
    await this.requests.request({ accountId: created.id, ownerId: owner.id, requestedBy: user.nom });
    return this.company.team(user);
  }

  async update(user: AuthUser, id: number, dto: UpdateTeamMemberDto) {
    await this.member(user, id);
    if (dto.active && this.requests.isPending(id)) {
      throw new BadRequestException('IGTS n’a pas encore activé ce compte : il le sera dès que son mot de passe sera défini.');
    }
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
}

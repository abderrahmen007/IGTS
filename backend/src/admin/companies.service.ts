import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { hashPassword } from '../common/password';
import { PrismaService } from '../prisma/prisma.service';
import { AssignmentService } from './assignment.service';
import { CompanyService, computeStats } from '../company/company.service';
import { canEditFromRights, DROIT_TOUS } from '../common/auth-user';
import type { AuthUser } from '../common/auth-user';
import type { ListTextsQuery } from '../company/company.dto';
import {
  AssignTextsDto,
  CompanyInfoDto,
  CreateCompanyDto,
  CreateSubAccountDto,
  SubAccountDto,
  SubscriptionsDto,
} from './admin.dto';

const hash = hashPassword;
/** Legacy `droitaccee` id 5 (empty label) = read-only, as created by Symfony. */
const DROIT_LECTURE = 5;
const clean = (v?: string | null) => (v?.trim() ? v.trim() : null);

@Injectable()
export class AdminCompaniesService {
  constructor(
    private prisma: PrismaService,
    private assignment: AssignmentService,
    private companyService: CompanyService,
  ) {}

  private async getMain(id: number) {
    const c = await this.prisma.company.findFirst({ where: { id, deleted: false, multicompte: 0 } });
    if (!c) throw new NotFoundException('Entreprise introuvable');
    return c;
  }

  private async assertEmailFree(email: string, exceptId?: number) {
    const other = await this.prisma.company.findFirst({
      where: { email: email.trim().toLowerCase(), ...(exceptId ? { NOT: { id: exceptId } } : {}) },
      select: { id: true },
    });
    if (other) throw new ConflictException('Cette adresse e-mail est déjà utilisée par un autre compte');
  }

  // ─── Detail ────────────────────────────────────────────────────────

  async detail(id: number) {
    const c = await this.getMain(id);
    const [secteurRows, themeRows, subs, grouped, secteurs] = await Promise.all([
      this.prisma.companySecteurTheme.findMany({ where: { companyId: id }, select: { secteurId: true } }),
      this.prisma.companyTheme.findMany({ where: { companyId: id }, select: { themeId: true } }),
      this.prisma.company.findMany({
        where: { multicompte: id, deleted: false },
        orderBy: { createdAt: 'asc' },
        select: { id: true, nom: true, email: true, tel: true, fonction: true, activated: true, createdAt: true, droitacceeId: true },
      }),
      this.prisma.texteSociete.groupBy({
        by: ['applicabiliteId', 'gestionetatId'],
        where: { companyId: id, OR: [{ deleted: false }, { deleted: null }], texte: { deleted: false } },
        _count: { _all: true },
      }),
      this.prisma.secteur.findMany({
        orderBy: { name: 'asc' },
        include: { themes: { orderBy: { name: 'asc' }, select: { id: true, name: true } } },
      }),
    ]);

    return {
      company: {
        id: c.id,
        raisonsociale: c.raisonsociale,
        nom: c.nom,
        email: c.email,
        tel: c.tel,
        fonction: c.fonction,
        adresse: c.adresse,
        ville: c.ville,
        matriculeFiscal: c.zipcode,
        active: c.activated,
        createdAt: c.createdAt,
        lastActivity: c.updatedAt,
      },
      stats: computeStats(grouped.map((g) => ({ ...g, count: g._count._all }))),
      subscriptions: {
        secteurIds: [...new Set(secteurRows.map((s) => s.secteurId).filter((x): x is number => x !== null))],
        themeIds: themeRows.map((t) => t.themeId),
      },
      catalog: secteurs.map((s) => ({ id: s.id, name: s.name, themes: s.themes })),
      subAccounts: subs.map(({ droitacceeId, ...s }) => ({
        ...s,
        active: s.activated,
        canEdit: canEditFromRights(1, droitacceeId),
      })),
    };
  }

  // ─── Company CRUD ──────────────────────────────────────────────────

  async create(dto: CreateCompanyDto) {
    await this.assertEmailFree(dto.email);
    const now = new Date();
    const company = await this.prisma.company.create({
      data: {
        ...this.infoData(dto),
        password: await hash(dto.password),
        roles: JSON.stringify(['ROLE_COMPANY']),
        multicompte: 0,
        activated: true,
        enabled: true,
        deleted: false,
        createdAt: now,
      },
    });
    if (dto.secteurIds?.length) {
      await this.prisma.companySecteurTheme.createMany({
        data: [...new Set(dto.secteurIds)].map((secteurId) => ({ companyId: company.id, secteurId })),
      });
    }
    return this.detail(company.id);
  }

  private infoData(dto: CompanyInfoDto) {
    return {
      raisonsociale: dto.raisonsociale.trim(),
      nom: dto.nom.trim(),
      email: dto.email.trim().toLowerCase(),
      tel: clean(dto.tel),
      fonction: clean(dto.fonction),
      adresse: clean(dto.adresse),
      ville: clean(dto.ville),
      zipcode: clean(dto.matriculeFiscal),
    };
  }

  async update(id: number, dto: CompanyInfoDto) {
    await this.getMain(id);
    await this.assertEmailFree(dto.email, id);
    await this.prisma.$transaction([
      this.prisma.company.update({ where: { id }, data: { ...this.infoData(dto), updatedAt: new Date() } }),
      // Sub-accounts carry the parent's company name, as in the legacy app
      this.prisma.company.updateMany({
        where: { multicompte: id },
        data: { raisonsociale: dto.raisonsociale.trim() },
      }),
    ]);
    return this.detail(id);
  }

  async setPassword(id: number, password: string) {
    const c = await this.prisma.company.findFirst({ where: { id, deleted: false } });
    if (!c) throw new NotFoundException('Compte introuvable');
    await this.prisma.company.update({ where: { id }, data: { password: await hash(password) } });
    return { ok: true };
  }

  /** Legacy "changevalidite": toggles `activated`, which blocks login. */
  async setActive(id: number, active: boolean) {
    const c = await this.prisma.company.findFirst({ where: { id, deleted: false } });
    if (!c) throw new NotFoundException('Compte introuvable');
    await this.prisma.company.update({ where: { id }, data: { activated: active } });
    return { ok: true, active };
  }

  /** Soft delete, as in the legacy app (data is kept). */
  async remove(id: number) {
    await this.getMain(id);
    await this.prisma.company.updateMany({
      where: { OR: [{ id }, { multicompte: id }] },
      data: { deleted: true },
    });
    return { ok: true };
  }

  // ─── Subscriptions (secteurs & thèmes) ─────────────────────────────

  async updateSubscriptions(id: number, dto: SubscriptionsDto) {
    await this.getMain(id);
    const themes = await this.prisma.theme.findMany({
      where: { id: { in: dto.themeIds } },
      select: { id: true, secteurId: true },
    });
    const wantedSecteurs = new Set([
      ...dto.secteurIds,
      ...themes.map((t) => t.secteurId).filter((x): x is number => x !== null),
    ]);
    const wantedThemes = new Map(themes.map((t) => [t.id, t.secteurId]));

    const [curSecteurs, curThemes] = await Promise.all([
      this.prisma.companySecteurTheme.findMany({ where: { companyId: id } }),
      this.prisma.companyTheme.findMany({ where: { companyId: id } }),
    ]);

    const removedSecteurs = [
      ...new Set(curSecteurs.map((s) => s.secteurId).filter((s): s is number => s !== null && !wantedSecteurs.has(s))),
    ];
    const removedThemes = curThemes.filter(
      (t) => !wantedThemes.has(t.themeId) && !(t.secteurId !== null && removedSecteurs.includes(t.secteurId)),
    );

    // Impact of removals (texts, evaluations and action plans that will be deleted)
    const impacts = await Promise.all([
      ...removedSecteurs.map((secteurId) => this.assignment.impact({ companyId: id, secteurId })),
      ...removedThemes.map((t) =>
        this.assignment.impact({ companyId: id, secteurId: t.secteurId ?? undefined, themeId: t.themeId }),
      ),
    ]);
    const impact = impacts.reduce(
      (a, b) => ({ texts: a.texts + b.texts, evaluated: a.evaluated + b.evaluated, actions: a.actions + b.actions }),
      { texts: 0, evaluated: 0, actions: 0 },
    );
    if (dto.dryRun) return { impact };

    // Removals — same cascade as the legacy admin
    for (const secteurId of removedSecteurs) {
      await this.assignment.removeAssignments({ companyId: id, secteurId });
      await this.prisma.companyTheme.deleteMany({ where: { companyId: id, secteurId } });
      await this.prisma.companySecteurTheme.deleteMany({ where: { companyId: id, secteurId } });
    }
    for (const t of removedThemes) {
      await this.assignment.removeAssignments({ companyId: id, secteurId: t.secteurId ?? undefined, themeId: t.themeId });
      await this.prisma.companyTheme.delete({ where: { id: t.id } });
    }

    // Additions
    const haveSecteurs = new Set(curSecteurs.map((s) => s.secteurId));
    const newSecteurs = [...wantedSecteurs].filter((s) => !haveSecteurs.has(s));
    if (newSecteurs.length) {
      await this.prisma.companySecteurTheme.createMany({
        data: newSecteurs.map((secteurId) => ({ companyId: id, secteurId })),
      });
    }
    const haveThemes = new Set(curThemes.map((t) => t.themeId));
    const newThemes = [...wantedThemes.entries()].filter(([themeId]) => !haveThemes.has(themeId));
    if (newThemes.length) {
      await this.prisma.companyTheme.createMany({
        data: newThemes.map(([themeId, secteurId]) => ({ companyId: id, themeId, secteurId })),
      });
    }

    const assigned = dto.assignTexts ? await this.assignment.assignSubscribedThemes(id) : { added: 0, skipped: 0 };
    return { impact, assigned, detail: await this.detail(id) };
  }

  async assignSubscribed(id: number) {
    await this.getMain(id);
    return this.assignment.assignSubscribedThemes(id);
  }

  // ─── Company texts ─────────────────────────────────────────────────

  listTexts(id: number, q: ListTextsQuery) {
    const asCompany: AuthUser = { id, type: 'company', email: '', nom: '', ownerId: id, canEdit: false };
    return this.companyService.listTexts(asCompany, q);
  }

  async assignTexts(id: number, dto: AssignTextsDto) {
    await this.getMain(id);
    const texts = await this.prisma.texte.findMany({
      where: { id: { in: dto.texteIds }, deleted: false },
      select: { id: true, secteurId: true, themeId: true },
    });
    return this.assignment.assign(id, texts, { themed: false, message: 'Ce texte a été ajouté.' });
  }

  async unassignText(id: number, texteSocieteId: number) {
    const ts = await this.prisma.texteSociete.findFirst({ where: { id: texteSocieteId, companyId: id } });
    if (!ts) throw new NotFoundException('Affectation introuvable');
    await this.assignment.removeAssignments({ ids: [ts.id] });
    return { ok: true };
  }

  // ─── Sub-accounts (multicompte) ────────────────────────────────────

  async createSubAccount(parentId: number, dto: CreateSubAccountDto) {
    const parent = await this.getMain(parentId);
    await this.assertEmailFree(dto.email);
    await this.prisma.company.create({
      data: {
        nom: dto.nom.trim(),
        email: dto.email.trim().toLowerCase(),
        tel: clean(dto.tel),
        fonction: clean(dto.fonction),
        password: await hash(dto.password),
        roles: JSON.stringify(['ROLE_COMPANY']),
        multicompte: parentId,
        raisonsociale: parent.raisonsociale,
        tmpphoto: parent.tmpphoto,
        droit: 1,
        // Read-only unless IGTS grants "Tous les droits" (legacy default)
        droitacceeId: dto.canEdit ? DROIT_TOUS : DROIT_LECTURE,
        activated: true,
        enabled: true,
        deleted: false,
        createdAt: new Date(),
      },
    });
    return this.detail(parentId);
  }

  private async getSub(id: number) {
    const s = await this.prisma.company.findFirst({ where: { id, deleted: false, multicompte: { gt: 0 } } });
    if (!s) throw new NotFoundException('Utilisateur introuvable');
    return s;
  }

  async updateSubAccount(id: number, dto: SubAccountDto) {
    const s = await this.getSub(id);
    await this.assertEmailFree(dto.email, id);
    await this.prisma.company.update({
      where: { id },
      data: {
        nom: dto.nom.trim(),
        email: dto.email.trim().toLowerCase(),
        tel: clean(dto.tel),
        fonction: clean(dto.fonction),
        ...(dto.canEdit !== undefined ? { droitacceeId: dto.canEdit ? DROIT_TOUS : DROIT_LECTURE } : {}),
        updatedAt: new Date(),
      },
    });
    return this.detail(s.multicompte);
  }

  async removeSubAccount(id: number) {
    const s = await this.getSub(id);
    await this.prisma.company.update({ where: { id }, data: { deleted: true } });
    return this.detail(s.multicompte);
  }
}

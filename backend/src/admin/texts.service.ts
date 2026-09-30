import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FilesService, UploadedPdf } from '../files/files.service';
import { AssignmentService } from './assignment.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TextDto } from './admin.dto';

@Injectable()
export class AdminTextsService {
  constructor(
    private prisma: PrismaService,
    private files: FilesService,
    private assignment: AssignmentService,
    private notifications: NotificationsService,
  ) {}

  private async get(id: number) {
    const t = await this.prisma.texte.findFirst({
      where: { id, deleted: false },
      include: { type: true, secteur: true, theme: true },
    });
    if (!t) throw new NotFoundException('Texte introuvable');
    return t;
  }

  private async checkClassification(dto: TextDto) {
    const theme = await this.prisma.theme.findUnique({ where: { id: dto.themeId } });
    if (!theme) throw new BadRequestException('Thème introuvable');
    if (theme.secteurId !== dto.secteurId) {
      throw new BadRequestException('Ce thème n’appartient pas au secteur choisi');
    }
    const type = await this.prisma.type.findUnique({ where: { id: dto.typeId } });
    if (!type) throw new BadRequestException('Type de texte introuvable');
  }

  private data(dto: Omit<TextDto, 'notifyCompanies'>) {
    return {
      titre: dto.titre.trim(),
      description: dto.description.trim(),
      journal: dto.journal?.trim() ?? '',
      date: dto.date?.trim() ?? '',
      num: dto.num?.trim() ?? '',
      typeId: dto.typeId,
      secteurId: dto.secteurId,
      themeId: dto.themeId,
    };
  }

  async detail(id: number) {
    const t = await this.get(id);
    const assignments = await this.prisma.texteSociete.findMany({
      where: { texteId: id, OR: [{ deleted: false }, { deleted: null }], company: { deleted: false } },
      select: {
        id: true,
        createdAt: true,
        applicabilite: { select: { id: true, name: true } },
        gestionEtat: { select: { id: true, name: true } },
        company: { select: { id: true, nom: true, raisonsociale: true } },
      },
      orderBy: { id: 'asc' },
    });
    return {
      id: t.id,
      titre: t.titre,
      description: t.description,
      journal: t.journal,
      date: t.date,
      num: t.num,
      type: t.type ? { id: t.type.id, name: t.type.name } : null,
      secteur: t.secteur ? { id: t.secteur.id, name: t.secteur.name } : null,
      theme: t.theme ? { id: t.theme.id, name: t.theme.name } : null,
      pdfUrl: this.files.pdfUrl(t.tmpphoto),
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      companies: assignments.map((a) => ({
        texteSocieteId: a.id,
        assignedAt: a.createdAt,
        company: a.company,
        applicabilite: a.applicabilite,
        etat: a.gestionEtat,
      })),
    };
  }

  /**
   * Creates a text and, like the legacy admin, immediately sends it to every
   * company subscribed to its theme (with a notification).
   */
  async create(dto: TextDto, pdf?: UploadedPdf) {
    await this.checkClassification(dto);
    const tmpphoto = pdf ? await this.files.savePdf(pdf) : null;
    const last = await this.prisma.texte.aggregate({ _max: { pos: true } });

    const t = await this.prisma.texte.create({
      data: {
        ...this.data(dto),
        tmpphoto,
        pos: (last._max.pos ?? 0) + 1,
        createdAt: new Date(),
        deleted: false,
        enabled: true,
        active: true,
      },
    });
    const distributed = await this.assignment.distributeNewText({
      id: t.id,
      secteurId: t.secteurId,
      themeId: t.themeId,
    });
    return { ...(await this.detail(t.id)), distributedTo: distributed.companies };
  }

  async update(id: number, dto: TextDto, pdf?: UploadedPdf) {
    await this.get(id);
    await this.checkClassification(dto);
    const tmpphoto = pdf ? await this.files.savePdf(pdf) : undefined;
    await this.prisma.texte.update({
      where: { id },
      data: { ...this.data(dto), ...(tmpphoto ? { tmpphoto } : {}), updatedAt: new Date() },
    });
    const notified = dto.notifyCompanies ? await this.notifications.notifyTextUpdated(id) : 0;
    return { ...(await this.detail(id)), notified };
  }

  /** Legacy "supprimer": hides the text everywhere but keeps the data. */
  async archive(id: number) {
    await this.get(id);
    await this.prisma.$transaction([
      this.prisma.texte.update({ where: { id }, data: { deleted: true, updatedAt: new Date() } }),
      this.prisma.texteSociete.updateMany({ where: { texteId: id }, data: { deleted: true } }),
    ]);
    return { ok: true };
  }

  /** Legacy "supprimer définitivement": removes the text and all related data. */
  async destroy(id: number) {
    const t = await this.prisma.texte.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Texte introuvable');
    const ts = await this.prisma.texteSociete.findMany({ where: { texteId: id }, select: { id: true } });
    await this.assignment.removeAssignments({ ids: ts.map((x) => x.id) });
    await this.prisma.$transaction([
      this.prisma.historiqueEtat.deleteMany({ where: { texteId: id } }),
      this.prisma.historiqueAction.deleteMany({ where: { texteId: id } }),
      this.prisma.plusaction.deleteMany({ where: { texteId: id } }),
      this.prisma.notification.deleteMany({ where: { texteId: id } }),
      this.prisma.texte.delete({ where: { id } }),
    ]);
    return { ok: true };
  }

  /** Assigns one text to several companies at once. */
  async assignToCompanies(id: number, companyIds: number[]) {
    const t = await this.get(id);
    let added = 0;
    for (const companyId of [...new Set(companyIds)]) {
      const r = await this.assignment.assign(
        companyId,
        [{ id: t.id, secteurId: t.secteurId, themeId: t.themeId }],
        { themed: false, message: 'Ce texte a été ajouté.' },
      );
      added += r.added;
    }
    return { added, detail: await this.detail(id) };
  }
}

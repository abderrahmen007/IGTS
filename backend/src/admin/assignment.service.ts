import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { APPLICABILITE_NON_ANALYSEE } from '../company/company.service';

interface TextRef {
  id: number;
  secteurId: number | null;
  themeId: number | null;
}

/**
 * Assigns texts to companies (table texte_societe), exactly like the legacy
 * Symfony admin: new assignments start as "Non analysé" and the company
 * receives a notification for each new text. Texts already assigned are
 * skipped, so every operation here can be repeated safely.
 */
@Injectable()
export class AssignmentService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async assign(
    companyId: number,
    texts: TextRef[],
    opts: { themed: boolean; message: string },
  ): Promise<{ added: number; skipped: number }> {
    if (!texts.length) return { added: 0, skipped: 0 };

    const existing = await this.prisma.texteSociete.findMany({
      where: {
        companyId,
        texteId: { in: texts.map((t) => t.id) },
        OR: [{ deleted: false }, { deleted: null }],
      },
      select: { texteId: true },
    });
    const already = new Set(existing.map((e) => e.texteId));
    const toAdd = texts.filter((t) => !already.has(t.id));
    if (!toAdd.length) return { added: 0, skipped: texts.length };

    const now = new Date();
    const created = await this.prisma.$transaction(
      toAdd.map((t) =>
        this.prisma.texteSociete.create({
          data: {
            companyId,
            texteId: t.id,
            secteurId: t.secteurId,
            themeId: t.themeId,
            applicabiliteId: APPLICABILITE_NON_ANALYSEE,
            themed: opts.themed,
            deleted: false,
            createdAt: now,
          },
          select: { id: true, texteId: true, secteurId: true, themeId: true },
        }),
      ),
    );

    await this.notifications.notifyTexts(
      created.map((ts) => ({
        companyId,
        texteId: ts.texteId!,
        texteSocieteId: ts.id,
        secteurId: ts.secteurId,
        themeId: ts.themeId,
        message: opts.message,
      })),
    );

    return { added: created.length, skipped: texts.length - created.length };
  }

  /**
   * Adds every published text of the company's subscribed themes
   * (legacy "Ajouter les textes du secteur").
   */
  async assignSubscribedThemes(companyId: number) {
    const subs = await this.prisma.companyTheme.findMany({ where: { companyId } });
    if (!subs.length) return { added: 0, skipped: 0 };
    const texts = await this.prisma.texte.findMany({
      where: {
        deleted: false,
        OR: subs.map((s) => ({ themeId: s.themeId, secteurId: s.secteurId ?? undefined })),
      },
      select: { id: true, secteurId: true, themeId: true },
    });
    return this.assign(companyId, texts, { themed: false, message: 'Ce texte a été ajouté.' });
  }

  /** Sends a newly created text to every company subscribed to its theme. */
  async distributeNewText(text: TextRef) {
    if (!text.themeId || !text.secteurId) return { companies: 0 };
    const subs = await this.prisma.companyTheme.findMany({
      where: { themeId: text.themeId, secteurId: text.secteurId, company: { deleted: false } },
      select: { companyId: true },
    });
    let companies = 0;
    for (const s of subs) {
      const r = await this.assign(s.companyId, [text], {
        themed: true,
        message: 'Nouveau texte ajouté automatiquement par l’administrateur.',
      });
      if (r.added) companies++;
    }
    return { companies };
  }

  /**
   * Removes assignments and everything that depends on them (history, action
   * plans, notifications) — same cascade as the legacy admin.
   */
  async removeAssignments(where: { ids?: number[]; companyId?: number; secteurId?: number; themeId?: number }) {
    const rows = await this.prisma.texteSociete.findMany({
      where: {
        ...(where.ids ? { id: { in: where.ids } } : {}),
        ...(where.companyId ? { companyId: where.companyId } : {}),
        ...(where.secteurId ? { secteurId: where.secteurId } : {}),
        ...(where.themeId ? { themeId: where.themeId } : {}),
      },
      select: { id: true },
    });
    const ids = rows.map((r) => r.id);
    if (!ids.length) return 0;
    await this.prisma.$transaction([
      this.prisma.historiqueEtat.deleteMany({ where: { texteSocieteId: { in: ids } } }),
      this.prisma.historiqueAction.deleteMany({ where: { texteSocieteId: { in: ids } } }),
      this.prisma.plusaction.deleteMany({ where: { texteSocieteId: { in: ids } } }),
      this.prisma.notification.deleteMany({ where: { texteSocieteId: { in: ids } } }),
      this.prisma.texteSociete.deleteMany({ where: { id: { in: ids } } }),
    ]);
    return ids.length;
  }

  /** Counts what removeAssignments would delete (shown before confirming). */
  async impact(where: { companyId: number; secteurId?: number; themeId?: number }) {
    const rows = await this.prisma.texteSociete.findMany({
      where: {
        companyId: where.companyId,
        ...(where.secteurId ? { secteurId: where.secteurId } : {}),
        ...(where.themeId ? { themeId: where.themeId } : {}),
      },
      select: { id: true, gestionetatId: true },
    });
    const ids = rows.map((r) => r.id);
    const actions = ids.length
      ? await this.prisma.plusaction.count({ where: { texteSocieteId: { in: ids } } })
      : 0;
    return {
      texts: ids.length,
      evaluated: rows.filter((r) => r.gestionetatId !== null).length,
      actions,
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from './realtime.service';
import { MailerService } from './mailer.service';
import { deadlinesEmail, newTextsEmail } from './email-templates';
import { PreferencesService } from '../preferences/preferences.service';
import { LIVE_ACTIONS_TEXT, OPEN_ACTION_STATES, daysUntil } from '../company/rules';

export interface NewTextNotification {
  companyId: number;
  texteId: number;
  texteSocieteId: number;
  secteurId: number | null;
  themeId: number | null;
  message: string;
}

/**
 * Single entry point for client notifications. Each notification is:
 *  1. stored in the legacy `notification` table (the bell),
 *  2. pushed live to the company's open browsers (Server-Sent Events),
 *  3. sent by e-mail to the company's active users (grouped per operation).
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly appUrl: string;

  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeService,
    private mailer: MailerService,
    private prefs: PreferencesService,
    config: ConfigService,
  ) {
    this.appUrl = (config.get<string>('APP_URL') ?? 'http://localhost:3000').replace(/\/$/, '');
  }

  /**
   * Active users of a company (main account + sub-accounts) who accept this
   * kind of e-mail in their profile.
   */
  private async recipients(ownerId: number, kind: 'emailNewTexts' | 'emailReminders') {
    const users = await this.prisma.company.findMany({
      where: { OR: [{ id: ownerId }, { multicompte: ownerId }], deleted: false, activated: true },
      select: { id: true, email: true, nom: true, multicompte: true },
    });
    const main = users.find((u) => u.multicompte === 0);
    return {
      emails: this.prefs.filter(users, kind).map((u) => u.email),
      name: main?.nom ?? users[0]?.nom ?? '',
    };
  }

  private unreadCount(ownerId: number) {
    return this.prisma.notification.count({
      where: { companyId: ownerId, OR: [{ isRead: false }, { isRead: null }] },
    });
  }

  async notifyTexts(items: NewTextNotification[]) {
    if (!items.length) return 0;
    const now = new Date();
    const { count } = await this.prisma.notification.createMany({
      data: items.map((n) => ({
        companyId: n.companyId,
        texteId: n.texteId,
        texteSocieteId: n.texteSocieteId,
        secteurId: n.secteurId,
        themeId: n.themeId,
        message: n.message,
        isRead: false,
        etat: 'nonlu',
        createdAt: now,
      })),
    });

    // Live push + e-mail run in the background: the admin's request returns immediately
    void this.deliverNewTexts(items, now).catch((e) =>
      this.logger.error(`Diffusion des notifications impossible : ${(e as Error).message}`),
    );
    return count;
  }

  private async deliverNewTexts(items: NewTextNotification[], at: Date) {
    const titles = new Map(
      (
        await this.prisma.texte.findMany({
          where: { id: { in: [...new Set(items.map((i) => i.texteId))] } },
          select: { id: true, titre: true },
        })
      ).map((t) => [t.id, t.titre]),
    );

    const byCompany = new Map<number, NewTextNotification[]>();
    for (const i of items) {
      if (!byCompany.has(i.companyId)) byCompany.set(i.companyId, []);
      byCompany.get(i.companyId)!.push(i);
    }

    for (const [ownerId, list] of byCompany) {
      const unread = await this.unreadCount(ownerId);
      const first = list[0];
      this.realtime.publish(ownerId, {
        type: 'notification',
        unread,
        item: {
          message:
            list.length === 1 ? first.message : `${list.length} nouveaux textes ont été ajoutés à votre veille.`,
          texteTitre: list.length === 1 ? titles.get(first.texteId) ?? null : null,
          texteSocieteId: list.length === 1 ? first.texteSocieteId : null,
          createdAt: at.toISOString(),
        },
      });

      const { emails, name } = await this.recipients(ownerId, 'emailNewTexts');
      const mail = newTextsEmail({
        name,
        titles: list.map((i) => titles.get(i.texteId) ?? 'Texte réglementaire'),
        appUrl: this.appUrl,
      });
      await this.mailer.send({ to: emails, ...mail });
    }
  }

  /**
   * IGTS changed a text: companies that follow it get an in-app notification
   * (no e-mail, to avoid noise on small corrections).
   */
  async notifyTextUpdated(texteId: number) {
    const links = await this.prisma.texteSociete.findMany({
      where: { texteId, OR: [{ deleted: false }, { deleted: null }], company: { deleted: false } },
      select: { id: true, companyId: true, secteurId: true, themeId: true },
    });
    const now = new Date();
    const items = links.filter((l) => l.companyId);
    if (!items.length) return 0;
    await this.prisma.notification.createMany({
      data: items.map((l) => ({
        companyId: l.companyId,
        texteId,
        texteSocieteId: l.id,
        secteurId: l.secteurId,
        themeId: l.themeId,
        message: 'Un texte de votre veille a été mis à jour par IGTS. Vérifiez votre évaluation.',
        isRead: false,
        etat: 'nonlu',
        createdAt: now,
      })),
    });
    for (const l of items) {
      this.realtime.publish(l.companyId!, {
        type: 'notification',
        unread: await this.unreadCount(l.companyId!),
        item: {
          message: 'Un texte de votre veille a été mis à jour par IGTS.',
          texteSocieteId: l.id,
          createdAt: now.toISOString(),
        },
      });
    }
    return items.length;
  }

  /** Tells open browsers of a company to refresh their figures (e.g. after an evaluation by a colleague). */
  refresh(ownerId: number) {
    this.realtime.publish(ownerId, { type: 'refresh' });
  }

  // ─── Action plan reminders ─────────────────────────────────────────

  /**
   * Every morning at 7:45 (Tunis): reminds companies of open actions whose
   * planned closing date is in 7 days, tomorrow, or was yesterday (late).
   */
  @Cron('0 45 7 * * *', { timeZone: 'Africa/Tunis' })
  async remindActionDeadlines() {
    // Only actions that still need work, on texts that still call for action
    // (actions of a text marked "ne nous concerne pas" are on hold)
    const ts = await this.prisma.texteSociete.findMany({
      where: { ...LIVE_ACTIONS_TEXT, OR: [{ deleted: false }, { deleted: null }], texte: { deleted: false } },
      select: { id: true, companyId: true, texte: { select: { titre: true } } },
    });
    const tsById = new Map(ts.map((t) => [t.id, t]));
    const actions = await this.prisma.plusaction.findMany({
      where: {
        gestionactionId: { in: OPEN_ACTION_STATES },
        cloture: { not: null },
        texteSocieteId: { in: [...tsById.keys()] },
      },
      select: { id: true, texteId: true, texteSocieteId: true, cloture: true, libelleAction: true },
    });

    const due: { action: (typeof actions)[number]; days: number }[] = [];
    for (const a of actions) {
      const days = daysUntil(a.cloture);
      if (days === 7 || days === 1 || days === -1) due.push({ action: a, days });
    }
    if (!due.length) return;

    const byCompany = new Map<number, { label: string; when: string; tsId: number; texteId: number | null }[]>();
    for (const { action, days } of due) {
      const link = action.texteSocieteId ? tsById.get(action.texteSocieteId) : undefined;
      if (!link?.companyId) continue;
      const desc = (action.libelleAction ?? '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
      const when = days === -1 ? 'en retard' : days === 1 ? 'échéance demain' : 'échéance dans 7 jours';
      if (!byCompany.has(link.companyId)) byCompany.set(link.companyId, []);
      byCompany.get(link.companyId)!.push({
        label: `${desc.slice(0, 90) || 'Action'} (${link.texte?.titre ?? ''})`,
        when,
        tsId: link.id,
        texteId: action.texteId,
      });
    }

    const now = new Date();
    for (const [ownerId, list] of byCompany) {
      await this.prisma.notification.createMany({
        data: list.map((l) => ({
          companyId: ownerId,
          texteId: l.texteId,
          texteSocieteId: l.tsId,
          message: l.when === 'en retard' ? 'Une action de votre plan d’action est en retard.' : `Action à clôturer : ${l.when}.`,
          isRead: false,
          etat: 'nonlu',
          createdAt: now,
        })),
      });
      this.realtime.publish(ownerId, {
        type: 'notification',
        unread: await this.unreadCount(ownerId),
        item: { message: `${list.length} action(s) arrivent à échéance.`, createdAt: now.toISOString() },
      });
      const { emails, name } = await this.recipients(ownerId, 'emailReminders');
      await this.mailer.send({ to: emails, ...deadlinesEmail({ name, items: list, appUrl: this.appUrl }) });
    }
    this.logger.log(`Rappels d’échéance envoyés à ${byCompany.size} entreprise(s)`);
  }
}

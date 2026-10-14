import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from '../notifications/mailer.service';
import { RealtimeService } from '../notifications/realtime.service';
import { PreferencesService } from '../preferences/preferences.service';
import { SubscriptionsService } from '../accounts/subscriptions.service';
import {
  LIVE_ACTIONS_TEXT,
  OPEN_ACTION_STATES,
  daysUntil,
} from '../company/rules';
import { daysBetween, frenchDay, tunisDay } from '../common/json-file';
import { EcheancesStore } from './echeances.store';
import { EcheancesService } from './echeances.service';
import { remindersEmail, type ReminderLine } from './reminder-emails';

/** Weekly reminders of something late stop after this many weeks */
export const MAX_LATE_WEEKS = 12;

/**
 * Stage of a reminder for something due in `days` days: 30 days before,
 * 7 days before, on the due date, then once a week while it is late (for
 * 12 weeks: older delays stay visible on the platform without e-mails, so
 * long-forgotten actions of the legacy platform do not flood the clients).
 * Each stage is sent once, so a day missed (server off) is caught up the
 * next morning without duplicates.
 */
export function reminderStage(days: number): string | null {
  if (days > 30 || -days > MAX_LATE_WEEKS * 7) return null;
  if (days > 7) return 'j30';
  if (days > 0) return 'j7';
  const weeks = Math.floor(-days / 7);
  return weeks === 0 ? 'j0' : `late${weeks}`;
}

export function whenLabel(days: number): string {
  if (days === 0) return 'aujourd’hui';
  if (days === 1) return 'demain';
  if (days > 0) return `dans ${days} jours`;
  return days === -1 ? 'en retard d’un jour' : `en retard de ${-days} jours`;
}

const EMAIL = /[^\s;,<>"']+@[^\s;,<>"']+\.[^\s;,<>"']+/g;
export const emailsIn = (s?: string | null): string[] =>
  [...new Set((s ?? '').match(EMAIL) ?? [])]
    .map((e) => e.toLowerCase())
    .slice(0, 3);

const plain = (html?: string | null) =>
  (html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

interface Due {
  key: string;
  line: ReminderLine;
  responsible: { name: string; emails: string[] } | null;
  /** In-app notification for an action (the bell links to its text) */
  action?: { texteId: number | null; tsId: number };
}

const TIME_ZONE = 'Africa/Tunis';
/** Minutes after midnight (Tunis) of the daily run */
const RUN_AT = 7 * 60 + 45;

/**
 * Every morning at 7:45 (Tunis): reminders for the companies' regular checks
 * and renewals (« Échéances ») and for the actions of their action plan.
 * One e-mail per company to the main account, one per person named
 * responsible with only their lines, and a notification in the bell.
 */
@Injectable()
export class RemindersService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RemindersService.name);
  private readonly appUrl: string;
  private running = false;

  constructor(
    private store: EcheancesStore,
    private echeances: EcheancesService,
    private prisma: PrismaService,
    private mailer: MailerService,
    private realtime: RealtimeService,
    private prefs: PreferencesService,
    private subscriptions: SubscriptionsService,
    config: ConfigService,
  ) {
    this.appUrl = (
      config.get<string>('APP_URL') ?? 'http://localhost:3000'
    ).replace(/\/$/, '');
  }

  onApplicationBootstrap() {
    const now = new Intl.DateTimeFormat('en-GB', {
      timeZone: TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date());
    const [h, m] = now.split(':').map(Number);
    if (h * 60 + m >= RUN_AT && this.store.data.lastRun !== tunisDay()) {
      this.logger.log(
        'Rappels du jour pas encore envoyés : envoi dans 2 minutes',
      );
      setTimeout(() => void this.run().catch(() => undefined), 120_000).unref();
    }
  }

  @Cron('0 45 7 * * *', { timeZone: TIME_ZONE })
  async daily() {
    await this.run().catch((e: Error) =>
      this.logger.error(`Rappels impossibles : ${e.message}`),
    );
  }

  async run() {
    if (this.running) return { companies: 0, emails: 0, items: 0, actions: 0 };
    this.running = true;
    try {
      return await this.send();
    } finally {
      this.running = false;
    }
  }

  private async send() {
    const today = tunisDay();
    const sent = this.store.data.sent;
    const items = new Map<number, Due[]>();
    const actions = new Map<number, Due[]>();
    const add = (map: Map<number, Due[]>, owner: number, d: Due) => {
      if (!map.has(owner)) map.set(owner, []);
      map.get(owner)!.push(d);
    };

    // ─── Regular checks and renewals ───
    for (const i of this.store.data.items) {
      if (i.archived) continue;
      const days = daysBetween(today, i.dueOn);
      const stage = reminderStage(days);
      if (!stage) continue;
      const key = `e:${i.id}:${i.dueOn}:${stage}`;
      if (sent[key]) continue;
      add(items, i.companyId, {
        key,
        line: {
          label: this.echeances.title(i),
          when: `${whenLabel(days)} (échéance le ${frenchDay(i.dueOn)})`,
          late: days < 0,
          detail:
            [
              i.reference,
              i.responsible ? `Responsable : ${i.responsible.name}` : null,
            ]
              .filter(Boolean)
              .join(' · ') || null,
        },
        responsible: i.responsible?.email
          ? { name: i.responsible.name, emails: [i.responsible.email] }
          : null,
      });
    }

    // ─── Action plan (open actions on texts that still call for action) ───
    const ts = await this.prisma.texteSociete.findMany({
      where: {
        ...LIVE_ACTIONS_TEXT,
        OR: [{ deleted: false }, { deleted: null }],
        texte: { deleted: false },
      },
      select: { id: true, companyId: true, texte: { select: { titre: true } } },
    });
    const tsById = new Map(ts.map((t) => [t.id, t]));
    const open = await this.prisma.plusaction.findMany({
      where: {
        gestionactionId: { in: OPEN_ACTION_STATES },
        cloture: { not: null },
        texteSocieteId: { in: [...tsById.keys()] },
      },
      select: {
        id: true,
        texteId: true,
        texteSocieteId: true,
        cloture: true,
        libelleAction: true,
        responsableAction: true,
        courrielResponsable: true,
      },
    });
    for (const a of open) {
      const days = daysUntil(a.cloture);
      const link = a.texteSocieteId ? tsById.get(a.texteSocieteId) : undefined;
      if (days === null || !link?.companyId) continue;
      const stage = reminderStage(days);
      if (!stage) continue;
      const key = `a:${a.id}:${a.cloture}:${stage}`;
      if (sent[key]) continue;
      const what = plain(a.libelleAction).slice(0, 110) || 'Action';
      const who = plain(a.responsableAction);
      add(actions, link.companyId, {
        key,
        line: {
          label: `${what} (${link.texte?.titre?.slice(0, 120) ?? 'texte'})`,
          when: `${whenLabel(days)} (à clôturer le ${a.cloture})`,
          late: days < 0,
          detail: who ? `Responsable : ${who}` : null,
        },
        responsible: emailsIn(a.courrielResponsable).length
          ? {
              name: who || 'Madame, Monsieur',
              emails: emailsIn(a.courrielResponsable),
            }
          : null,
        action: { texteId: a.texteId, tsId: link.id },
      });
    }

    // ─── One delivery per company ───
    const owners = [...new Set([...items.keys(), ...actions.keys()])];
    const companies = !owners.length
      ? []
      : await this.prisma.company.findMany({
          where: { id: { in: owners }, deleted: false },
          select: {
            id: true,
            email: true,
            nom: true,
            raisonsociale: true,
            activated: true,
          },
        });
    let emails = 0;
    const now = new Date();
    for (const c of companies) {
      const its = items.get(c.id) ?? [];
      const acts = actions.get(c.id) ?? [];
      if (!its.length && !acts.length) continue;
      const markSent = () => {
        for (const d of [...its, ...acts]) sent[d.key] = now.toISOString();
      };
      // A blocked company gets nothing; reminders resume after renewal
      if (this.subscriptions.isLocked(c.id)) continue;
      if (!c.activated) {
        markSent();
        continue;
      }
      const company = c.raisonsociale || c.nom;

      // Bell: one line for the checks, one per action (it opens its text)
      const late = its.filter((d) => d.line.late).length;
      if (its.length) {
        await this.prisma.notification.create({
          data: {
            companyId: c.id,
            message: `Échéances : ${its.length} à traiter${late ? `, dont ${late} en retard` : ''}.`,
            isRead: false,
            etat: 'nonlu',
            createdAt: now,
          },
        });
      }
      if (acts.length > 3) {
        const lateActs = acts.filter((d) => d.line.late).length;
        await this.prisma.notification.create({
          data: {
            companyId: c.id,
            message: `Plan d’action : ${acts.length} actions arrivent à échéance${lateActs ? `, dont ${lateActs} en retard` : ''}.`,
            isRead: false,
            etat: 'nonlu',
            createdAt: now,
          },
        });
      } else if (acts.length) {
        await this.prisma.notification.createMany({
          data: acts.map((d) => ({
            companyId: c.id,
            texteId: d.action!.texteId,
            texteSocieteId: d.action!.tsId,
            message: d.line.late
              ? 'Une action de votre plan d’action est en retard.'
              : `Action à clôturer ${d.line.when.split(' (')[0]}.`,
            isRead: false,
            etat: 'nonlu',
            createdAt: now,
          })),
        });
      }
      this.realtime.publish(c.id, {
        type: 'notification',
        unread: await this.prisma.notification.count({
          where: { companyId: c.id, OR: [{ isRead: false }, { isRead: null }] },
        }),
        item: {
          message: `${its.length + acts.length} échéance(s) à traiter.`,
          createdAt: now.toISOString(),
        },
      });

      // E-mails: the main account gets everything…
      const mainEmail = c.email.trim().toLowerCase();
      if (this.prefs.filter([c], 'emailReminders').length) {
        await this.mailer.send({
          to: [c.email],
          ...remindersEmail({
            name: c.nom,
            company,
            asResponsible: false,
            items: its.map((d) => d.line),
            actions: acts.map((d) => d.line),
            appUrl: this.appUrl,
          }),
        });
        emails++;
      }
      // …and each person named responsible gets their own lines
      const people = new Map<
        string,
        { name: string; items: ReminderLine[]; actions: ReminderLine[] }
      >();
      const collect = (list: Due[], kind: 'items' | 'actions') => {
        for (const d of list) {
          for (const e of d.responsible?.emails ?? []) {
            if (e === mainEmail) continue;
            if (!people.has(e))
              people.set(e, {
                name: d.responsible!.name,
                items: [],
                actions: [],
              });
            people.get(e)![kind].push(d.line);
          }
        }
      };
      collect(its, 'items');
      collect(acts, 'actions');
      for (const [email, p] of people) {
        await this.mailer.send({
          to: [email],
          ...remindersEmail({
            name: p.name,
            company,
            asResponsible: true,
            items: p.items,
            actions: p.actions,
            appUrl: this.appUrl,
          }),
        });
        emails++;
      }
      markSent();
    }

    // Forget stages older than a year (finished items, closed actions)
    const old = new Date(Date.now() - 400 * 86_400_000).toISOString();
    for (const [k, at] of Object.entries(sent)) if (at < old) delete sent[k];
    this.store.data.lastRun = today;
    await this.store.save();

    const result = {
      companies: companies.length,
      emails,
      items: [...items.values()].flat().length,
      actions: [...actions.values()].flat().length,
    };
    this.logger.log(
      `Rappels : ${result.items} échéance(s) et ${result.actions} action(s), ${result.emails} e-mail(s) pour ${result.companies} entreprise(s)`,
    );
    return result;
  }
}

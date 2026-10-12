import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import {
  addDays,
  addYears,
  daysBetween,
  frenchDay,
  JsonFile,
  tunisDay,
} from '../common/json-file';
import { MailerService } from '../notifications/mailer.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from './activity.service';
import { AdminContactsService } from './admin-contacts.service';
import {
  adminSubscriptionsEmail,
  subscriptionEndingEmail,
  subscriptionLockedEmail,
} from './account-emails';

export type SubscriptionStatus =
  'none' | 'active' | 'expiring' | 'expired' | 'suspended';

export interface SubscriptionHistory {
  at: string;
  by: string;
  action: 'started' | 'renewed' | 'dates' | 'suspended' | 'resumed';
  note: string;
}

interface SubscriptionRecord {
  /** YYYY-MM-DD, first day covered */
  start: string;
  /** YYYY-MM-DD, last day covered */
  end: string;
  suspended: boolean;
  suspendedReason: string | null;
  /** Reminders already sent, keyed "<end>:<30|7|expired|suspended>" */
  sent: Record<string, string>;
  history: SubscriptionHistory[];
}

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  locked: boolean;
  start: string | null;
  end: string | null;
  /** Days until the end date (negative once expired) */
  daysLeft: number | null;
  suspendedReason: string | null;
  /** Shown on the login page and to a blocked session */
  message: string | null;
}

/** Warning period before the end date */
export const WARNING_DAYS = 30;
export const SUBSCRIPTION_LOCKED = 'SUBSCRIPTION_LOCKED';

/**
 * Yearly subscription of each client company to IGTS's watch. Payment is
 * handled outside the platform: IGTS records the period and renews it once
 * paid. From 30 days before the end, the company is warned (banner + e-mails);
 * after the end date — or when IGTS suspends it for non-payment — every
 * account of the company is blocked at sign-in and on its next request.
 * Nothing is deleted, and access returns as soon as IGTS renews.
 *
 * A company without a recorded period (clients of the legacy platform) is
 * not blocked: IGTS sets its dates from the company's page.
 */
@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);
  private readonly file: JsonFile<{
    companies: Record<string, SubscriptionRecord>;
  }>;
  private readonly appUrl: string;

  constructor(
    private prisma: PrismaService,
    private mailer: MailerService,
    private activity: ActivityService,
    private admins: AdminContactsService,
    config: ConfigService,
  ) {
    this.file = new JsonFile(
      config.get<string>('SUBSCRIPTIONS_FILE') ?? 'data/subscriptions.json',
      () => ({ companies: {} }),
      'SubscriptionsService',
    );
    this.appUrl = (
      config.get<string>('APP_URL') ?? 'http://localhost:3000'
    ).replace(/\/$/, '');
  }

  private record(ownerId: number): SubscriptionRecord | null {
    return this.file.data.companies[String(ownerId)] ?? null;
  }

  info(ownerId: number, today = tunisDay()): SubscriptionInfo {
    const r = this.record(ownerId);
    if (!r)
      return {
        status: 'none',
        locked: false,
        start: null,
        end: null,
        daysLeft: null,
        suspendedReason: null,
        message: null,
      };
    const daysLeft = daysBetween(today, r.end);
    let status: SubscriptionStatus = 'active';
    if (r.suspended) status = 'suspended';
    else if (daysLeft < 0) status = 'expired';
    else if (daysLeft <= WARNING_DAYS) status = 'expiring';
    const locked = status === 'suspended' || status === 'expired';
    const message =
      status === 'suspended'
        ? `L’accès de votre entreprise à IGTS Veille est suspendu${r.suspendedReason ? ` (${r.suspendedReason})` : ''}. Contactez IGTS pour le rétablir.`
        : status === 'expired'
          ? `L’abonnement de votre entreprise à IGTS Veille a pris fin le ${frenchDay(r.end)}. Contactez IGTS pour le renouveler : vos données sont conservées.`
          : null;
    return {
      status,
      locked,
      start: r.start,
      end: r.end,
      daysLeft,
      suspendedReason: r.suspendedReason,
      message,
    };
  }

  isLocked(ownerId: number | null | undefined): boolean {
    return ownerId ? this.info(ownerId).locked : false;
  }

  history(ownerId: number): SubscriptionHistory[] {
    return [...(this.record(ownerId)?.history ?? [])].reverse();
  }

  /** Every recorded subscription, with its status today. */
  all(): Map<number, SubscriptionInfo> {
    const today = tunisDay();
    return new Map(
      Object.keys(this.file.data.companies).map((id) => [
        Number(id),
        this.info(Number(id), today),
      ]),
    );
  }

  // ─── Changes by IGTS ────────────────────────────────────────────────

  private async companyName(ownerId: number) {
    const c = await this.prisma.company.findFirst({
      where: { id: ownerId, multicompte: 0, deleted: false },
      select: { raisonsociale: true, nom: true },
    });
    if (!c) throw new NotFoundException('Entreprise introuvable');
    return c.raisonsociale || c.nom;
  }

  private async save(
    ownerId: number,
    r: SubscriptionRecord,
    by: string,
    action: SubscriptionHistory['action'],
    note: string,
  ) {
    r.history.push({ at: new Date().toISOString(), by, action, note });
    this.file.data.companies[String(ownerId)] = r;
    await this.file.save();
    this.activity.log({
      type: 'subscription',
      actor: { kind: by === 'Système' ? 'system' : 'admin', id: null, nom: by },
      companyId: ownerId,
      label: `${await this.companyName(ownerId)} : ${note}`,
    });
    return this.info(ownerId);
  }

  /** A new client: one year from today. */
  async start(ownerId: number, by: string) {
    if (this.record(ownerId)) return this.info(ownerId);
    const start = tunisDay();
    const end = addDays(addYears(start, 1), -1);
    return this.save(
      ownerId,
      {
        start,
        end,
        suspended: false,
        suspendedReason: null,
        sent: {},
        history: [],
      },
      by,
      'started',
      `abonnement d’un an, jusqu’au ${frenchDay(end)}`,
    );
  }

  /**
   * Payment received: one more year. A running subscription is extended from
   * its end date; an expired one (or none) restarts today. Lifts a suspension.
   */
  async renew(ownerId: number, by: string, years = 1) {
    await this.companyName(ownerId);
    const today = tunisDay();
    const r = this.record(ownerId);
    const restart = !r || daysBetween(today, r.end) < 0;
    const start = restart ? today : r.start;
    const end = restart
      ? addDays(addYears(today, years), -1)
      : addYears(r.end, years);
    return this.save(
      ownerId,
      {
        start,
        end,
        suspended: false,
        suspendedReason: null,
        sent: r?.sent ?? {},
        history: r?.history ?? [],
      },
      by,
      'renewed',
      `renouvelé jusqu’au ${frenchDay(end)}`,
    );
  }

  async setDates(ownerId: number, start: string, end: string, by: string) {
    await this.companyName(ownerId);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(end)
    ) {
      throw new BadRequestException('Dates invalides (AAAA-MM-JJ).');
    }
    if (end < start)
      throw new BadRequestException('La fin doit suivre le début.');
    const r = this.record(ownerId);
    return this.save(
      ownerId,
      {
        start,
        end,
        suspended: r?.suspended ?? false,
        suspendedReason: r?.suspendedReason ?? null,
        sent: r?.sent ?? {},
        history: r?.history ?? [],
      },
      by,
      'dates',
      `période fixée du ${frenchDay(start)} au ${frenchDay(end)}`,
    );
  }

  async suspend(ownerId: number, reason: string, by: string) {
    const company = await this.companyName(ownerId);
    const r = this.record(ownerId) ?? {
      start: tunisDay(),
      end: addDays(addYears(tunisDay(), 1), -1),
      suspended: false,
      suspendedReason: null,
      sent: {},
      history: [],
    };
    const why = reason.trim() || 'abonnement impayé';
    const info = await this.save(
      ownerId,
      { ...r, suspended: true, suspendedReason: why },
      by,
      'suspended',
      `accès suspendu (${why})`,
    );
    void this.mailCompany(ownerId, (name) =>
      subscriptionLockedEmail({ name, company, reason: why }),
    );
    return info;
  }

  async resume(ownerId: number, by: string) {
    const r = this.record(ownerId);
    if (!r?.suspended) return this.info(ownerId);
    return this.save(
      ownerId,
      { ...r, suspended: false, suspendedReason: null },
      by,
      'resumed',
      'accès rétabli',
    );
  }

  // ─── Daily reminders (8:00, Tunis) ──────────────────────────────────

  private async mailCompany(
    ownerId: number,
    build: (name: string) => { subject: string; html: string; text: string },
  ) {
    const accounts = await this.prisma.company.findMany({
      where: {
        OR: [{ id: ownerId }, { multicompte: ownerId }],
        deleted: false,
        activated: true,
      },
      select: { email: true, nom: true, multicompte: true },
    });
    const main = accounts.find((a) => a.multicompte === 0);
    await this.mailer.send({
      to: accounts.map((a) => a.email),
      ...build(main?.nom ?? ''),
    });
  }

  @Cron('0 8 * * *', {
    name: 'subscriptions-reminders',
    timeZone: 'Africa/Tunis',
  })
  async remind() {
    const today = tunisDay();
    const ending: { company: string; endLabel: string; daysLeft: number }[] =
      [];
    const expired: { company: string; endLabel: string }[] = [];

    for (const [key, r] of Object.entries(this.file.data.companies)) {
      const ownerId = Number(key);
      if (r.suspended) continue;
      const left = daysBetween(today, r.end);
      const kind =
        left < 0
          ? 'expired'
          : left <= 7
            ? '7'
            : left <= WARNING_DAYS
              ? '30'
              : null;
      if (!kind || r.sent[`${r.end}:${kind}`]) continue;
      r.sent[`${r.end}:${kind}`] = new Date().toISOString();

      let company: string;
      try {
        company = await this.companyName(ownerId);
      } catch {
        continue; // company deleted
      }
      const endLabel = frenchDay(r.end);
      if (kind === 'expired') {
        expired.push({ company, endLabel });
        await this.mailCompany(ownerId, (name) =>
          subscriptionLockedEmail({
            name,
            company,
            reason: `l’abonnement a pris fin le ${endLabel}`,
          }),
        );
        this.activity.log({
          type: 'subscription',
          actor: { kind: 'system', id: null, nom: 'Système' },
          companyId: ownerId,
          label: `${company} : abonnement expiré, accès bloqué`,
        });
      } else {
        ending.push({ company, endLabel, daysLeft: left });
        await this.mailCompany(ownerId, (name) =>
          subscriptionEndingEmail({
            name,
            company,
            endLabel,
            daysLeft: left,
            appUrl: this.appUrl,
          }),
        );
      }
    }
    await this.file.save();

    if (ending.length || expired.length) {
      for (const a of await this.admins.list()) {
        await this.mailer.send({
          to: [a.email],
          ...adminSubscriptionsEmail({
            name: a.nom,
            ending,
            expired,
            url: `${this.appUrl}/dashboard/companies?abonnement=a-relancer`,
          }),
        });
      }
      this.logger.log(
        `Abonnements : ${ending.length} rappel(s), ${expired.length} expiration(s)`,
      );
    }
    return { ending: ending.length, expired: expired.length };
  }
}

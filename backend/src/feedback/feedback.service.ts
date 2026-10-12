import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { addDays, frenchDay, JsonFile, tunisDay } from '../common/json-file';
import type { AuthUser } from '../common/auth-user';
import { MailerService } from '../notifications/mailer.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../accounts/activity.service';
import { SubscriptionsService } from '../accounts/subscriptions.service';
import { feedbackInviteEmail } from './feedback-emails';

export interface Question {
  id: string;
  label: string;
  kind: 'rating' | 'text';
  required: boolean;
}

export interface Campaign {
  id: number;
  title: string;
  year: number;
  openedAt: string;
  /** YYYY-MM-DD, last day to answer */
  closesOn: string;
  closedAt: string | null;
  trigger: 'auto' | 'manual';
  openedBy: string;
  /** Questions as they were when the survey opened */
  questions: Question[];
}

export interface FeedbackResponse {
  campaignId: number;
  accountId: number;
  ownerId: number;
  nom: string;
  answers: Record<string, number | string>;
  submittedAt: string;
}

interface Data {
  nextId: number;
  questions: Question[];
  campaigns: Campaign[];
  responses: FeedbackResponse[];
}

export const DEFAULT_QUESTIONS: Question[] = [
  {
    id: 'pertinence',
    kind: 'rating',
    required: true,
    label: 'Les textes que vous recevez correspondent-ils à votre activité ?',
  },
  {
    id: 'resumes',
    kind: 'rating',
    required: true,
    label: 'Les résumés vous aident-ils à comprendre rapidement chaque texte ?',
  },
  {
    id: 'plateforme',
    kind: 'rating',
    required: true,
    label: 'La plateforme est-elle simple à utiliser ?',
  },
  {
    id: 'accompagnement',
    kind: 'rating',
    required: true,
    label: 'Êtes-vous satisfait de l’accompagnement d’IGTS ?',
  },
  {
    id: 'global',
    kind: 'rating',
    required: true,
    label: 'Dans l’ensemble, êtes-vous satisfait de la veille IGTS ?',
  },
  {
    id: 'ameliorer',
    kind: 'text',
    required: false,
    label: 'Que devrions-nous améliorer ?',
  },
];

const DEFAULT_DURATION_DAYS = 30;

/**
 * Yearly satisfaction survey of the client companies. IGTS edits the
 * questions and launches a survey whenever it wants; one opens by itself
 * every 1 September (Tunis time) if none was launched since August. Each
 * person answers once; results and averages are shown to the administrators.
 */
@Injectable()
export class FeedbackService implements OnApplicationBootstrap {
  private readonly logger = new Logger(FeedbackService.name);
  private readonly file: JsonFile<Data>;
  private readonly appUrl: string;

  constructor(
    private prisma: PrismaService,
    private mailer: MailerService,
    private activity: ActivityService,
    private subscriptions: SubscriptionsService,
    config: ConfigService,
  ) {
    this.file = new JsonFile<Data>(
      config.get<string>('FEEDBACK_FILE') ?? 'data/feedback.json',
      () => ({
        nextId: 1,
        questions: DEFAULT_QUESTIONS,
        campaigns: [],
        responses: [],
      }),
      'FeedbackService',
    );
    this.appUrl = (
      config.get<string>('APP_URL') ?? 'http://localhost:3000'
    ).replace(/\/$/, '');
  }

  // ─── Schedule ───────────────────────────────────────────────────────

  @Cron('0 9 1 9 *', { name: 'feedback-september', timeZone: 'Africa/Tunis' })
  async september() {
    if (this.launchedThisSeason()) return;
    await this.open({ by: 'Système', trigger: 'auto' }).catch((e: Error) =>
      this.logger.warn(e.message),
    );
  }

  /** The server was off on 1 September: open the survey when it starts again during September. */
  onApplicationBootstrap() {
    const today = tunisDay();
    if (today.slice(5, 7) !== '09' || this.launchedThisSeason()) return;
    setTimeout(() => void this.september(), 90_000).unref();
  }

  /** A survey was already opened since 1 August of this year. */
  private launchedThisSeason(): boolean {
    const from = `${tunisDay().slice(0, 4)}-08-01`;
    return this.file.data.campaigns.some(
      (c) => tunisDay(new Date(c.openedAt)) >= from,
    );
  }

  // ─── Questions ──────────────────────────────────────────────────────

  questions(): Question[] {
    return this.file.data.questions;
  }

  async setQuestions(
    list: {
      id?: string;
      label: string;
      kind: 'rating' | 'text';
      required: boolean;
    }[],
  ) {
    if (!list.some((q) => q.kind === 'rating')) {
      throw new BadRequestException(
        'Gardez au moins une question notée de 1 à 5.',
      );
    }
    const used = new Set<string>();
    this.file.data.questions = list.map((q, i) => {
      let id =
        q.id?.trim() ||
        q.label
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 30) ||
        `q${i + 1}`;
      while (used.has(id)) id = `${id}-${i + 1}`;
      used.add(id);
      return {
        id,
        label: q.label.trim(),
        kind: q.kind,
        required: q.kind === 'rating' ? q.required : false,
      };
    });
    await this.file.save();
    return this.file.data.questions;
  }

  // ─── Campaigns ──────────────────────────────────────────────────────

  /** The survey open today, if any (closes itself after its last day). */
  current(): Campaign | null {
    const today = tunisDay();
    for (const c of this.file.data.campaigns) {
      if (c.closedAt) continue;
      if (c.closesOn < today) {
        c.closedAt = `${c.closesOn}T23:59:59.000Z`;
        void this.file.save();
        continue;
      }
      return c;
    }
    return null;
  }

  async open(o: {
    by: string;
    trigger: 'auto' | 'manual';
    title?: string;
    closesOn?: string;
  }) {
    if (this.current())
      throw new ConflictException(
        'Une enquête est déjà ouverte. Clôturez-la avant d’en lancer une autre.',
      );
    const today = tunisDay();
    const closesOn = o.closesOn ?? addDays(today, DEFAULT_DURATION_DAYS - 1);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(closesOn) || closesOn < today) {
      throw new BadRequestException(
        'La date de clôture doit être aujourd’hui ou plus tard.',
      );
    }
    const year = Number(today.slice(0, 4));
    const c: Campaign = {
      id: this.file.data.nextId++,
      title: o.title?.trim() || `Enquête de satisfaction ${year}`,
      year,
      openedAt: new Date().toISOString(),
      closesOn,
      closedAt: null,
      trigger: o.trigger,
      openedBy: o.by,
      questions: this.file.data.questions.map((q) => ({ ...q })),
    };
    this.file.data.campaigns.push(c);
    await this.file.save();
    this.activity.log({
      type: 'feedback',
      actor: {
        kind: o.trigger === 'auto' ? 'system' : 'admin',
        id: null,
        nom: o.by,
      },
      companyId: null,
      label: `« ${c.title} » ouverte${o.trigger === 'auto' ? ' automatiquement' : ''}, jusqu’au ${frenchDay(closesOn)}`,
    });
    void this.invite(c).catch((e: Error) =>
      this.logger.error(`Invitations impossibles : ${e.message}`),
    );
    return c;
  }

  async close(id: number, by: string) {
    const c = this.file.data.campaigns.find((x) => x.id === id);
    if (!c) throw new NotFoundException('Enquête introuvable');
    if (!c.closedAt) {
      c.closedAt = new Date().toISOString();
      await this.file.save();
      this.activity.log({
        type: 'feedback',
        actor: { kind: 'admin', id: null, nom: by },
        companyId: null,
        label: `« ${c.title} » clôturée`,
      });
    }
    return c;
  }

  /** E-mail to every active account of every company whose access is open. */
  private async invite(c: Campaign) {
    const accounts = await this.prisma.company.findMany({
      where: { deleted: false, activated: true },
      select: { email: true, nom: true, multicompte: true, id: true },
    });
    let sent = 0;
    for (const a of accounts) {
      const ownerId = a.multicompte > 0 ? a.multicompte : a.id;
      if (this.subscriptions.isLocked(ownerId)) continue;
      await this.mailer.send({
        to: [a.email],
        ...feedbackInviteEmail({
          name: a.nom,
          title: c.title,
          closesOn: frenchDay(c.closesOn),
          url: `${this.appUrl}/dashboard/avis`,
        }),
      });
      sent++;
    }
    this.logger.log(`« ${c.title} » : ${sent} invitation(s) envoyée(s)`);
  }

  // ─── Company side ───────────────────────────────────────────────────

  forUser(user: AuthUser) {
    const c = this.current();
    if (!c) return { campaign: null, answered: false };
    const answered = this.file.data.responses.some(
      (r) => r.campaignId === c.id && r.accountId === user.id,
    );
    return {
      campaign: {
        id: c.id,
        title: c.title,
        closesOn: c.closesOn,
        questions: c.questions,
      },
      answered,
    };
  }

  async submit(user: AuthUser, answers: Record<string, unknown>) {
    const c = this.current();
    if (!c)
      throw new NotFoundException('Aucune enquête n’est ouverte en ce moment.');
    if (
      this.file.data.responses.some(
        (r) => r.campaignId === c.id && r.accountId === user.id,
      )
    ) {
      throw new ConflictException(
        'Vous avez déjà répondu à cette enquête. Merci !',
      );
    }
    const clean: Record<string, number | string> = {};
    for (const q of c.questions) {
      const v = answers[q.id];
      if (q.kind === 'rating') {
        const n = Number(v);
        if (v === undefined || v === null || v === '') {
          if (q.required)
            throw new BadRequestException(`Merci de noter : « ${q.label} »`);
          continue;
        }
        if (!Number.isInteger(n) || n < 1 || n > 5)
          throw new BadRequestException('Les notes vont de 1 à 5.');
        clean[q.id] = n;
      } else if (typeof v === 'string' && v.trim()) {
        clean[q.id] = v.trim().slice(0, 2000);
      }
    }
    this.file.data.responses.push({
      campaignId: c.id,
      accountId: user.id,
      ownerId: user.ownerId!,
      nom: user.nom,
      answers: clean,
      submittedAt: new Date().toISOString(),
    });
    await this.file.save();
    const owner = await this.prisma.company.findUnique({
      where: { id: user.ownerId! },
      select: { raisonsociale: true, nom: true },
    });
    this.activity.log({
      type: 'feedback',
      actor: { kind: 'company', id: user.id, nom: user.nom },
      companyId: user.ownerId,
      label: `${user.nom} (${owner?.raisonsociale || owner?.nom || 'entreprise'}) a répondu à « ${c.title} »`,
    });
    return { ok: true };
  }

  // ─── Results (administrators) ───────────────────────────────────────

  private average(c: Campaign, responses: FeedbackResponse[]): number | null {
    const notes = responses.flatMap((r) =>
      c.questions
        .filter((q) => q.kind === 'rating')
        .map((q) => r.answers[q.id])
        .filter((v): v is number => typeof v === 'number'),
    );
    return notes.length
      ? Math.round((notes.reduce((a, b) => a + b, 0) / notes.length) * 10) / 10
      : null;
  }

  overview() {
    const current = this.current();
    return {
      questions: this.file.data.questions,
      current: current ? current.id : null,
      campaigns: [...this.file.data.campaigns]
        .sort((a, b) => b.id - a.id)
        .map((c) => {
          const responses = this.file.data.responses.filter(
            (r) => r.campaignId === c.id,
          );
          return {
            ...c,
            open: current?.id === c.id,
            respondents: responses.length,
            companies: new Set(responses.map((r) => r.ownerId)).size,
            average: this.average(c, responses),
          };
        }),
    };
  }

  async results(id: number) {
    const c = this.file.data.campaigns.find((x) => x.id === id);
    if (!c) throw new NotFoundException('Enquête introuvable');
    this.current();
    const responses = this.file.data.responses.filter(
      (r) => r.campaignId === id,
    );
    const owners = await this.prisma.company.findMany({
      where: { id: { in: [...new Set(responses.map((r) => r.ownerId))] } },
      select: { id: true, raisonsociale: true, nom: true },
    });
    const companyName = new Map(
      owners.map((o) => [o.id, o.raisonsociale || o.nom]),
    );
    const companiesTotal = await this.prisma.company.count({
      where: { deleted: false, multicompte: 0, activated: true },
    });

    return {
      campaign: { ...c, open: !c.closedAt },
      respondents: responses.length,
      companiesAnswered: new Set(responses.map((r) => r.ownerId)).size,
      companiesTotal,
      average: this.average(c, responses),
      questions: c.questions.map((q) => {
        if (q.kind === 'rating') {
          const notes = responses
            .map((r) => r.answers[q.id])
            .filter((v): v is number => typeof v === 'number');
          const distribution = [1, 2, 3, 4, 5].map(
            (n) => notes.filter((x) => x === n).length,
          );
          return {
            ...q,
            count: notes.length,
            average: notes.length
              ? Math.round(
                  (notes.reduce((a, b) => a + b, 0) / notes.length) * 10,
                ) / 10
              : null,
            distribution,
          };
        }
        return {
          ...q,
          count: responses.filter((r) => typeof r.answers[q.id] === 'string')
            .length,
          comments: responses
            .filter((r) => typeof r.answers[q.id] === 'string')
            .map((r) => ({
              nom: r.nom,
              company: companyName.get(r.ownerId) ?? '',
              text: r.answers[q.id] as string,
              at: r.submittedAt,
            })),
        };
      }),
      byCompany: [...new Set(responses.map((r) => r.ownerId))]
        .map((ownerId) => {
          const rs = responses.filter((r) => r.ownerId === ownerId);
          return {
            companyId: ownerId,
            company: companyName.get(ownerId) ?? '',
            respondents: rs.length,
            average: this.average(c, rs),
          };
        })
        .sort((a, b) => (a.average ?? 0) - (b.average ?? 0)),
    };
  }

  /** Latest survey's headline figures, for the statistics page. */
  latestSummary() {
    const latest = [...this.file.data.campaigns].sort((a, b) => b.id - a.id)[0];
    if (!latest) return null;
    const responses = this.file.data.responses.filter(
      (r) => r.campaignId === latest.id,
    );
    return {
      id: latest.id,
      title: latest.title,
      open: !latest.closedAt && latest.closesOn >= tunisDay(),
      respondents: responses.length,
      companies: new Set(responses.map((r) => r.ownerId)).size,
      average: this.average(latest, responses),
    };
  }
}

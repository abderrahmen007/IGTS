import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { canEditFromRights } from '../common/auth-user';
import { JsonFile } from '../common/json-file';
import { hashPassword } from '../common/password';
import { MailerService } from '../notifications/mailer.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from './activity.service';
import { AdminContactsService } from './admin-contacts.service';
import { accountActivatedEmail, accountRequestEmail } from './account-emails';

export interface AccountRequest {
  accountId: number;
  ownerId: number;
  requestedBy: string;
  requestedAt: string;
  status: 'pending' | 'done' | 'cancelled';
  doneAt: string | null;
  doneBy: string | null;
}

/**
 * Passwords are managed by IGTS only. When a company's main account adds a
 * colleague, the account is created switched off with an unusable password;
 * the administrators are told, set the password and switch it on. The
 * colleague then receives an e-mail (without the password, which IGTS hands
 * over itself).
 */
@Injectable()
export class AccountRequestsService {
  private readonly file: JsonFile<{ requests: AccountRequest[] }>;
  private readonly appUrl: string;

  constructor(
    private prisma: PrismaService,
    private mailer: MailerService,
    private admins: AdminContactsService,
    private activity: ActivityService,
    config: ConfigService,
  ) {
    this.file = new JsonFile(
      config.get<string>('ACCOUNT_REQUESTS_FILE') ??
        'data/account-requests.json',
      () => ({ requests: [] }),
      'AccountRequestsService',
    );
    this.appUrl = (
      config.get<string>('APP_URL') ?? 'http://localhost:3000'
    ).replace(/\/$/, '');
  }

  /** A password nobody knows, until IGTS sets the real one. */
  static async unusablePassword() {
    return hashPassword(randomBytes(32).toString('hex'));
  }

  pending(): AccountRequest[] {
    return this.file.data.requests.filter((r) => r.status === 'pending');
  }

  isPending(accountId: number): boolean {
    return this.file.data.requests.some(
      (r) => r.accountId === accountId && r.status === 'pending',
    );
  }

  pendingIds(): Set<number> {
    return new Set(this.pending().map((r) => r.accountId));
  }

  async request(o: {
    accountId: number;
    ownerId: number;
    requestedBy: string;
  }) {
    this.file.data.requests.push({
      ...o,
      requestedAt: new Date().toISOString(),
      status: 'pending',
      doneAt: null,
      doneBy: null,
    });
    await this.file.save();

    const [account, owner] = await Promise.all([
      this.prisma.company.findUnique({
        where: { id: o.accountId },
        select: {
          nom: true,
          email: true,
          droitacceeId: true,
          multicompte: true,
        },
      }),
      this.prisma.company.findUnique({
        where: { id: o.ownerId },
        select: { raisonsociale: true, nom: true },
      }),
    ]);
    if (!account || !owner) return;
    const company = owner.raisonsociale || owner.nom;
    this.activity.log({
      type: 'account',
      actor: { kind: 'company', id: o.ownerId, nom: o.requestedBy },
      companyId: o.ownerId,
      label: `${company} : compte demandé pour ${account.nom}`,
    });
    for (const a of await this.admins.list()) {
      await this.mailer.send({
        to: [a.email],
        ...accountRequestEmail({
          name: a.nom,
          member: account.nom,
          memberEmail: account.email,
          company,
          requestedBy: o.requestedBy,
          canEdit: canEditFromRights(account.multicompte, account.droitacceeId),
          url: `${this.appUrl}/dashboard/companies/${o.ownerId}?tab=utilisateurs`,
        }),
      });
    }
  }

  /** IGTS sets the password and switches the account on (also used for any account IGTS reactivates). */
  async activate(accountId: number, password: string, by: string) {
    const account = await this.prisma.company.findFirst({
      where: { id: accountId, deleted: false },
    });
    if (!account) throw new NotFoundException('Compte introuvable');
    if (password.length < 8)
      throw new BadRequestException(
        'Le mot de passe doit faire au moins 8 caractères.',
      );
    await this.prisma.company.update({
      where: { id: accountId },
      data: {
        password: await hashPassword(password),
        activated: true,
        updatedAt: new Date(),
      },
    });
    await this.complete(accountId, by);
    return { ok: true };
  }

  /** Marks the request as done and welcomes the colleague (once). */
  async complete(accountId: number, by: string) {
    const req = this.file.data.requests.find(
      (r) => r.accountId === accountId && r.status === 'pending',
    );
    if (!req) return;
    req.status = 'done';
    req.doneAt = new Date().toISOString();
    req.doneBy = by;
    await this.file.save();

    const [account, owner] = await Promise.all([
      this.prisma.company.findUnique({
        where: { id: accountId },
        select: {
          nom: true,
          email: true,
          droitacceeId: true,
          multicompte: true,
        },
      }),
      this.prisma.company.findUnique({
        where: { id: req.ownerId },
        select: { raisonsociale: true, nom: true },
      }),
    ]);
    if (!account || !owner) return;
    const company = owner.raisonsociale || owner.nom;
    this.activity.log({
      type: 'account',
      actor: { kind: 'admin', id: null, nom: by },
      companyId: req.ownerId,
      label: `${company} : compte de ${account.nom} activé`,
    });
    await this.mailer.send({
      to: [account.email],
      ...accountActivatedEmail({
        name: account.nom,
        company,
        email: account.email,
        canEdit: canEditFromRights(account.multicompte, account.droitacceeId),
        appUrl: this.appUrl,
      }),
    });
  }

  async cancel(accountId: number) {
    const req = this.file.data.requests.find(
      (r) => r.accountId === accountId && r.status === 'pending',
    );
    if (!req) return;
    req.status = 'cancelled';
    req.doneAt = new Date().toISOString();
    await this.file.save();
  }
}

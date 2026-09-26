import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdirSync, promises as fs } from 'fs';
import { join, resolve } from 'path';

export interface Mail {
  to: string[];
  subject: string;
  html: string;
  text: string;
}

interface Transport {
  sendMail(m: { from: string; to: string; subject: string; html: string; text: string }): Promise<unknown>;
}

/**
 * Sends e-mails through SMTP (nodemailer) when SMTP_HOST is configured.
 * Otherwise — typically in development — each e-mail is written as an .html
 * file in MAIL_OUTBOX_DIR so it can be opened in a browser and nothing is sent
 * to real clients by accident.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly from: string;
  private readonly outbox: string;
  private readonly enabled: boolean;
  private transport: Transport | null = null;

  constructor(config: ConfigService) {
    this.from = config.get<string>('MAIL_FROM') ?? 'IGTS Veille <veille@inter-gts.com>';
    this.outbox = resolve(config.get<string>('MAIL_OUTBOX_DIR') ?? 'outbox');
    this.enabled = config.get<string>('EMAIL_NOTIFICATIONS') !== 'false';

    const host = config.get<string>('SMTP_HOST');
    if (host) {
      try {
        // Loaded lazily: the API still starts if the package isn't installed yet
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const nodemailer = require('nodemailer') as {
          createTransport(o: Record<string, unknown>): Transport;
        };
        const port = Number(config.get<string>('SMTP_PORT') ?? 587);
        this.transport = nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: config.get<string>('SMTP_USER')
            ? { user: config.get<string>('SMTP_USER'), pass: config.get<string>('SMTP_PASSWORD') }
            : undefined,
        });
        this.logger.log(`E-mails envoyés via SMTP ${host}:${port}`);
      } catch {
        this.logger.warn('SMTP_HOST est défini mais le paquet "nodemailer" est absent (npm install). E-mails écrits dans le dossier outbox.');
      }
    }
    if (!this.transport) {
      mkdirSync(this.outbox, { recursive: true });
      this.logger.log(`Mode test : les e-mails sont enregistrés dans ${this.outbox}`);
    }
  }

  /** Never throws: an e-mail failure must not break the business action. */
  async send(mail: Mail): Promise<void> {
    const to = [...new Set(mail.to.map((t) => t.trim().toLowerCase()).filter((t) => /.+@.+\..+/.test(t)))];
    if (!this.enabled || !to.length) return;
    try {
      if (this.transport) {
        // One message per recipient so clients don't see each other's addresses
        for (const recipient of to) {
          await this.transport.sendMail({ from: this.from, to: recipient, subject: mail.subject, html: mail.html, text: mail.text });
        }
        return;
      }
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const slug = mail.subject.normalize('NFD').replace(/[^\w]+/g, '-').slice(0, 50);
      const header = `<!--\nDe : ${this.from}\nÀ : ${to.join(', ')}\nObjet : ${mail.subject}\n-->\n`;
      const file = join(this.outbox, `${stamp}-${slug}.html`);
      await fs.writeFile(file, header + mail.html);
      this.logger.log(`E-mail (test) « ${mail.subject} » → ${to.join(', ')} : ${file}`);
    } catch (e) {
      this.logger.error(`Échec d’envoi de l’e-mail « ${mail.subject} » : ${(e as Error).message}`);
    }
  }
}

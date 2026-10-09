import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHmac } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AdminTextsService } from '../admin/texts.service';
import { MailerService } from '../notifications/mailer.service';
import { requireJwtSecret } from '../auth/jwt-secret';
import type { UploadedPdf } from '../files/files.service';
import {
  DraftsStore,
  type Draft,
  type DraftActor,
  type DraftStatus,
} from './drafts.store';
import { collectFailedEmail, newDraftsEmail } from './veille-email';
import { isPdf } from './pdf-pages';

/** Editable fields of a draft (same as a text). */
export interface DraftFields {
  titre?: string;
  description?: string;
  journal?: string;
  date?: string;
  num?: string;
  typeId?: number | null;
  secteurId?: number | null;
  themeId?: number | null;
}

interface Names {
  types: Map<number, string>;
  secteurs: Map<number, string>;
  themes: Map<number, { name: string; secteurId: number | null }>;
}

const VALIDATION_TTL = '14d';

/** Lower case, no accents, no punctuation: used to spot a text already in the base. */
export function normalizeTitle(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Review and publication of the drafts prepared by the daily collection.
 * Publishing goes through the normal text creation, so the text reaches the
 * subscribed companies exactly as if an administrator had typed it.
 */
@Injectable()
export class DraftsService {
  private readonly logger = new Logger(DraftsService.name);
  private readonly appUrl: string;
  private readonly publicApiUrl: string;
  private readonly validationSecret: string;
  private readonly notifyOnly: string[];
  private readonly publishing = new Set<number>();
  private namesCache: { at: number; names: Names } | null = null;

  constructor(
    private store: DraftsStore,
    private prisma: PrismaService,
    private texts: AdminTextsService,
    private mailer: MailerService,
    private jwt: JwtService,
    config: ConfigService,
  ) {
    this.appUrl = (
      config.get<string>('APP_URL') ?? 'http://localhost:3000'
    ).replace(/\/$/, '');
    this.publicApiUrl = (
      config.get<string>('PUBLIC_API_URL') ?? '/api'
    ).replace(/\/$/, '');
    // A key of its own: a validation link can never be used as a session token, and vice versa
    this.validationSecret = createHmac('sha256', requireJwtSecret(config))
      .update('veille-draft-validation')
      .digest('hex');
    this.notifyOnly = (config.get<string>('VEILLE_NOTIFY_TO') ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }

  // ─── Views ──────────────────────────────────────────────────────────

  fileUrl(name: string | null): string | null {
    return name
      ? `${this.publicApiUrl}/veille/files/${encodeURIComponent(name)}`
      : null;
  }

  private async names(): Promise<Names> {
    if (this.namesCache && Date.now() - this.namesCache.at < 60_000)
      return this.namesCache.names;
    const [types, secteurs, themes] = await Promise.all([
      this.prisma.type.findMany({ select: { id: true, name: true } }),
      this.prisma.secteur.findMany({ select: { id: true, name: true } }),
      this.prisma.theme.findMany({
        select: { id: true, name: true, secteurId: true },
      }),
    ]);
    const names: Names = {
      types: new Map(types.map((t) => [t.id, t.name])),
      secteurs: new Map(secteurs.map((s) => [s.id, s.name])),
      themes: new Map(
        themes.map((t) => [t.id, { name: t.name, secteurId: t.secteurId }]),
      ),
    };
    this.namesCache = { at: Date.now(), names };
    return names;
  }

  /** Number of companies that will receive the text once published. */
  private companiesFor(
    d: Pick<Draft, 'secteurId' | 'themeId'>,
  ): Promise<number> {
    if (!d.themeId || !d.secteurId) return Promise.resolve(0);
    return this.prisma.companyTheme.count({
      where: {
        themeId: d.themeId,
        secteurId: d.secteurId,
        company: { deleted: false },
      },
    });
  }

  private ready(
    d: Pick<
      Draft,
      'titre' | 'description' | 'typeId' | 'secteurId' | 'themeId'
    >,
  ): boolean {
    return Boolean(
      d.titre.trim().length >= 3 &&
      d.description.trim().length >= 3 &&
      d.typeId &&
      d.secteurId &&
      d.themeId,
    );
  }

  async view(d: Draft) {
    const n = await this.names();
    const ref = (map: Map<number, string>, id: number | null) =>
      id && map.has(id) ? { id, name: map.get(id)! } : null;
    const theme =
      d.themeId && n.themes.has(d.themeId)
        ? { id: d.themeId, name: n.themes.get(d.themeId)!.name }
        : null;
    return {
      id: d.id,
      status: d.status,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      titre: d.titre,
      description: d.description,
      journal: d.journal,
      date: d.date,
      num: d.num,
      type: ref(n.types, d.typeId),
      secteur: ref(n.secteurs, d.secteurId),
      theme,
      pdfUrl: this.fileUrl(d.pdf),
      issuePdfUrl: this.fileUrl(d.source.issuePdf),
      ai: d.ai,
      source: { ...d.source },
      ready: this.ready(d),
      companies: await this.companiesFor(d),
      duplicateOf:
        d.status === 'pending' ? await this.findDuplicate(d.titre) : null,
      publishedTextId: d.publishedTextId ?? null,
      publishedAt: d.publishedAt ?? null,
      publishedBy: d.publishedBy ?? null,
      rejectedAt: d.rejectedAt ?? null,
      rejectedBy: d.rejectedBy ?? null,
      rejectReason: d.rejectReason ?? null,
    };
  }

  async list(status?: DraftStatus) {
    const drafts = this.store.list(status);
    return {
      counts: {
        pending: this.store.list('pending').length,
        published: this.store.list('published').length,
        rejected: this.store.list('rejected').length,
      },
      items: await Promise.all(drafts.map((d) => this.view(d))),
    };
  }

  private get(id: number): Draft {
    const d = this.store.get(id);
    if (!d) throw new NotFoundException('Brouillon introuvable');
    return d;
  }

  async detail(id: number) {
    return this.view(this.get(id));
  }

  /** A text already in the base with the same title, if any. */
  async findDuplicate(
    titre: string,
  ): Promise<{ id: number; titre: string } | null> {
    const key = normalizeTitle(titre);
    if (key.length < 12) return null;
    const rows = await this.prisma.texte.findMany({
      where: { deleted: false },
      select: { id: true, titre: true },
    });
    const hit = rows.find((r) => normalizeTitle(r.titre) === key);
    return hit ? { id: hit.id, titre: hit.titre } : null;
  }

  // ─── Changes ────────────────────────────────────────────────────────

  private assertPending(d: Draft) {
    if (d.status === 'published') {
      const by = d.publishedBy ? ` par ${d.publishedBy.nom}` : '';
      throw new ConflictException(`Ce texte a déjà été publié${by}.`);
    }
    if (d.status === 'rejected')
      throw new ConflictException(
        'Ce brouillon a été écarté. Restaurez-le pour le publier.',
      );
  }

  private async checkFields(f: DraftFields) {
    if (f.themeId && f.secteurId) {
      const n = await this.names();
      const theme = n.themes.get(f.themeId);
      if (!theme) throw new BadRequestException('Thème introuvable');
      if (theme.secteurId !== f.secteurId)
        throw new BadRequestException(
          'Ce thème n’appartient pas au secteur choisi',
        );
    }
  }

  private clean(f: DraftFields): Partial<Draft> {
    const out: Partial<Draft> = {};
    for (const k of [
      'titre',
      'description',
      'journal',
      'date',
      'num',
    ] as const) {
      if (f[k] !== undefined) out[k] = String(f[k]).trim();
    }
    for (const k of ['typeId', 'secteurId', 'themeId'] as const) {
      if (f[k] !== undefined) out[k] = f[k] ? Number(f[k]) : null;
    }
    return out;
  }

  /** Saves the reviewer's edits (and a replacement PDF) without publishing. */
  async update(id: number, fields: DraftFields, pdf?: UploadedPdf) {
    const d = this.get(id);
    this.assertPending(d);
    const patch = this.clean(fields);
    await this.checkFields({ ...d, ...patch });
    if (pdf) {
      if (!isPdf(pdf.buffer))
        throw new BadRequestException('Le fichier doit être un PDF');
      patch.pdf = await this.store.saveFile(`texte-modifie-${id}`, pdf.buffer);
    }
    return this.view(await this.store.update(id, patch));
  }

  async reject(id: number, actor: DraftActor, reason?: string) {
    const d = this.get(id);
    this.assertPending(d);
    return this.view(
      await this.store.update(id, {
        status: 'rejected',
        rejectedAt: new Date().toISOString(),
        rejectedBy: actor,
        rejectReason: reason?.trim() || undefined,
      }),
    );
  }

  async restore(id: number) {
    const d = this.get(id);
    if (d.status !== 'rejected')
      throw new ConflictException(
        'Seul un brouillon écarté peut être restauré.',
      );
    return this.view(
      await this.store.update(id, {
        status: 'pending',
        rejectedAt: undefined,
        rejectedBy: undefined,
        rejectReason: undefined,
      }),
    );
  }

  /** Creates the real text (and sends it to the subscribed companies). */
  async publish(
    id: number,
    actor: DraftActor,
    fields: DraftFields = {},
    pdf?: UploadedPdf,
  ) {
    const d = this.get(id);
    this.assertPending(d);
    if (this.publishing.has(id))
      throw new ConflictException('Ce texte est en cours de publication.');
    this.publishing.add(id);
    try {
      const merged: Draft = { ...d, ...this.clean(fields) };
      await this.checkFields(merged);
      if (!this.ready(merged)) {
        throw new BadRequestException(
          'Complétez le type, le secteur et le thème avant de publier ce texte.',
        );
      }

      let file = pdf;
      if (!file && merged.pdf && this.store.exists(merged.pdf)) {
        const buffer = await this.store.readFile(merged.pdf);
        file = {
          originalname: `${merged.num || 'texte'}.pdf`,
          mimetype: 'application/pdf',
          size: buffer.length,
          buffer,
        };
      }

      const created = await this.texts.create(
        {
          titre: merged.titre,
          description: merged.description,
          journal: merged.journal,
          date: merged.date,
          num: merged.num,
          typeId: merged.typeId!,
          secteurId: merged.secteurId!,
          themeId: merged.themeId!,
        },
        file,
      );

      const saved = await this.store.update(id, {
        ...this.clean(fields),
        status: 'published',
        publishedTextId: created.id,
        publishedAt: new Date().toISOString(),
        publishedBy: actor,
      });
      this.logger.log(
        `Brouillon ${id} publié (texte ${created.id}, ${created.distributedTo} entreprise(s)) par ${actor.nom} via ${actor.via}`,
      );
      return {
        textId: created.id,
        distributedTo: created.distributedTo,
        draft: await this.view(saved),
      };
    } finally {
      this.publishing.delete(id);
    }
  }

  // ─── Validation links (e-mail) ──────────────────────────────────────

  validationToken(draftId: number, adminId: number): string {
    return this.jwt.sign(
      { type: 'draft-validation', draft: draftId, admin: adminId },
      { secret: this.validationSecret, expiresIn: VALIDATION_TTL },
    );
  }

  private readToken(token: string): { draft: number; admin: number } {
    try {
      const p = this.jwt.verify<{
        type?: string;
        draft?: number;
        admin?: number;
      }>(token, { secret: this.validationSecret });
      if (p.type !== 'draft-validation' || !p.draft || !p.admin)
        throw new Error('bad token');
      return { draft: p.draft, admin: p.admin };
    } catch {
      throw new UnauthorizedException(
        'Ce lien de validation n’est plus valable (il expire après 14 jours). Ouvrez le brouillon depuis la plateforme.',
      );
    }
  }

  private async tokenAdmin(
    adminId: number,
  ): Promise<DraftActor & { email: string }> {
    const a = await this.prisma.user.findFirst({
      where: { id: adminId, deleted: false, valid: true },
      select: { id: true, email: true, nomComplet: true, username: true },
    });
    if (!a)
      throw new UnauthorizedException(
        'Ce lien de validation n’est plus valable (compte administrateur désactivé).',
      );
    return {
      id: a.id,
      nom: a.nomComplet || a.username,
      email: a.email,
      via: 'email',
    };
  }

  /** What the validation page shows before the click on "Publier". */
  async validationInfo(token: string) {
    const t = this.readToken(token);
    const admin = await this.tokenAdmin(t.admin);
    const d = this.get(t.draft);
    return {
      admin: { nom: admin.nom },
      draft: await this.view(d),
      reviewUrl: `${this.appUrl}/dashboard/veille/${d.id}`,
    };
  }

  async publishFromLink(token: string) {
    const t = this.readToken(token);
    const admin = await this.tokenAdmin(t.admin);
    return this.publish(t.draft, {
      id: admin.id,
      nom: admin.nom,
      via: 'email',
    });
  }

  // ─── E-mails to the administrators ──────────────────────────────────

  private async admins() {
    const rows = await this.prisma.user.findMany({
      where: { deleted: false, valid: true },
      select: { id: true, email: true, nomComplet: true, username: true },
    });
    return rows.filter(
      (a) =>
        !this.notifyOnly.length ||
        this.notifyOnly.includes(a.email.trim().toLowerCase()),
    );
  }

  async notifyNewDrafts(
    drafts: Draft[],
    issueLabels: string[],
    ignored: string,
  ) {
    if (!drafts.length) return;
    const n = await this.names();
    const companies = await Promise.all(
      drafts.map((d) => this.companiesFor(d)),
    );
    for (const admin of await this.admins()) {
      const items = drafts.map((d, i) => ({
        titre: d.titre,
        summary: d.description,
        classement:
          [
            d.secteurId && n.secteurs.get(d.secteurId),
            d.themeId && n.themes.get(d.themeId)?.name,
          ]
            .filter(Boolean)
            .join(' › ') || 'Classement à compléter',
        confidence: d.ai.confidence,
        needsReview: d.ai.needsReview,
        companies: companies[i],
        validateUrl: `${this.appUrl}/validation/${this.validationToken(d.id, admin.id)}`,
        reviewUrl: `${this.appUrl}/dashboard/veille/${d.id}`,
      }));
      await this.mailer.send({
        to: [admin.email],
        ...newDraftsEmail({
          name: admin.nomComplet || admin.username,
          issueLabels,
          items,
          ignored,
          listUrl: `${this.appUrl}/dashboard/veille`,
        }),
      });
    }
  }

  async notifyFailure(message: string) {
    for (const admin of await this.admins()) {
      await this.mailer.send({
        to: [admin.email],
        ...collectFailedEmail({
          name: admin.nomComplet || admin.username,
          message,
          statusUrl: `${this.appUrl}/dashboard/veille`,
        }),
      });
    }
  }
}

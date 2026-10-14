import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../accounts/activity.service';
import { addMonths, daysBetween, tunisDay } from '../common/json-file';
import type { AuthUser } from '../common/auth-user';
import {
  CATEGORY_LABELS,
  EcheancesStore,
  type EcheanceItem,
  type EcheanceType,
} from './echeances.store';
import type {
  EcheanceDto,
  EcheancesQuery,
  EcheanceTypeDto,
  MarkDoneDto,
} from './echeances.dto';

export type EcheanceStatus = 'late' | 'soon' | 'ok';
/** « Bientôt » = within this many days */
export const SOON_DAYS = 30;

export function statusOf(dueOn: string, today = tunisDay()) {
  const daysLeft = daysBetween(today, dueOn);
  const status: EcheanceStatus =
    daysLeft < 0 ? 'late' : daysLeft <= SOON_DAYS ? 'soon' : 'ok';
  return { status, daysLeft };
}

export interface LinkedText {
  id: number;
  titre: string;
  num: string | null;
  /** The company's copy of the text (link to « Mes textes »), when it has one */
  tsId: number | null;
}

const clean = (s?: string | null) => (s?.trim() ? s.trim() : null);

/**
 * Recurring obligations of the companies (vehicles, regulatory checks,
 * certificates, approvals, insurance…): the companies keep them up to date,
 * IGTS sees and corrects them, and keeps the catalogue of types with their
 * legal texts and usual frequency.
 */
@Injectable()
export class EcheancesService {
  constructor(
    private store: EcheancesStore,
    private prisma: PrismaService,
    private activity: ActivityService,
  ) {}

  // ─── Reading ───────────────────────────────────────────────────────

  /** Items of one company, or of every company (admin), soonest first. */
  async list(opts: { ownerId?: number; query?: EcheancesQuery }) {
    const q = opts.query ?? {};
    const ownerId = opts.ownerId ?? q.companyId;
    const today = tunisDay();
    const all = this.store.data.items.filter(
      (i) => !i.archived && (!ownerId || i.companyId === ownerId),
    );
    const counts = { late: 0, soon: 0, ok: 0, total: all.length };
    for (const i of all) counts[statusOf(i.dueOn, today).status]++;

    const shown = all
      .filter(
        (i) =>
          (!q.status || statusOf(i.dueOn, today).status === q.status) &&
          (!q.category || i.category === q.category),
      )
      .sort((a, b) => a.dueOn.localeCompare(b.dueOn));

    const items = await this.views(shown, opts.ownerId ?? null);
    const types = this.store.data.types.filter((t) => t.active);
    return {
      items,
      counts,
      types: await this.typeViews(types),
      categories: CATEGORY_LABELS,
    };
  }

  /** Overdue and due-soon counts (sidebar badge, home card). */
  summary(ownerId: number) {
    const today = tunisDay();
    let late = 0;
    let soon = 0;
    const next: {
      id: number;
      label: string;
      dueOn: string;
      daysLeft: number;
    }[] = [];
    for (const i of this.store.data.items) {
      if (i.archived || i.companyId !== ownerId) continue;
      const s = statusOf(i.dueOn, today);
      if (s.status === 'late') late++;
      if (s.status === 'soon') soon++;
      if (s.status !== 'ok')
        next.push({
          id: i.id,
          label: this.title(i),
          dueOn: i.dueOn,
          daysLeft: s.daysLeft,
        });
    }
    next.sort((a, b) => a.dueOn.localeCompare(b.dueOn));
    return { late, soon, next: next.slice(0, 4) };
  }

  /** Every client with items, worst first (admin overview). */
  async byCompany() {
    const today = tunisDay();
    const by = new Map<number, { late: number; soon: number; total: number }>();
    for (const i of this.store.data.items) {
      if (i.archived) continue;
      const c = by.get(i.companyId) ?? { late: 0, soon: 0, total: 0 };
      c.total++;
      const s = statusOf(i.dueOn, today).status;
      if (s === 'late') c.late++;
      if (s === 'soon') c.soon++;
      by.set(i.companyId, c);
    }
    const names = await this.companyNames([...by.keys()]);
    return [...by.entries()]
      .map(([id, c]) => ({ id, name: names.get(id) ?? `#${id}`, ...c }))
      .sort((a, b) => b.late - a.late || b.soon - a.soon);
  }

  history(id: number, ownerId?: number) {
    return this.item(id, ownerId).history;
  }

  // ─── Changes ───────────────────────────────────────────────────────

  async create(ownerId: number, dto: EcheanceDto, by: AuthUser) {
    await this.assertCompany(ownerId);
    const fields = await this.fields(dto);
    const now = new Date().toISOString();
    const item: EcheanceItem = {
      id: this.store.nextItemId(),
      companyId: ownerId,
      ...fields,
      archived: false,
      createdAt: now,
      createdBy: this.who(by),
      updatedAt: now,
      history: [],
    };
    this.store.data.items.push(item);
    await this.store.save();
    this.log(by, ownerId, `a ajouté l’échéance « ${this.title(item)} »`);
    return (
      await this.views([item], by.type === 'company' ? ownerId : null)
    )[0];
  }

  async update(id: number, dto: EcheanceDto, by: AuthUser, ownerId?: number) {
    const item = this.item(id, ownerId);
    Object.assign(item, await this.fields(dto), {
      updatedAt: new Date().toISOString(),
    });
    await this.store.save();
    return (await this.views([item], ownerId ?? null))[0];
  }

  /** Done (renewed, checked…): the next due date follows. */
  async markDone(id: number, dto: MarkDoneDto, by: AuthUser, ownerId?: number) {
    const item = this.item(id, ownerId);
    const nextDue =
      dto.nextDue ??
      (item.everyMonths ? addMonths(dto.doneOn, item.everyMonths) : null);
    if (!nextDue)
      throw new BadRequestException(
        'Indiquez la prochaine échéance (aucune périodicité n’est définie).',
      );
    if (nextDue <= dto.doneOn)
      throw new BadRequestException(
        'La prochaine échéance doit suivre la date de réalisation.',
      );
    item.history.unshift({
      doneOn: dto.doneOn,
      nextDue,
      by: this.who(by),
      at: new Date().toISOString(),
      note: clean(dto.note),
    });
    item.lastDone = dto.doneOn;
    item.dueOn = nextDue;
    item.updatedAt = new Date().toISOString();
    await this.store.save();
    this.log(by, item.companyId, `a renouvelé « ${this.title(item)} »`);
    return (await this.views([item], ownerId ?? null))[0];
  }

  /** Kept for the record (sold vehicle, closed site…), no more reminders. */
  async archive(id: number, by: AuthUser, ownerId?: number) {
    const item = this.item(id, ownerId);
    item.archived = true;
    item.updatedAt = new Date().toISOString();
    await this.store.save();
    this.log(by, item.companyId, `a retiré l’échéance « ${this.title(item)} »`);
    return { ok: true };
  }

  // ─── Catalogue (IGTS) ──────────────────────────────────────────────

  async types() {
    return this.typeViews(this.store.data.types);
  }

  async createType(dto: EcheanceTypeDto) {
    const type: EcheanceType = {
      id: this.store.nextTypeId(),
      ...(await this.typeFields(dto)),
      toConfirm: false,
      active: dto.active ?? true,
    };
    this.store.data.types.push(type);
    await this.store.save();
    return (await this.typeViews([type]))[0];
  }

  async updateType(id: number, dto: EcheanceTypeDto) {
    const type = this.store.data.types.find((t) => t.id === id);
    if (!type) throw new NotFoundException('Type introuvable');
    Object.assign(type, await this.typeFields(dto), {
      toConfirm: false,
      active: dto.active ?? type.active,
    });
    await this.store.save();
    return (await this.typeViews([type]))[0];
  }

  // ─── Legal texts ───────────────────────────────────────────────────

  /** Texts to attach: the company's own watch list, or every text for IGTS. */
  async searchTexts(search: string | undefined, ownerId?: number) {
    const s = search?.trim();
    const match = s
      ? { OR: [{ titre: { contains: s } }, { num: { contains: s } }] }
      : {};
    if (ownerId) {
      const rows = await this.prisma.texteSociete.findMany({
        where: {
          companyId: ownerId,
          OR: [{ deleted: false }, { deleted: null }],
          texte: { deleted: false, ...match },
        },
        orderBy: { id: 'desc' },
        take: 15,
        select: {
          id: true,
          texte: { select: { id: true, titre: true, num: true } },
        },
      });
      return rows
        .filter((r) => r.texte)
        .map((r) => ({
          id: r.texte!.id,
          titre: r.texte!.titre,
          num: r.texte!.num,
          tsId: r.id,
        }));
    }
    const rows = await this.prisma.texte.findMany({
      where: { deleted: false, ...match },
      orderBy: { id: 'desc' },
      take: 15,
      select: { id: true, titre: true, num: true },
    });
    return rows.map((r) => ({ ...r, tsId: null }));
  }

  // ─── Internals ─────────────────────────────────────────────────────

  title(i: EcheanceItem): string {
    const type = i.typeId
      ? this.store.data.types.find((t) => t.id === i.typeId)
      : null;
    return type && !i.label.toLowerCase().includes(type.label.toLowerCase())
      ? `${type.label} — ${i.label}`
      : i.label;
  }

  private item(id: number, ownerId?: number): EcheanceItem {
    const item = this.store.data.items.find(
      (i) =>
        i.id === id && !i.archived && (!ownerId || i.companyId === ownerId),
    );
    if (!item) throw new NotFoundException('Échéance introuvable');
    return item;
  }

  private async fields(dto: EcheanceDto) {
    const type = dto.typeId
      ? this.store.data.types.find((t) => t.id === dto.typeId)
      : null;
    if (dto.typeId && !type) throw new BadRequestException('Type inconnu');
    const everyMonths = dto.everyMonths ?? null;
    const lastDone = dto.lastDone ?? null;
    const dueOn =
      dto.dueOn ??
      (lastDone && everyMonths ? addMonths(lastDone, everyMonths) : null);
    if (!dueOn)
      throw new BadRequestException(
        'Indiquez la date d’échéance, ou la dernière date et la périodicité.',
      );
    const name = clean(dto.responsibleName);
    const email = clean(dto.responsibleEmail)?.toLowerCase() ?? null;
    return {
      typeId: type?.id ?? null,
      category: dto.category,
      label: dto.label.trim(),
      reference: clean(dto.reference),
      everyMonths,
      lastDone,
      dueOn,
      responsible: name || email ? { name: name ?? email!, email } : null,
      textIds: await this.validTextIds(dto.textIds),
      notes: clean(dto.notes),
    };
  }

  private async typeFields(dto: EcheanceTypeDto) {
    return {
      category: dto.category,
      label: dto.label.trim(),
      everyMonths: dto.everyMonths ?? null,
      textIds: await this.validTextIds(dto.textIds),
      notes: clean(dto.notes),
    };
  }

  private async validTextIds(ids?: number[]): Promise<number[]> {
    const unique = [...new Set(ids ?? [])];
    if (!unique.length) return [];
    const found = await this.prisma.texte.findMany({
      where: { id: { in: unique }, deleted: false },
      select: { id: true },
    });
    const ok = new Set(found.map((t) => t.id));
    return unique.filter((id) => ok.has(id));
  }

  private async texts(ids: number[], ownerId: number | null) {
    const unique = [...new Set(ids)];
    if (!unique.length) return new Map<number, LinkedText>();
    const [rows, copies] = await Promise.all([
      this.prisma.texte.findMany({
        where: { id: { in: unique } },
        select: { id: true, titre: true, num: true },
      }),
      ownerId
        ? this.prisma.texteSociete.findMany({
            where: {
              companyId: ownerId,
              texteId: { in: unique },
              OR: [{ deleted: false }, { deleted: null }],
            },
            select: { id: true, texteId: true },
          })
        : Promise.resolve([] as { id: number; texteId: number | null }[]),
    ]);
    const tsBy = new Map(copies.map((c) => [c.texteId, c.id]));
    return new Map(
      rows.map((r) => [r.id, { ...r, tsId: tsBy.get(r.id) ?? null }]),
    );
  }

  private async views(items: EcheanceItem[], ownerId: number | null) {
    const today = tunisDay();
    const texts = await this.texts(
      items.flatMap((i) => i.textIds),
      ownerId,
    );
    const names = ownerId
      ? new Map<number, string>()
      : await this.companyNames([...new Set(items.map((i) => i.companyId))]);
    const typeBy = new Map(this.store.data.types.map((t) => [t.id, t]));
    return items.map((i) => {
      const type = i.typeId ? typeBy.get(i.typeId) : undefined;
      return {
        ...i,
        ...statusOf(i.dueOn, today),
        title: this.title(i),
        type: type ? { id: type.id, label: type.label } : null,
        texts: i.textIds
          .map((id) => texts.get(id))
          .filter((t): t is LinkedText => Boolean(t)),
        company: ownerId ? null : (names.get(i.companyId) ?? null),
        history: i.history.slice(0, 10),
      };
    });
  }

  private async typeViews(types: EcheanceType[]) {
    const texts = await this.texts(
      types.flatMap((t) => t.textIds),
      null,
    );
    const used = new Map<number, number>();
    for (const i of this.store.data.items)
      if (!i.archived && i.typeId)
        used.set(i.typeId, (used.get(i.typeId) ?? 0) + 1);
    return types.map((t) => ({
      ...t,
      texts: t.textIds
        .map((id) => texts.get(id))
        .filter((x): x is LinkedText => Boolean(x)),
      used: used.get(t.id) ?? 0,
    }));
  }

  private async companyNames(ids: number[]) {
    if (!ids.length) return new Map<number, string>();
    const rows = await this.prisma.company.findMany({
      where: { id: { in: ids } },
      select: { id: true, nom: true, raisonsociale: true },
    });
    return new Map(rows.map((c) => [c.id, c.raisonsociale || c.nom]));
  }

  private async assertCompany(ownerId: number) {
    const c = await this.prisma.company.findFirst({
      where: { id: ownerId, deleted: false, multicompte: 0 },
      select: { id: true },
    });
    if (!c) throw new NotFoundException('Entreprise introuvable');
  }

  private who(by: AuthUser) {
    return by.type === 'admin' ? `${by.nom} (IGTS)` : by.nom;
  }

  private log(by: AuthUser, companyId: number, what: string) {
    this.activity.log({
      type: 'echeance',
      actor: { kind: by.type, id: by.id, nom: by.nom },
      companyId,
      label: `${this.who(by)} ${what}`,
    });
  }
}

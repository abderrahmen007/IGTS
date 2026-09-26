import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NameDto, ThemeDto } from './admin.dto';

/** Secteurs, thèmes and types de texte (legacy SecteursController, ThemeController, TypeController). */
@Injectable()
export class ReferenceService {
  constructor(private prisma: PrismaService) {}

  async all() {
    const [secteurs, types, textsBySecteur, textsByTheme, textsByType, companiesByTheme] = await Promise.all([
      this.prisma.secteur.findMany({
        orderBy: { name: 'asc' },
        include: { themes: { orderBy: { name: 'asc' } } },
      }),
      this.prisma.type.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.texte.groupBy({ by: ['secteurId'], where: { deleted: false }, _count: { _all: true } }),
      this.prisma.texte.groupBy({ by: ['themeId'], where: { deleted: false }, _count: { _all: true } }),
      this.prisma.texte.groupBy({ by: ['typeId'], where: { deleted: false }, _count: { _all: true } }),
      this.prisma.companyTheme.groupBy({
        by: ['themeId'],
        where: { company: { deleted: false } },
        _count: { _all: true },
      }),
    ]);
    const m = <K>(rows: { _count: { _all: number } }[], key: (r: any) => K) =>
      new Map(rows.map((r) => [key(r), r._count._all]));
    const bySecteur = m(textsBySecteur, (r) => r.secteurId);
    const byTheme = m(textsByTheme, (r) => r.themeId);
    const byType = m(textsByType, (r) => r.typeId);
    const compByTheme = m(companiesByTheme, (r) => r.themeId);

    return {
      secteurs: secteurs.map((s) => ({
        id: s.id,
        name: s.name,
        texts: bySecteur.get(s.id) ?? 0,
        themes: s.themes.map((t) => ({
          id: t.id,
          name: t.name,
          secteurId: t.secteurId,
          texts: byTheme.get(t.id) ?? 0,
          companies: compByTheme.get(t.id) ?? 0,
        })),
      })),
      types: types.map((t) => ({ id: t.id, name: t.name, texts: byType.get(t.id) ?? 0 })),
    };
  }

  // Secteurs
  createSecteur(dto: NameDto) {
    return this.prisma.secteur.create({ data: { name: dto.name.trim() } });
  }
  async updateSecteur(id: number, dto: NameDto) {
    await this.ensure(this.prisma.secteur.findUnique({ where: { id } }), 'Secteur');
    return this.prisma.secteur.update({ where: { id }, data: { name: dto.name.trim() } });
  }
  async deleteSecteur(id: number) {
    await this.ensure(this.prisma.secteur.findUnique({ where: { id } }), 'Secteur');
    const [themes, texts, companies] = await Promise.all([
      this.prisma.theme.count({ where: { secteurId: id } }),
      this.prisma.texte.count({ where: { secteurId: id, deleted: false } }),
      this.prisma.companySecteurTheme.count({ where: { secteurId: id } }),
    ]);
    if (themes || texts || companies) {
      throw new ConflictException(
        `Impossible de supprimer ce secteur : il contient ${themes} thème(s), ${texts} texte(s) et ${companies} entreprise(s) abonnée(s).`,
      );
    }
    await this.prisma.secteur.delete({ where: { id } });
    return { ok: true };
  }

  // Thèmes
  async createTheme(dto: ThemeDto) {
    await this.ensure(this.prisma.secteur.findUnique({ where: { id: dto.secteurId } }), 'Secteur');
    return this.prisma.theme.create({ data: { name: dto.name.trim(), secteurId: dto.secteurId } });
  }
  async updateTheme(id: number, dto: ThemeDto) {
    const theme = await this.ensure(this.prisma.theme.findUnique({ where: { id } }), 'Thème');
    if (theme.secteurId !== dto.secteurId) {
      const used = await this.prisma.texte.count({ where: { themeId: id } });
      if (used) throw new ConflictException('Ce thème a déjà des textes : il ne peut pas changer de secteur.');
    }
    return this.prisma.theme.update({ where: { id }, data: { name: dto.name.trim(), secteurId: dto.secteurId } });
  }
  async deleteTheme(id: number) {
    await this.ensure(this.prisma.theme.findUnique({ where: { id } }), 'Thème');
    const [texts, companies] = await Promise.all([
      this.prisma.texte.count({ where: { themeId: id, deleted: false } }),
      this.prisma.companyTheme.count({ where: { themeId: id } }),
    ]);
    if (texts || companies) {
      throw new ConflictException(
        `Impossible de supprimer ce thème : ${texts} texte(s) et ${companies} entreprise(s) y sont rattachés.`,
      );
    }
    await this.prisma.theme.delete({ where: { id } });
    return { ok: true };
  }

  // Types
  createType(dto: NameDto) {
    return this.prisma.type.create({ data: { name: dto.name.trim() } });
  }
  async updateType(id: number, dto: NameDto) {
    await this.ensure(this.prisma.type.findUnique({ where: { id } }), 'Type');
    return this.prisma.type.update({ where: { id }, data: { name: dto.name.trim() } });
  }
  async deleteType(id: number) {
    await this.ensure(this.prisma.type.findUnique({ where: { id } }), 'Type');
    const texts = await this.prisma.texte.count({ where: { typeId: id, deleted: false } });
    if (texts) throw new ConflictException(`Impossible de supprimer ce type : ${texts} texte(s) l’utilisent.`);
    await this.prisma.type.delete({ where: { id } });
    return { ok: true };
  }

  private async ensure<T>(p: Promise<T | null>, label: string): Promise<T> {
    const v = await p;
    if (!v) throw new NotFoundException(`${label} introuvable`);
    return v;
  }
}

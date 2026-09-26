import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AdminUserDto, CreateAdminUserDto } from './admin.dto';

/** IGTS back-office accounts (legacy UserController, table `user`). */
@Injectable()
export class AdminUsersService {
  constructor(private prisma: PrismaService) {}

  async list() {
    const users = await this.prisma.user.findMany({
      where: { deleted: false },
      orderBy: { id: 'asc' },
      select: { id: true, nomComplet: true, username: true, email: true, valid: true, roles: true, password: true },
    });
    return users.map(({ password, ...u }) => ({
      ...u,
      active: u.valid,
      // Accounts still on a legacy bcrypt hash cannot log in until reset
      needsPasswordReset: !password.startsWith('$argon2'),
    }));
  }

  private async assertEmailFree(email: string, exceptId?: number) {
    const other = await this.prisma.user.findFirst({
      where: { email: email.trim().toLowerCase(), ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    });
    if (other) throw new ConflictException('Cette adresse e-mail est déjà utilisée');
  }

  async create(dto: CreateAdminUserDto) {
    await this.assertEmailFree(dto.email);
    const email = dto.email.trim().toLowerCase();
    await this.prisma.user.create({
      data: {
        email,
        username: email.split('@')[0],
        nomComplet: dto.nomComplet.trim(),
        roles: JSON.stringify(['ROLE_SUPERUSER']),
        valid: true,
        deleted: false,
        admin: true,
        password: await argon2.hash(dto.password, { type: argon2.argon2id }),
      },
    });
    return this.list();
  }

  private async get(id: number) {
    const u = await this.prisma.user.findFirst({ where: { id, deleted: false } });
    if (!u) throw new NotFoundException('Administrateur introuvable');
    return u;
  }

  async update(id: number, dto: AdminUserDto) {
    await this.get(id);
    await this.assertEmailFree(dto.email, id);
    await this.prisma.user.update({
      where: { id },
      data: { email: dto.email.trim().toLowerCase(), nomComplet: dto.nomComplet.trim() },
    });
    return this.list();
  }

  async setPassword(id: number, password: string) {
    if (password.length < 12) throw new BadRequestException('12 caractères minimum');
    await this.get(id);
    await this.prisma.user.update({
      where: { id },
      data: { password: await argon2.hash(password, { type: argon2.argon2id }) },
    });
    return this.list();
  }

  async setActive(currentUserId: number, id: number, active: boolean) {
    if (id === currentUserId && !active) throw new BadRequestException('Vous ne pouvez pas désactiver votre propre compte');
    await this.get(id);
    await this.prisma.user.update({ where: { id }, data: { valid: active } });
    return this.list();
  }

  async remove(currentUserId: number, id: number) {
    if (id === currentUserId) throw new BadRequestException('Vous ne pouvez pas supprimer votre propre compte');
    await this.get(id);
    await this.prisma.user.update({ where: { id }, data: { deleted: true } });
    return this.list();
  }
}

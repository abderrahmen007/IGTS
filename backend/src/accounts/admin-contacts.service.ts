import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export interface AdminContact {
  id: number;
  email: string;
  nom: string;
}

/** IGTS administrators who receive the platform's alerts (accounts, subscriptions, surveys). */
@Injectable()
export class AdminContactsService {
  private readonly only: string[];

  constructor(
    private prisma: PrismaService,
    config: ConfigService,
  ) {
    this.only = (
      config.get<string>('ADMIN_NOTIFY_TO') ??
      config.get<string>('VEILLE_NOTIFY_TO') ??
      ''
    )
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }

  async list(): Promise<AdminContact[]> {
    const rows = await this.prisma.user.findMany({
      where: { deleted: false, valid: true },
      select: { id: true, email: true, nomComplet: true, username: true },
    });
    return rows
      .filter(
        (a) =>
          !this.only.length || this.only.includes(a.email.trim().toLowerCase()),
      )
      .map((a) => ({
        id: a.id,
        email: a.email,
        nom: a.nomComplet || a.username,
      }));
  }
}

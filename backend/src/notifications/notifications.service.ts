import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface NewTextNotification {
  companyId: number;
  texteId: number;
  texteSocieteId: number;
  secteurId: number | null;
  themeId: number | null;
  message: string;
}

/**
 * Single entry point for creating client notifications, so that real-time
 * push and e-mail delivery can be plugged in here later without touching the
 * business services.
 */
@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async notifyTexts(items: NewTextNotification[]) {
    if (!items.length) return 0;
    const now = new Date();
    const { count } = await this.prisma.notification.createMany({
      data: items.map((n) => ({
        companyId: n.companyId,
        texteId: n.texteId,
        texteSocieteId: n.texteSocieteId,
        secteurId: n.secteurId,
        themeId: n.themeId,
        message: n.message,
        isRead: false,
        etat: 'nonlu',
        createdAt: now,
      })),
    });
    return count;
  }
}

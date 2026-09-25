import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getCompanyDashboard(companyId: number) {
    // 1. Get total legal texts assigned to this company
    const totalAssignedTexts = await this.prisma.texteSociete.count({
      where: { companyId },
    });

    // 2. Get compliance stats (this depends on how the old app tracked compliance, usually inside texte_societe or a related table)
    // For now, let's fetch the recent assigned texts
    const recentTexts = await this.prisma.texteSociete.findMany({
      where: { companyId },
      include: {
        texte: {
          select: { id: true, name: true, ntext: true, datetext: true },
        },
      },
      orderBy: { id: 'desc' },
      take: 5,
    });

    // 3. Get any recent actions/history
    const recentActions = await this.prisma.historiqueaction.findMany({
      where: { companyId },
      orderBy: { dateaction: 'desc' },
      take: 5,
    });

    return {
      stats: {
        totalTexts: totalAssignedTexts,
        compliantTexts: Math.floor(totalAssignedTexts * 0.8), // Placeholder logic
        pendingActions: 3, // Placeholder logic
        lastUpdate: new Date(),
      },
      recentTexts: recentTexts.map(rt => rt.texte),
      recentActions,
    };
  }

  async getCompanyTexts(companyId: number) {
    const texts = await this.prisma.texteSociete.findMany({
      where: { companyId },
      include: {
        texte: true,
      },
      orderBy: { id: 'desc' },
    });
    return texts.map(t => ({
      ...t.texte,
      applicabilityStatus: 'Applicable', // Placeholder based on old logic
    }));
  }

  async getAdminDashboard() {
    const totalCompanies = await this.prisma.company.count({
      where: { deleted: false },
    });

    const totalTexts = await this.prisma.texte.count();

    const recentCompanies = await this.prisma.company.findMany({
      where: { deleted: false },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, nom: true, email: true, createdAt: true },
    });

    return {
      stats: {
        totalCompanies,
        totalTexts,
        activeScrapers: 1, // Future integration
      },
      recentCompanies,
    };
  }
}

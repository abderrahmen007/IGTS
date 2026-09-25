import { Controller, Get, Request, UseGuards, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DashboardService } from './dashboard.service';

@UseGuards(AuthGuard('jwt'))
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('company')
  async getCompanyDashboard(@Request() req) {
    if (req.user.type !== 'company') {
      throw new ForbiddenException('Access restricted to company users');
    }
    return this.dashboardService.getCompanyDashboard(req.user.id);
  }

  @Get('company/texts')
  async getCompanyTexts(@Request() req) {
    if (req.user.type !== 'company') {
      throw new ForbiddenException('Access restricted to company users');
    }
    return this.dashboardService.getCompanyTexts(req.user.id);
  }

  @Get('admin')
  async getAdminDashboard(@Request() req) {
    if (req.user.type !== 'admin') {
      throw new ForbiddenException('Access restricted to admin users');
    }
    return this.dashboardService.getAdminDashboard();
  }
}

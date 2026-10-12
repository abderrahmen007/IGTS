import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminOnlyGuard } from '../common/auth-user';
import { AdminListQuery, AdminService } from './admin.service';
import { AdminStatsService } from './stats.service';

/** IGTS back-office endpoints. */
@ApiTags('Administration IGTS (Vue globale)')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'), AdminOnlyGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly service: AdminService,
    private readonly statsService: AdminStatsService,
  ) {}

  @Get('overview')
  overview() {
    return this.service.overview();
  }

  /** GET /api/admin/stats — clients, subscriptions, activity, compliance, texts, survey, live feed. */
  @Get('stats')
  stats() {
    return this.statsService.stats();
  }

  @Get('companies')
  companies(@Query() q: AdminListQuery) {
    return this.service.companies(q);
  }

  @Get('texts')
  texts(@Query() q: AdminListQuery) {
    return this.service.texts(q);
  }
}

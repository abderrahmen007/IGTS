import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminOnlyGuard } from '../common/auth-user';
import { AdminListQuery, AdminService } from './admin.service';

/** IGTS back-office endpoints. */
@UseGuards(AuthGuard('jwt'), AdminOnlyGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('overview')
  overview() {
    return this.service.overview();
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

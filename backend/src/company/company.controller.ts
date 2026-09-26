import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CompanyOnlyGuard, CurrentUser } from '../common/auth-user';
import type { AuthUser } from '../common/auth-user';
import { CompanyService } from './company.service';
import {
  CreateActionDto,
  EvaluateTextDto,
  ListActionsQuery,
  ListTextsQuery,
  UpdateActionDto,
} from './company.dto';

/** Endpoints of the client company space. All scoped to the caller's company. */
@UseGuards(AuthGuard('jwt'), CompanyOnlyGuard)
@Controller('company')
export class CompanyController {
  constructor(private readonly service: CompanyService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthUser) {
    return this.service.overview(user);
  }

  @Get('filters')
  filters(@CurrentUser() user: AuthUser) {
    return this.service.filters(user);
  }

  @Get('texts')
  listTexts(@CurrentUser() user: AuthUser, @Query() q: ListTextsQuery) {
    return this.service.listTexts(user, q);
  }

  @Get('texts/:id')
  textDetail(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.textDetail(user, id);
  }

  @Patch('texts/:id/evaluation')
  evaluate(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EvaluateTextDto,
  ) {
    return this.service.evaluate(user, id, dto);
  }

  @Post('texts/:id/actions')
  createAction(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateActionDto,
  ) {
    return this.service.createAction(user, id, dto);
  }

  @Get('actions')
  listActions(@CurrentUser() user: AuthUser, @Query() q: ListActionsQuery) {
    return this.service.listActions(user, q);
  }

  @Patch('actions/:id')
  updateAction(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateActionDto,
  ) {
    return this.service.updateAction(user, id, dto);
  }

  @Get('notifications')
  notifications(@CurrentUser() user: AuthUser) {
    return this.service.notifications(user);
  }

  @Post('notifications/read')
  markRead(@CurrentUser() user: AuthUser) {
    return this.service.markNotificationsRead(user);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  AdminOnlyGuard,
  CompanyOnlyGuard,
  CurrentUser,
  EditorGuard,
} from '../common/auth-user';
import type { AuthUser } from '../common/auth-user';
import {
  EcheanceDto,
  EcheancesQuery,
  EcheanceTypeDto,
  MarkDoneDto,
  TextSearchQuery,
} from './echeances.dto';
import { EcheancesService } from './echeances.service';
import { RemindersService } from './reminders.service';

/** The company's regular checks and renewals. */
@ApiTags('Entreprise — Échéances')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'), CompanyOnlyGuard)
@Controller('company/echeances')
export class CompanyEcheancesController {
  constructor(private echeances: EcheancesService) {}

  @Get()
  list(@CurrentUser() me: AuthUser, @Query() q: EcheancesQuery) {
    return this.echeances.list({
      ownerId: me.ownerId!,
      query: { status: q.status, category: q.category },
    });
  }

  @Get('summary')
  summary(@CurrentUser() me: AuthUser) {
    return this.echeances.summary(me.ownerId!);
  }

  @Get('texts')
  texts(@CurrentUser() me: AuthUser, @Query() q: TextSearchQuery) {
    return this.echeances.searchTexts(q.search, me.ownerId!);
  }

  @UseGuards(EditorGuard)
  @Post()
  create(@CurrentUser() me: AuthUser, @Body() dto: EcheanceDto) {
    return this.echeances.create(me.ownerId!, dto, me);
  }

  @UseGuards(EditorGuard)
  @Put(':id')
  update(
    @CurrentUser() me: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EcheanceDto,
  ) {
    return this.echeances.update(id, dto, me, me.ownerId!);
  }

  @UseGuards(EditorGuard)
  @Post(':id/done')
  @HttpCode(200)
  done(
    @CurrentUser() me: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MarkDoneDto,
  ) {
    return this.echeances.markDone(id, dto, me, me.ownerId!);
  }

  @UseGuards(EditorGuard)
  @Delete(':id')
  archive(@CurrentUser() me: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.echeances.archive(id, me, me.ownerId!);
  }
}

/** Every client's deadlines, the catalogue of types and the reminders. */
@ApiTags('Administration IGTS — Échéances')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'), AdminOnlyGuard)
@Controller('admin/echeances')
export class AdminEcheancesController {
  constructor(
    private echeances: EcheancesService,
    private reminders: RemindersService,
  ) {}

  @Get()
  list(@Query() q: EcheancesQuery) {
    return this.echeances.list({ query: q });
  }

  @Get('companies')
  companies() {
    return this.echeances.byCompany();
  }

  @Get('texts')
  texts(@Query() q: TextSearchQuery) {
    return this.echeances.searchTexts(q.search);
  }

  @Post('companies/:companyId')
  create(
    @CurrentUser() me: AuthUser,
    @Param('companyId', ParseIntPipe) companyId: number,
    @Body() dto: EcheanceDto,
  ) {
    return this.echeances.create(companyId, dto, me);
  }

  @Put(':id')
  update(
    @CurrentUser() me: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EcheanceDto,
  ) {
    return this.echeances.update(id, dto, me);
  }

  @Post(':id/done')
  @HttpCode(200)
  done(
    @CurrentUser() me: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MarkDoneDto,
  ) {
    return this.echeances.markDone(id, dto, me);
  }

  @Delete(':id')
  archive(@CurrentUser() me: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.echeances.archive(id, me);
  }

  // ─── Catalogue ───

  @Get('types/all')
  types() {
    return this.echeances.types();
  }

  @Post('types')
  createType(@Body() dto: EcheanceTypeDto) {
    return this.echeances.createType(dto);
  }

  @Put('types/:id')
  updateType(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EcheanceTypeDto,
  ) {
    return this.echeances.updateType(id, dto);
  }

  /** Sends today's reminders now (checks the e-mails without waiting for 7:45). */
  @Post('reminders/run')
  @HttpCode(200)
  run() {
    return this.reminders.run();
  }
}

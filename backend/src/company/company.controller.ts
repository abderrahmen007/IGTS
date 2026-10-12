import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CompanyOnlyGuard, CurrentUser, EditorGuard, MainAccountGuard } from '../common/auth-user';
import type { AuthUser } from '../common/auth-user';
import { MAX_PROOF_SIZE, MAX_PROOFS_PER_UPLOAD } from '../files/files.service';
import type { UploadedFile } from '../files/files.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CompanyService } from './company.service';
import { TeamService } from './team.service';
import {
  CreateActionDto,
  CreateTeamMemberDto,
  EvaluateTextDto,
  ListActionsQuery,
  ListTextsQuery,
  PreferencesDto,
  UpdateActionDto,
  UpdateProfileDto,
  UpdateTeamMemberDto,
} from './company.dto';

const proofUpload = FilesInterceptor('files', MAX_PROOFS_PER_UPLOAD, { limits: { fileSize: MAX_PROOF_SIZE } });

/**
 * Endpoints of the client company space, all scoped to the caller's company.
 * Endpoints that change evaluations or actions also require edit rights
 * (read-only sub-accounts are refused, as in the legacy app).
 */
@ApiTags('Espace Entreprise')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'), CompanyOnlyGuard)
@Controller('company')
export class CompanyController {
  constructor(
    private readonly service: CompanyService,
    private readonly teamService: TeamService,
  ) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthUser) {
    return this.service.overview(user);
  }

  @Get('counters')
  counters(@CurrentUser() user: AuthUser) {
    return this.service.counters(user);
  }

  @Get('filters')
  filters(@CurrentUser() user: AuthUser) {
    return this.service.filters(user);
  }

  // ─── Texts & evaluation ────────────────────────────────────────────

  @Get('texts')
  listTexts(@CurrentUser() user: AuthUser, @Query() q: ListTextsQuery) {
    return this.service.listTexts(user, q);
  }

  @Get('texts/:id')
  textDetail(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.textDetail(user, id);
  }

  @ApiOperation({ summary: "Analyser l'impact et l'applicabilité d'un texte pour l'entreprise (IA Gemini)" })
  @Get('texts/:id/ai-impact')
  aiImpact(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.analyzeImpact(user, id);
  }

  @ApiOperation({ summary: "Suggérer un plan d'action de mise en conformité avec l'IA" })
  @Get('texts/:id/ai-actions')
  aiActions(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.suggestActions(user, id);
  }

  @UseGuards(EditorGuard)
  @Patch('texts/:id/evaluation')
  evaluate(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EvaluateTextDto,
  ) {
    return this.service.evaluate(user, id, dto);
  }

  // ─── Actions ───────────────────────────────────────────────────────

  @UseGuards(EditorGuard)
  @Post('texts/:id/actions')
  createAction(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateActionDto,
  ) {
    return this.service.createAction(user, id, dto);
  }

  /** Figures of the « Statistiques » tab of the action plan. */
  @Get('actions/stats')
  actionStats(@CurrentUser() user: AuthUser) {
    return this.service.actionStats(user);
  }

  @Get('actions')
  listActions(@CurrentUser() user: AuthUser, @Query() q: ListActionsQuery) {
    return this.service.listActions(user, q);
  }

  @UseGuards(EditorGuard)
  @Patch('actions/:id')
  updateAction(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateActionDto,
  ) {
    return this.service.updateAction(user, id, dto);
  }

  @UseGuards(EditorGuard)
  @Delete('actions/:id')
  deleteAction(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.deleteAction(user, id);
  }

  @UseGuards(EditorGuard)
  @Post('actions/:id/files')
  @UseInterceptors(proofUpload)
  addFiles(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: UploadedFile[],
  ) {
    return this.service.addActionFiles(user, id, files);
  }

  @UseGuards(EditorGuard)
  @Delete('actions/:id/files/:name')
  removeFile(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('name') name: string,
  ) {
    return this.service.removeActionFile(user, id, name);
  }

  // ─── Profile & team ────────────────────────────────────────────────

  @Get('me')
  profile(@CurrentUser() user: AuthUser) {
    return this.service.profile(user);
  }

  @Patch('me')
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.service.updateProfile(user, dto);
  }

  /** Kept for older clients: always refused, IGTS manages every password. */
  @Post('me/password')
  @HttpCode(200)
  changePassword() {
    return this.service.changePassword();
  }

  @Patch('me/preferences')
  preferences(@CurrentUser() user: AuthUser, @Body() dto: PreferencesDto) {
    return this.service.updatePreferences(user, dto);
  }

  @Get('team')
  team(@CurrentUser() user: AuthUser) {
    return this.service.team(user);
  }

  /** The main account creates an account for an employee and sets its rights. */
  @UseGuards(MainAccountGuard)
  @Post('team')
  createMember(@CurrentUser() user: AuthUser, @Body() dto: CreateTeamMemberDto) {
    return this.teamService.create(user, dto);
  }

  @UseGuards(MainAccountGuard)
  @Patch('team/:id')
  updateMember(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTeamMemberDto,
  ) {
    return this.teamService.update(user, id, dto);
  }

  // ─── Notifications ─────────────────────────────────────────────────

  @Get('notifications')
  notifications(@CurrentUser() user: AuthUser) {
    return this.service.notifications(user);
  }

  @Post('notifications/read')
  markRead(@CurrentUser() user: AuthUser, @Body() body?: { id?: number }) {
    return this.service.markNotificationsRead(user, body?.id);
  }

  @Post('notifications/:id/read')
  markOneRead(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.service.markNotificationsRead(user, id);
  }
}

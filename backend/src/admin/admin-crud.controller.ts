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
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminOnlyGuard, CurrentUser } from '../common/auth-user';
import type { AuthUser } from '../common/auth-user';
import { MAX_PDF_SIZE } from '../files/files.service';
import type { UploadedPdf } from '../files/files.service';
import { ListTextsQuery } from '../company/company.dto';
import { AdminCompaniesService } from './companies.service';
import { AdminTextsService } from './texts.service';
import { ReferenceService } from './reference.service';
import { AdminUsersService } from './users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailerService } from '../notifications/mailer.service';
import { SubscriptionsService } from '../accounts/subscriptions.service';
import { AccountRequestsService } from '../accounts/account-requests.service';
import { PrismaService } from '../prisma/prisma.service';
import { newTextsEmail } from '../notifications/email-templates';
import {
  AssignTextsDto,
  CompanyIdsDto,
  CompanyInfoDto,
  CreateAdminUserDto,
  CreateCompanyDto,
  CreateSubAccountDto,
  AdminUserDto,
  NameDto,
  PasswordDto,
  StatusDto,
  SubAccountDto,
  SubscriptionDatesDto,
  SubscriptionsDto,
  SuspendDto,
  TextDto,
  ThemeDto,
} from './admin.dto';

import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

const pdfUpload = FileInterceptor('pdf', { limits: { fileSize: MAX_PDF_SIZE } });

@ApiTags('Administration IGTS (CRUD)')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'), AdminOnlyGuard)
@Controller('admin')
export class AdminCrudController {
  constructor(
    private companies: AdminCompaniesService,
    private texts: AdminTextsService,
    private reference: ReferenceService,
    private users: AdminUsersService,
    private notifications: NotificationsService,
    private mailer: MailerService,
    private subs: SubscriptionsService,
    private accountRequests: AccountRequestsService,
    private prisma: PrismaService,
  ) {}

  // ─── Companies ─────────────────────────────────────────────────────

  @Post('companies')
  createCompany(@Body() dto: CreateCompanyDto) {
    return this.companies.create(dto);
  }

  @Get('companies/:id')
  company(@Param('id', ParseIntPipe) id: number) {
    return this.companies.detail(id);
  }

  @Patch('companies/:id')
  updateCompany(@Param('id', ParseIntPipe) id: number, @Body() dto: CompanyInfoDto) {
    return this.companies.update(id, dto);
  }

  @Delete('companies/:id')
  removeCompany(@Param('id', ParseIntPipe) id: number) {
    return this.companies.remove(id);
  }

  /** Works for main companies and sub-accounts (same table). */
  @Patch('accounts/:id/password')
  companyPassword(@Param('id', ParseIntPipe) id: number, @Body() dto: PasswordDto) {
    return this.companies.setPassword(id, dto.password);
  }

  @Patch('accounts/:id/status')
  companyStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: StatusDto) {
    return this.companies.setActive(id, dto.active);
  }

  /** Accounts added by a company, waiting for IGTS to set their password. */
  @Get('accounts/pending')
  async pendingAccounts() {
    const pending = this.accountRequests.pending();
    const accounts = await this.prisma.company.findMany({
      where: { id: { in: pending.map((p) => p.accountId) }, deleted: false },
      select: { id: true, nom: true, email: true, fonction: true, multicompte: true },
    });
    const owners = await this.prisma.company.findMany({
      where: { id: { in: [...new Set(accounts.map((a) => a.multicompte))] } },
      select: { id: true, nom: true, raisonsociale: true },
    });
    const ownerName = new Map(owners.map((o) => [o.id, o.raisonsociale || o.nom]));
    return accounts.map((a) => {
      const req = pending.find((p) => p.accountId === a.id)!;
      return {
        id: a.id,
        nom: a.nom,
        email: a.email,
        fonction: a.fonction,
        companyId: a.multicompte,
        company: ownerName.get(a.multicompte) ?? '',
        requestedBy: req.requestedBy,
        requestedAt: req.requestedAt,
      };
    });
  }

  /** Sets the password of an account added by a company and switches it on. */
  @Post('accounts/:id/activate')
  async activateAccount(@Param('id', ParseIntPipe) id: number, @Body() dto: PasswordDto, @CurrentUser() me: AuthUser) {
    return this.accountRequests.activate(id, dto.password, me.nom);
  }

  // ─── Subscriptions (one year, renewed by IGTS once paid) ───────────

  @Post('companies/:id/subscription/renew')
  async renewSubscription(@Param('id', ParseIntPipe) id: number, @CurrentUser() me: AuthUser) {
    await this.subs.renew(id, me.nom);
    return this.companies.detail(id);
  }

  @Put('companies/:id/subscription')
  async subscriptionDates(@Param('id', ParseIntPipe) id: number, @Body() dto: SubscriptionDatesDto, @CurrentUser() me: AuthUser) {
    await this.subs.setDates(id, dto.start, dto.end, me.nom);
    return this.companies.detail(id);
  }

  @Post('companies/:id/subscription/suspend')
  async suspendSubscription(@Param('id', ParseIntPipe) id: number, @Body() dto: SuspendDto, @CurrentUser() me: AuthUser) {
    await this.subs.suspend(id, dto.reason ?? '', me.nom);
    return this.companies.detail(id);
  }

  @Post('companies/:id/subscription/resume')
  async resumeSubscription(@Param('id', ParseIntPipe) id: number, @CurrentUser() me: AuthUser) {
    await this.subs.resume(id, me.nom);
    return this.companies.detail(id);
  }

  @Put('companies/:id/subscriptions')
  subscriptions(@Param('id', ParseIntPipe) id: number, @Body() dto: SubscriptionsDto) {
    return this.companies.updateSubscriptions(id, dto);
  }

  @Post('companies/:id/assign-subscribed')
  @HttpCode(200)
  assignSubscribed(@Param('id', ParseIntPipe) id: number) {
    return this.companies.assignSubscribed(id);
  }

  @Get('companies/:id/texts')
  companyTexts(@Param('id', ParseIntPipe) id: number, @Query() q: ListTextsQuery) {
    return this.companies.listTexts(id, q);
  }

  @Post('companies/:id/texts')
  @HttpCode(200)
  assignTexts(@Param('id', ParseIntPipe) id: number, @Body() dto: AssignTextsDto) {
    return this.companies.assignTexts(id, dto);
  }

  @Delete('companies/:id/texts/:tsId')
  unassign(@Param('id', ParseIntPipe) id: number, @Param('tsId', ParseIntPipe) tsId: number) {
    return this.companies.unassignText(id, tsId);
  }

  @Post('companies/:id/users')
  createSub(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateSubAccountDto) {
    return this.companies.createSubAccount(id, dto);
  }

  @Patch('company-users/:id')
  updateSub(@Param('id', ParseIntPipe) id: number, @Body() dto: SubAccountDto) {
    return this.companies.updateSubAccount(id, dto);
  }

  @Delete('company-users/:id')
  removeSub(@Param('id', ParseIntPipe) id: number) {
    return this.companies.removeSubAccount(id);
  }

  // ─── Texts ─────────────────────────────────────────────────────────

  @Post('texts')
  @UseInterceptors(pdfUpload)
  createText(@Body() dto: TextDto, @UploadedFile() pdf?: UploadedPdf) {
    return this.texts.create(dto, pdf);
  }

  @Get('texts/:id')
  text(@Param('id', ParseIntPipe) id: number) {
    return this.texts.detail(id);
  }

  @Patch('texts/:id')
  @UseInterceptors(pdfUpload)
  updateText(@Param('id', ParseIntPipe) id: number, @Body() dto: TextDto, @UploadedFile() pdf?: UploadedPdf) {
    return this.texts.update(id, dto, pdf);
  }

  @Delete('texts/:id')
  archiveText(@Param('id', ParseIntPipe) id: number) {
    return this.texts.archive(id);
  }

  @Delete('texts/:id/permanent')
  destroyText(@Param('id', ParseIntPipe) id: number) {
    return this.texts.destroy(id);
  }

  @Post('texts/:id/companies')
  @HttpCode(200)
  assignTextToCompanies(@Param('id', ParseIntPipe) id: number, @Body() dto: CompanyIdsDto) {
    return this.texts.assignToCompanies(id, dto.companyIds);
  }

  // ─── Reference data ────────────────────────────────────────────────

  @Get('reference')
  referenceData() {
    return this.reference.all();
  }

  @Post('secteurs')
  createSecteur(@Body() dto: NameDto) {
    return this.reference.createSecteur(dto);
  }
  @Patch('secteurs/:id')
  updateSecteur(@Param('id', ParseIntPipe) id: number, @Body() dto: NameDto) {
    return this.reference.updateSecteur(id, dto);
  }
  @Delete('secteurs/:id')
  deleteSecteur(@Param('id', ParseIntPipe) id: number) {
    return this.reference.deleteSecteur(id);
  }

  @Post('themes')
  createTheme(@Body() dto: ThemeDto) {
    return this.reference.createTheme(dto);
  }
  @Patch('themes/:id')
  updateTheme(@Param('id', ParseIntPipe) id: number, @Body() dto: ThemeDto) {
    return this.reference.updateTheme(id, dto);
  }
  @Delete('themes/:id')
  deleteTheme(@Param('id', ParseIntPipe) id: number) {
    return this.reference.deleteTheme(id);
  }

  @Post('types')
  createType(@Body() dto: NameDto) {
    return this.reference.createType(dto);
  }
  @Patch('types/:id')
  updateType(@Param('id', ParseIntPipe) id: number, @Body() dto: NameDto) {
    return this.reference.updateType(id, dto);
  }
  @Delete('types/:id')
  deleteType(@Param('id', ParseIntPipe) id: number) {
    return this.reference.deleteType(id);
  }

  // ─── Notifications ─────────────────────────────────────────────────

  /** Runs the daily action-deadline reminders now (useful to test e-mails). */
  @Post('notifications/run-reminders')
  @HttpCode(200)
  async runReminders() {
    await this.notifications.remindActionDeadlines();
    return { ok: true };
  }

  /** Sends a sample e-mail to the logged-in admin to check the SMTP settings. */
  @Post('notifications/test-email')
  @HttpCode(200)
  async testEmail(@CurrentUser() me: AuthUser) {
    const mail = newTextsEmail({
      name: me.nom,
      titles: ['Exemple — Décret n° 2000-1985 du 12 septembre 2000 (e-mail de test)'],
      appUrl: process.env.APP_URL ?? 'http://localhost:3000',
    });
    await this.mailer.send({ to: [me.email], ...mail, subject: `[Test] ${mail.subject}` });
    return { ok: true, to: me.email };
  }

  // ─── Admin users ───────────────────────────────────────────────────

  @Get('users')
  listUsers() {
    return this.users.list();
  }
  @Post('users')
  createUser(@Body() dto: CreateAdminUserDto) {
    return this.users.create(dto);
  }
  @Patch('users/:id')
  updateUser(@Param('id', ParseIntPipe) id: number, @Body() dto: AdminUserDto) {
    return this.users.update(id, dto);
  }
  @Patch('users/:id/password')
  userPassword(@Param('id', ParseIntPipe) id: number, @Body() dto: PasswordDto) {
    return this.users.setPassword(id, dto.password);
  }
  @Patch('users/:id/status')
  userStatus(@CurrentUser() me: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: StatusDto) {
    return this.users.setActive(me.id, id, dto.active);
  }
  @Delete('users/:id')
  removeUser(@CurrentUser() me: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.users.remove(me.id, id);
  }
}

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
  SubscriptionsDto,
  TextDto,
  ThemeDto,
} from './admin.dto';

const pdfUpload = FileInterceptor('pdf', { limits: { fileSize: MAX_PDF_SIZE } });

@UseGuards(AuthGuard('jwt'), AdminOnlyGuard)
@Controller('admin')
export class AdminCrudController {
  constructor(
    private companies: AdminCompaniesService,
    private texts: AdminTextsService,
    private reference: ReferenceService,
    private users: AdminUsersService,
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

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Patch,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AdminOnlyGuard, CurrentUser } from '../common/auth-user';
import type { AuthUser } from '../common/auth-user';
import { MAX_PDF_SIZE } from '../files/files.service';
import type { UploadedPdf } from '../files/files.service';
import { DraftsService } from './drafts.service';
import { DraftsStore, type DraftActor } from './drafts.store';
import { ScraperService } from './scraper.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DraftFieldsDto, DraftListQuery, RejectDraftDto } from './veille.dto';

const MAX_IMPORT_SIZE = 60 * 1024 * 1024;
const actor = (me: AuthUser): DraftActor => ({
  id: me.id,
  nom: me.nom,
  via: 'platform',
});

/** Automatic watch, for IGTS administrators: drafts, collections, imports. */
@ApiTags('Veille & Scraper JORT (Admin)')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'), AdminOnlyGuard)
@Controller('admin/veille')
export class VeilleAdminController {
  constructor(
    private drafts: DraftsService,
    private scraper: ScraperService,
  ) {}

  /** GET /api/admin/veille/status — schedule, current and last collections, pending drafts. */
  @Get('status')
  status() {
    return this.scraper.status();
  }

  /** POST /api/admin/veille/run — collect now (in the background). */
  @Post('run')
  @HttpCode(202)
  run() {
    return this.scraper.start('manual');
  }

  /** GET /api/admin/veille/runs/:id — progress of a collection or an import. */
  @Get('runs/:id')
  runStatus(@Param('id', ParseIntPipe) id: number) {
    const run = this.scraper.run(id);
    if (!run) throw new NotFoundException('Collecte introuvable');
    return run;
  }

  /** POST /api/admin/veille/import — an issue (or a single text) as PDF, read by the AI. */
  @Post('import')
  @HttpCode(202)
  @UseInterceptors(
    FileInterceptor('pdf', { limits: { fileSize: MAX_IMPORT_SIZE } }),
  )
  import(@UploadedFile() pdf?: UploadedPdf) {
    if (!pdf)
      throw new BadRequestException('Joignez le PDF du Journal officiel.');
    return this.scraper.startImport(pdf.buffer, pdf.originalname);
  }

  @Get('drafts')
  list(@Query() q: DraftListQuery) {
    return this.drafts.list(q.status);
  }

  @Get('drafts/:id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.drafts.detail(id);
  }

  @Patch('drafts/:id')
  @UseInterceptors(
    FileInterceptor('pdf', { limits: { fileSize: MAX_PDF_SIZE } }),
  )
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DraftFieldsDto,
    @UploadedFile() pdf?: UploadedPdf,
  ) {
    return this.drafts.update(id, dto, pdf);
  }

  /** POST /api/admin/veille/drafts/:id/publish — with the reviewer's last edits (and an optional new PDF). */
  @Post('drafts/:id/publish')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('pdf', { limits: { fileSize: MAX_PDF_SIZE } }),
  )
  publish(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DraftFieldsDto,
    @CurrentUser() me: AuthUser,
    @UploadedFile() pdf?: UploadedPdf,
  ) {
    return this.drafts.publish(id, actor(me), dto, pdf);
  }

  @Post('drafts/:id/reject')
  @HttpCode(200)
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectDraftDto,
    @CurrentUser() me: AuthUser,
  ) {
    return this.drafts.reject(id, actor(me), dto.reason);
  }

  @Post('drafts/:id/restore')
  @HttpCode(200)
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.drafts.restore(id);
  }
}

/**
 * Public side: the validation link of the e-mail (the signed token is the
 * credential, personal to one administrator and one draft, valid 14 days)
 * and the drafts' PDFs (unguessable file names, like the texts' PDFs).
 */
@ApiTags('Validation Veille (Publique)')
@Controller('veille')
export class VeillePublicController {
  constructor(
    private drafts: DraftsService,
    private store: DraftsStore,
  ) {}

  /** GET /api/veille/validation/:token — what the confirmation page shows. Changes nothing. */
  @Get('validation/:token')
  validation(@Param('token') token: string) {
    return this.drafts.validationInfo(token);
  }

  /** POST /api/veille/validation/:token — publishes. A POST, so that mail scanners opening links publish nothing. */
  @Post('validation/:token')
  @HttpCode(200)
  validate(@Param('token') token: string) {
    return this.drafts.publishFromLink(token);
  }

  @Get('files/:name')
  file(@Param('name') name: string, @Res() res: Response) {
    if (!/^[\w.-]+\.pdf$/.test(name) || !this.store.exists(name))
      throw new NotFoundException('Fichier introuvable');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Robots-Tag', 'noindex');
    return res.sendFile(this.store.path(name));
  }
}

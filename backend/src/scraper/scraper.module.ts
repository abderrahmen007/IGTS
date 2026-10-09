import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { DraftsService } from './drafts.service';
import { IortSource } from './iort.source';
import { JortAnalyzerService } from './jort-analyzer.service';
import { ScraperService } from './scraper.service';
import {
  VeilleAdminController,
  VeillePublicController,
} from './veille.controller';

/**
 * Automatic watch of the Official Journal: daily collection on www.iort.tn,
 * AI drafting, review and one-click publication by the administrators.
 */
@Module({
  imports: [AuthModule, AdminModule],
  controllers: [VeilleAdminController, VeillePublicController],
  providers: [DraftsService, IortSource, JortAnalyzerService, ScraperService],
})
export class ScraperModule {}

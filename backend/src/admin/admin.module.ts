import { Module } from '@nestjs/common';
import { CompanyModule } from '../company/company.module';
import { AdminController } from './admin.controller';
import { AdminCrudController } from './admin-crud.controller';
import { AdminService } from './admin.service';
import { AssignmentService } from './assignment.service';
import { AdminCompaniesService } from './companies.service';
import { AdminTextsService } from './texts.service';
import { ReferenceService } from './reference.service';
import { AdminUsersService } from './users.service';
import { AdminStatsService } from './stats.service';
import { FeedbackModule } from '../feedback/feedback.module';
import { EcheancesModule } from '../echeances/echeances.module';

@Module({
  imports: [CompanyModule, FeedbackModule, EcheancesModule],
  controllers: [AdminController, AdminCrudController],
  providers: [
    AdminService,
    AssignmentService,
    AdminCompaniesService,
    AdminTextsService,
    ReferenceService,
    AdminUsersService,
    AdminStatsService,
  ],
  // Used by the automatic watch to publish validated drafts like any new text
  exports: [AdminTextsService],
})
export class AdminModule {}

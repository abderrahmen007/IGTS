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

@Module({
  imports: [CompanyModule],
  controllers: [AdminController, AdminCrudController],
  providers: [
    AdminService,
    AssignmentService,
    AdminCompaniesService,
    AdminTextsService,
    ReferenceService,
    AdminUsersService,
  ],
})
export class AdminModule {}

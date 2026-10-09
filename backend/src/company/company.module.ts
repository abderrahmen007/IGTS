import { Module } from '@nestjs/common';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';
import { TeamService } from './team.service';

@Module({
  controllers: [CompanyController],
  providers: [CompanyService, TeamService],
  exports: [CompanyService],
})
export class CompanyModule {}

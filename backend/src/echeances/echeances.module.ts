import { Module } from '@nestjs/common';
import {
  AdminEcheancesController,
  CompanyEcheancesController,
} from './echeances.controller';
import { EcheancesService } from './echeances.service';
import { EcheancesStore } from './echeances.store';
import { RemindersService } from './reminders.service';

/**
 * Regular checks and renewals of the companies (vehicles, regulatory checks,
 * certificates, approvals, insurance…) and the daily reminders, which also
 * cover the deadlines of the action plan.
 */
@Module({
  controllers: [CompanyEcheancesController, AdminEcheancesController],
  providers: [EcheancesStore, EcheancesService, RemindersService],
  exports: [RemindersService],
})
export class EcheancesModule {}

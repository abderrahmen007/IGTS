import { Global, Module } from '@nestjs/common';
import { AccountRequestsService } from './account-requests.service';
import { ActivityService } from './activity.service';
import { AdminContactsService } from './admin-contacts.service';
import { SubscriptionsService } from './subscriptions.service';

/**
 * Client accounts as IGTS manages them: yearly subscriptions (and the lock
 * when they end), accounts waiting for a password from IGTS, and the journal
 * of activity used by the administrators' statistics.
 */
@Global()
@Module({
  providers: [
    ActivityService,
    AdminContactsService,
    SubscriptionsService,
    AccountRequestsService,
  ],
  exports: [
    ActivityService,
    AdminContactsService,
    SubscriptionsService,
    AccountRequestsService,
  ],
})
export class AccountsModule {}

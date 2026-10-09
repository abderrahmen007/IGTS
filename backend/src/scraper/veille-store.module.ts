import { Global, Module } from '@nestjs/common';
import { DraftsStore } from './drafts.store';

/** The drafts store is read by the admin overview too (count of texts to validate). */
@Global()
@Module({
  providers: [DraftsStore],
  exports: [DraftsStore],
})
export class VeilleStoreModule {}

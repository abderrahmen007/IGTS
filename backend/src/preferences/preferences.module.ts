import { Global, Module } from '@nestjs/common';
import { PreferencesService } from './preferences.service';

@Global()
@Module({
  providers: [PreferencesService],
  exports: [PreferencesService],
})
export class PreferencesModule {}

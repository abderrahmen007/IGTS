import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { RealtimeService } from './realtime.service';
import { MailerService } from './mailer.service';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, RealtimeService, MailerService],
  exports: [NotificationsService, RealtimeService, MailerService],
})
export class NotificationsModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CompanyModule } from './company/company.module';
import { AdminModule } from './admin/admin.module';
import { ChatbotModule } from './chatbot/chatbot.module';
import { ScraperModule } from './scraper/scraper.module';
import { NotificationsModule } from './notifications/notifications.module';
import { FilesModule } from './files/files.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    NotificationsModule,
    FilesModule,
    AuthModule,
    CompanyModule,
    AdminModule,
    ChatbotModule,
    ScraperModule,
  ],
})
export class AppModule {}

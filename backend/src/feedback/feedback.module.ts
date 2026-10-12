import { Module } from '@nestjs/common';
import {
  AdminFeedbackController,
  CompanyFeedbackController,
} from './feedback.controller';
import { FeedbackService } from './feedback.service';

/** Yearly satisfaction survey (every September, or when IGTS launches one). */
@Module({
  controllers: [CompanyFeedbackController, AdminFeedbackController],
  providers: [FeedbackService],
  exports: [FeedbackService],
})
export class FeedbackModule {}

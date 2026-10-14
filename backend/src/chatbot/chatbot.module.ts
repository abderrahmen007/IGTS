import { Module } from '@nestjs/common';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';
import { EmbeddingsService } from './embeddings.service';

@Module({
  controllers: [ChatbotController],
  providers: [ChatbotService, EmbeddingsService],
})
export class ChatbotModule {}

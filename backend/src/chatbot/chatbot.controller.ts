import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ChatbotService } from './chatbot.service';

@UseGuards(AuthGuard('jwt'))
@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Post('ask')
  async ask(@Body('question') question: string, @Request() req) {
    return this.chatbotService.askQuestion(question, req.user.id);
  }
}

import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { CompanyOnlyGuard, CurrentUser } from '../common/auth-user';
import type { AuthUser } from '../common/auth-user';
import { ChatbotService } from './chatbot.service';

class AskDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  question!: string;
}

@UseGuards(AuthGuard('jwt'), CompanyOnlyGuard)
@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Post('ask')
  @HttpCode(200)
  ask(@CurrentUser() user: AuthUser, @Body() dto: AskDto) {
    return this.chatbotService.ask(user, dto.question.trim());
  }
}

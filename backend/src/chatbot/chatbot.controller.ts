import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CompanyOnlyGuard, CurrentUser } from '../common/auth-user';
import type { AuthUser } from '../common/auth-user';
import { ChatbotService } from './chatbot.service';

class ChatTurnDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @MaxLength(4000)
  text!: string;
}

class AskDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  question!: string;

  /** When asked from a text page: that text is always used as context. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  texteSocieteId?: number;

  /** The last exchanges, so a short follow-up question keeps its subject. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => ChatTurnDto)
  history?: ChatTurnDto[];
}

@ApiTags('Assistant Juridique IA (Chatbot RAG)')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'), CompanyOnlyGuard)
@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Post('ask')
  @HttpCode(200)
  ask(@CurrentUser() user: AuthUser, @Body() dto: AskDto) {
    return this.chatbotService.ask(
      user,
      dto.question.trim(),
      dto.texteSocieteId,
      dto.history ?? [],
    );
  }
}

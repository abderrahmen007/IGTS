import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  AdminOnlyGuard,
  CompanyOnlyGuard,
  CurrentUser,
} from '../common/auth-user';
import type { AuthUser } from '../common/auth-user';
import { FeedbackService } from './feedback.service';

export class FeedbackAnswersDto {
  @IsObject()
  answers!: Record<string, unknown>;
}

export class OpenCampaignDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date de clôture invalide' })
  closesOn?: string;
}

export class QuestionDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  id?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(300)
  label!: string;

  @IsIn(['rating', 'text'])
  kind!: 'rating' | 'text';

  @IsBoolean()
  required!: boolean;
}

export class QuestionsDto {
  @ValidateNested({ each: true })
  @Type(() => QuestionDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  questions!: QuestionDto[];
}

/** The survey seen by a company account. */
@ApiTags('Entreprise — Enquête de satisfaction')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'), CompanyOnlyGuard)
@Controller('company/feedback')
export class CompanyFeedbackController {
  constructor(private feedback: FeedbackService) {}

  @Get()
  current(@CurrentUser() me: AuthUser) {
    return this.feedback.forUser(me);
  }

  @Post()
  @HttpCode(200)
  answer(@CurrentUser() me: AuthUser, @Body() dto: FeedbackAnswersDto) {
    return this.feedback.submit(me, dto.answers);
  }
}

/** Surveys for the IGTS administrators: questions, launch, closing, results. */
@ApiTags('Administration IGTS — Enquêtes de satisfaction')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'), AdminOnlyGuard)
@Controller('admin/feedback')
export class AdminFeedbackController {
  constructor(private feedback: FeedbackService) {}

  @Get()
  overview() {
    return this.feedback.overview();
  }

  @Put('questions')
  questions(@Body() dto: QuestionsDto) {
    return this.feedback.setQuestions(dto.questions);
  }

  @Post('campaigns')
  open(@Body() dto: OpenCampaignDto, @CurrentUser() me: AuthUser) {
    return this.feedback.open({
      by: me.nom,
      trigger: 'manual',
      title: dto.title,
      closesOn: dto.closesOn,
    });
  }

  @Post('campaigns/:id/close')
  @HttpCode(200)
  close(@Param('id', ParseIntPipe) id: number, @CurrentUser() me: AuthUser) {
    return this.feedback.close(id, me.nom);
  }

  @Get('campaigns/:id')
  results(@Param('id', ParseIntPipe) id: number) {
    return this.feedback.results(id);
  }
}

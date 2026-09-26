import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export const TEXT_STATUSES = [
  'a-analyser',
  'conforme',
  'non-conforme',
  'indicatif',
  'non-applicable',
] as const;
export type TextStatus = (typeof TEXT_STATUSES)[number];

export class ListTextsQuery {
  @IsOptional() @IsString() @MaxLength(200)
  search?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  secteurId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  typeId?: number;

  @IsOptional() @IsIn(TEXT_STATUSES as unknown as string[])
  status?: TextStatus;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(5) @Max(100)
  pageSize?: number;
}

export class EvaluateTextDto {
  /** 1 Applicable · 2 Non applicable · 3 Non analysé */
  @Type(() => Number) @IsInt() @IsIn([1, 2, 3])
  applicabiliteId!: number;

  /** 1 Conforme · 2 Non conforme · 3 À titre indicatif · 4 Non analysé — only when applicable */
  @IsOptional() @ValidateIf((_o, v) => v !== null) @Type(() => Number) @IsInt() @IsIn([1, 2, 3, 4])
  gestionetatId?: number | null;

  @IsOptional() @IsString() @MaxLength(2000)
  comment?: string;
}

export class CreateActionDto {
  @IsString() @MinLength(3) @MaxLength(2000)
  description!: string;

  @IsOptional() @IsString() @MaxLength(255)
  responsable?: string;

  @IsOptional() @IsString() @MaxLength(50)
  telephone?: string;

  /** Free text as in the legacy app, e.g. "3 mois" */
  @IsOptional() @IsString() @MaxLength(100)
  delai?: string;

  @IsOptional() @IsISO8601()
  dateOuverture?: string;

  @IsOptional() @IsISO8601()
  dateCloture?: string;
}

export class UpdateActionDto {
  /** 1 En cours · 5 Efficace · 6 Non efficace */
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([1, 5, 6])
  gestionactionId?: number;

  /** Effectiveness in % (legacy column `courrielResponsable`) */
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100)
  effectivite?: number;

  @IsOptional() @IsISO8601()
  dateCloture?: string;
}

export class ListActionsQuery {
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([1, 5, 6])
  gestionactionId?: number;
}

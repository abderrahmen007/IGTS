import { Type } from 'class-transformer';
import {
  IsBoolean,
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

  /**
   * The new answer puts the text's open actions on hold (e.g. "ne nous
   * concerne pas"). The client must confirm it after being told how many.
   */
  @IsOptional() @IsBoolean()
  confirmHoldActions?: boolean;
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

  /** 1 En cours · 5 Efficace · 6 Non efficace (legacy form lets the user choose) */
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([1, 5, 6])
  gestionactionId?: number;

  /** Progress in % (legacy column `courrielResponsable`) */
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100)
  effectivite?: number;
}

export class UpdateActionDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(2000)
  description?: string;

  @IsOptional() @IsString() @MaxLength(255)
  responsable?: string;

  @IsOptional() @IsString() @MaxLength(50)
  telephone?: string;

  @IsOptional() @IsString() @MaxLength(100)
  delai?: string;

  @IsOptional() @IsISO8601()
  dateOuverture?: string;

  /** 1 En cours · 5 Efficace · 6 Non efficace */
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([1, 5, 6])
  gestionactionId?: number;

  /** Progress in % (legacy column `courrielResponsable`) */
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100)
  effectivite?: number;

  /** ISO date, or null to clear the deadline */
  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsISO8601()
  dateCloture?: string | null;
}

export class ListActionsQuery {
  @IsOptional() @Type(() => Number) @IsInt() @IsIn([1, 5, 6])
  gestionactionId?: number;
}

// ─── Profile ─────────────────────────────────────────────────────────

export class UpdateProfileDto {
  @IsString() @MinLength(2) @MaxLength(255)
  nom!: string;

  @IsOptional() @IsString() @MaxLength(255)
  fonction?: string;

  @IsOptional() @IsString() @MaxLength(50)
  tel?: string;
}

export class ChangePasswordDto {
  @IsString() @MinLength(1) @MaxLength(200)
  current!: string;

  @IsString() @MinLength(8, { message: 'Le nouveau mot de passe doit contenir au moins 8 caractères' }) @MaxLength(200)
  next!: string;
}

export class PreferencesDto {
  @IsOptional() @IsBoolean()
  emailNewTexts?: boolean;

  @IsOptional() @IsBoolean()
  emailReminders?: boolean;

  /** true = tour finished or skipped now, false = show it again */
  @IsOptional() @IsBoolean()
  tourSeen?: boolean;
}

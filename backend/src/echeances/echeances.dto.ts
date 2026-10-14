import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CATEGORIES, type Category } from './echeances.store';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** Empty strings from a form mean "not given". */
const emptyToNull = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && !value.trim() ? null : value,
  );

/** A company's item, as the form sends it (creation and full update). */
export class EcheanceDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  typeId?: number | null;

  @IsIn(CATEGORIES)
  category!: Category;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  label!: string;

  @IsOptional()
  @emptyToNull()
  @IsString()
  @MaxLength(120)
  reference?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  everyMonths?: number | null;

  @IsOptional()
  @emptyToNull()
  @Matches(DAY, { message: 'Date de dernière réalisation invalide' })
  lastDone?: string | null;

  /** Required unless it can be computed (last date + frequency) */
  @IsOptional()
  @emptyToNull()
  @Matches(DAY, { message: 'Date d’échéance invalide' })
  dueOn?: string | null;

  @IsOptional()
  @emptyToNull()
  @IsString()
  @MaxLength(120)
  responsibleName?: string | null;

  @IsOptional()
  @emptyToNull()
  @IsEmail({}, { message: 'Adresse e-mail du responsable invalide' })
  @MaxLength(200)
  responsibleEmail?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @Type(() => Number)
  @IsInt({ each: true })
  textIds?: number[];

  @IsOptional()
  @emptyToNull()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}

export class MarkDoneDto {
  @Matches(DAY, { message: 'Date de réalisation invalide' })
  doneOn!: string;

  /** Next due date; computed from the frequency when not given */
  @IsOptional()
  @emptyToNull()
  @Matches(DAY, { message: 'Prochaine échéance invalide' })
  nextDue?: string | null;

  @IsOptional()
  @emptyToNull()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

export class EcheanceTypeDto {
  @IsIn(CATEGORIES)
  category!: Category;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  label!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  everyMonths?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @Type(() => Number)
  @IsInt({ each: true })
  textIds?: number[];

  @IsOptional()
  @emptyToNull()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class EcheancesQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  companyId?: number;

  @IsOptional()
  @IsIn(['late', 'soon', 'ok'])
  status?: 'late' | 'soon' | 'ok';

  @IsOptional()
  @IsIn(CATEGORIES)
  category?: Category;
}

export class TextSearchQuery {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

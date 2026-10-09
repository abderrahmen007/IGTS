import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Empty strings from a form mean "not chosen". */
const optionalId = () =>
  Transform(({ value }) =>
    value === '' || value === null || value === undefined
      ? null
      : Number(value),
  );

/** Edits of a draft before (or while) publishing it. Every field is optional. */
export class DraftFieldsDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(2555)
  titre?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2555)
  journal?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2555)
  date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2555)
  num?: string;

  @IsOptional()
  @optionalId()
  @IsInt()
  typeId?: number | null;

  @IsOptional()
  @optionalId()
  @IsInt()
  secteurId?: number | null;

  @IsOptional()
  @optionalId()
  @IsInt()
  themeId?: number | null;
}

export class RejectDraftDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class DraftListQuery {
  @IsOptional()
  @IsIn(['pending', 'published', 'rejected'])
  status?: 'pending' | 'published' | 'rejected';
}

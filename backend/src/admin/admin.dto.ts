import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

// ─── Companies ───────────────────────────────────────────────────────

export class CompanyInfoDto {
  @IsString() @MinLength(2) @MaxLength(255)
  raisonsociale!: string;

  @IsString() @MinLength(2) @MaxLength(255)
  nom!: string;

  @IsEmail({}, { message: 'Adresse e-mail invalide' }) @MaxLength(180)
  email!: string;

  @IsOptional() @IsString() @MaxLength(255)
  tel?: string;

  @IsOptional() @IsString() @MaxLength(255)
  fonction?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  adresse?: string;

  @IsOptional() @IsString() @MaxLength(255)
  ville?: string;

  /** Matricule fiscal (legacy column `zipcode`) */
  @IsOptional() @IsString() @MaxLength(255)
  matriculeFiscal?: string;
}

export class CreateCompanyDto extends CompanyInfoDto {
  @IsString() @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' }) @MaxLength(200)
  password!: string;

  @IsOptional() @IsArray() @ArrayMaxSize(50) @Type(() => Number) @IsInt({ each: true })
  secteurIds?: number[];
}

export class PasswordDto {
  @IsString() @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' }) @MaxLength(200)
  password!: string;
}

export class StatusDto {
  @IsBoolean()
  active!: boolean;
}

export class SubscriptionsDto {
  @IsArray() @ArrayMaxSize(100) @Type(() => Number) @IsInt({ each: true })
  secteurIds!: number[];

  @IsArray() @ArrayMaxSize(500) @Type(() => Number) @IsInt({ each: true })
  themeIds!: number[];

  /** Only compute what would be removed, change nothing. */
  @IsOptional() @IsBoolean()
  dryRun?: boolean;

  /** Also assign the texts of newly subscribed themes. */
  @IsOptional() @IsBoolean()
  assignTexts?: boolean;
}

export class AssignTextsDto {
  @IsArray() @ArrayMaxSize(500) @Type(() => Number) @IsInt({ each: true })
  texteIds!: number[];
}

export class SubAccountDto {
  @IsString() @MinLength(2) @MaxLength(255)
  nom!: string;

  @IsEmail({}, { message: 'Adresse e-mail invalide' }) @MaxLength(180)
  email!: string;

  @IsOptional() @IsString() @MaxLength(255)
  tel?: string;

  @IsOptional() @IsString() @MaxLength(255)
  fonction?: string;
}

export class CreateSubAccountDto extends SubAccountDto {
  @IsString() @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' }) @MaxLength(200)
  password!: string;
}

// ─── Texts ───────────────────────────────────────────────────────────

export class TextDto {
  @IsString() @MinLength(3) @MaxLength(2555)
  titre!: string;

  @IsString() @MinLength(3)
  description!: string;

  @IsOptional() @IsString() @MaxLength(2555)
  journal?: string;

  @IsOptional() @IsString() @MaxLength(2555)
  date?: string;

  @IsOptional() @IsString() @MaxLength(2555)
  num?: string;

  @Type(() => Number) @IsInt()
  typeId!: number;

  @Type(() => Number) @IsInt()
  secteurId!: number;

  @Type(() => Number) @IsInt()
  themeId!: number;
}

// ─── Reference data ──────────────────────────────────────────────────

export class NameDto {
  @IsString() @MinLength(2) @MaxLength(255)
  name!: string;
}

export class ThemeDto extends NameDto {
  @Type(() => Number) @IsInt()
  secteurId!: number;
}

// ─── Admin users ─────────────────────────────────────────────────────

export class AdminUserDto {
  @IsString() @MinLength(2) @MaxLength(50)
  nomComplet!: string;

  @IsEmail({}, { message: 'Adresse e-mail invalide' }) @MaxLength(100)
  email!: string;
}

export class CreateAdminUserDto extends AdminUserDto {
  @IsString() @MinLength(12, { message: 'Le mot de passe administrateur doit contenir au moins 12 caractères' }) @MaxLength(200)
  password!: string;
}

export class CompanyIdsDto {
  @IsArray() @ArrayMaxSize(500) @Type(() => Number) @IsInt({ each: true })
  companyIds!: number[];
}

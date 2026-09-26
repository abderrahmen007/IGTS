import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  @MaxLength(180)
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Mot de passe requis' })
  @MaxLength(200)
  password!: string;
}

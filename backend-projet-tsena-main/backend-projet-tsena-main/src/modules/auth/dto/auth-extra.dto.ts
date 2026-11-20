import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty({ description: 'Token de vérification reçu par e-mail' })
  @IsString({ message: 'Le token doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le token de vérification est obligatoire' })
  token: string;
}

export class ResendVerificationDto {
}

export class ForgotPasswordDto {
  @ApiProperty({ description: 'Adresse e-mail du compte', example: 'user@example.com' })
  @IsEmail({}, { message: 'Veuillez saisir une adresse e-mail valide' })
  @IsNotEmpty({ message: 'L\'adresse e-mail est obligatoire' })
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token de réinitialisation reçu par e-mail' })
  @IsString({ message: 'Le token doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le token de réinitialisation est obligatoire' })
  token: string;

  @ApiProperty({ description: 'Nouveau mot de passe' })
  @IsString({ message: 'Le mot de passe doit être une chaîne de caractères' })
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  @MaxLength(128, { message: 'Le mot de passe ne peut pas dépasser 128 caractères' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre',
  })
  newPassword: string;
}

export class ChangePasswordDto {
  @ApiProperty({ description: 'Mot de passe actuel' })
  @IsString({ message: 'Le mot de passe actuel est obligatoire' })
  @IsNotEmpty({ message: 'Le mot de passe actuel est obligatoire' })
  currentPassword: string;

  @ApiProperty({ description: 'Nouveau mot de passe' })
  @IsString({ message: 'Le nouveau mot de passe doit être une chaîne de caractères' })
  @MinLength(8, { message: 'Le nouveau mot de passe doit contenir au moins 8 caractères' })
  @MaxLength(128, { message: 'Le nouveau mot de passe ne peut pas dépasser 128 caractères' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Le nouveau mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre',
  })
  newPassword: string;
}

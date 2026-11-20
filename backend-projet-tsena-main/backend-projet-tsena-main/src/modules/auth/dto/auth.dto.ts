import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsEnum,
  IsArray,
  ArrayNotEmpty,
  IsUrl,
  IsNotEmpty,
  IsBoolean,
  Equals,
} from 'class-validator';
import { UserRole, Gender } from '../../../database/entities/role.enum';

export enum RegistrationAccountType {
  CLIENT = 'client',
  SELLER = 'seller',
  ADMIN = 'admin',
}

export class RegisterDto {
  @IsEmail({}, { message: 'Email invalide' })
  email: string;

  @IsString()
  @MinLength(2, { message: 'Le prénom doit contenir au moins 2 caractères' })
  @MaxLength(50)
  firstName: string;

  @IsString()
  @MinLength(2, { message: 'Le nom doit contenir au moins 2 caractères' })
  @MaxLength(50)
  @IsOptional()
  lastName?: string;

  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre',
  })
  password: string;

  @IsOptional()
  @IsString()
  @Matches(/^[+\d][\d\s().-]{5,}$/, { message: 'Numéro de téléphone invalide' })
  phone?: string;

  @IsOptional()
  @IsEnum(RegistrationAccountType, { message: 'Type de compte invalide : client, seller ou admin' })
  accountType?: RegistrationAccountType;

  @IsOptional()
  @IsBoolean()
  requestSellerAccount?: boolean;

  @Equals(true, { message: "Vous devez accepter les conditions générales d'utilisation pour créer un compte" })
  acceptTerms: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^(\d{4}-\d{2}-\d{2})?$/, { message: 'La date de naissance doit être au format AAAA-MM-JJ' })
  birthDate?: string;

  @IsOptional()
  @IsEnum(Gender, { message: 'Valeur de sexe invalide' })
  gender?: Gender;

  @IsOptional()
  @IsBoolean({ message: 'Le consentement marketing doit être un booléen' })
  marketingOptIn?: boolean;

  @IsArray()
  @IsEnum(UserRole, { each: true })
  @ArrayNotEmpty()
  @IsOptional()
  roles?: UserRole[];
}

export class LoginDto {
  @IsEmail({}, { message: 'Email invalide' })
  email: string;

  @IsString()
  password: string;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty({ message: 'Le refresh token est requis' })
  refreshToken: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Le prénom doit contenir au moins 2 caractères' })
  @MaxLength(50)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Le nom doit contenir au moins 2 caractères' })
  @MaxLength(50)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(/^[+\d][\d\s().-]{5,}$/, { message: 'Numéro de téléphone invalide' })
  phone?: string;

  @IsOptional()
  @IsUrl({ require_tld: false }, { message: "L'URL de l'avatar est invalide" })
  @MaxLength(2048)
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(\d{4}-\d{2}-\d{2})?$/, { message: 'La date de naissance doit être au format AAAA-MM-JJ' })
  birthDate?: string;

  @IsOptional()
  @IsEnum(Gender, { message: 'Valeur de sexe invalide' })
  gender?: Gender;

  @IsOptional()
  @IsBoolean({ message: 'Le consentement marketing doit être un booléen' })
  marketingOptIn?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyFollowedShopProducts?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyFollowedShopPromotions?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyMessagesByEmail?: boolean;
}

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Email invalide' })
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre',
  })
  newPassword: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  newPassword: string;
}

export class AuthTokensDto {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export class AuthResponseDto {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName?: string;
    phone?: string;
    avatarUrl?: string;
    roles: UserRole[];
    status: string;
    emailVerified: boolean;
    createdAt: Date;
  };
  tokens: AuthTokensDto;
  emailVerificationRequired: boolean;
}

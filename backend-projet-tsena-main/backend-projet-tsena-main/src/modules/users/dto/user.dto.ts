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
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole, AccountStatus } from '../../../database/entities/role.enum';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
const PASSWORD_MESSAGE =
  'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre';

export class CreateUserDto {
  @IsEmail({}, { message: 'Email invalide' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  @MaxLength(128)
  @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  password: string;

  @IsString()
  @MinLength(2, { message: 'Le prénom doit contenir au moins 2 caractères' })
  @MaxLength(50)
  firstName: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty({ message: 'Au moins un rôle est requis' })
  @IsEnum(UserRole, { each: true, message: 'Rôle invalide' })
  roles?: UserRole[];

  @IsOptional()
  @IsEnum(AccountStatus, { message: 'Statut invalide' })
  status?: AccountStatus;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Le prénom doit contenir au moins 2 caractères' })
  @MaxLength(50)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsUrl({ require_tld: false }, { message: "L'URL de l'avatar est invalide" })
  @MaxLength(2048)
  avatarUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty({ message: 'Au moins un rôle est requis' })
  @IsEnum(UserRole, { each: true, message: 'Rôle invalide' })
  roles?: UserRole[];

  @IsOptional()
  @IsEnum(AccountStatus, { message: 'Statut invalide' })
  status?: AccountStatus;
}

export class FilterUsersDto extends PaginationDto {
  @IsOptional()
  @IsEnum(UserRole, { message: 'Rôle invalide' })
  role?: UserRole;

  @IsOptional()
  @IsEnum(AccountStatus, { message: 'Statut invalide' })
  status?: AccountStatus;

  @IsOptional()
  @Transform(({ obj, key }) => {
    const raw = (obj as Record<string, unknown>)[key];
    if (raw === undefined || raw === null || raw === '') return undefined;
    return raw === true || raw === 'true' || raw === '1';
  })
  @IsBoolean()
  sellerRequested?: boolean;
}

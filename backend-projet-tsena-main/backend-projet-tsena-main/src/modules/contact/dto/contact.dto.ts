import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateContactMessageDto {
  @ApiProperty({ description: 'Nom de l’expéditeur' })
  @Transform(trim)
  @IsString({ message: 'Le nom doit être une chaîne de caractères' })
  @MinLength(2, { message: 'Le nom doit contenir au moins 2 caractères' })
  @MaxLength(80, { message: 'Le nom ne peut pas dépasser 80 caractères' })
  name: string;

  @ApiProperty({ description: 'Adresse e-mail de réponse' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  @MaxLength(120, { message: 'L’adresse e-mail ne peut pas dépasser 120 caractères' })
  email: string;

  @ApiProperty({ description: 'Sujet du message' })
  @Transform(trim)
  @IsString({ message: 'Le sujet doit être une chaîne de caractères' })
  @MinLength(3, { message: 'Le sujet doit contenir au moins 3 caractères' })
  @MaxLength(120, { message: 'Le sujet ne peut pas dépasser 120 caractères' })
  subject: string;

  @ApiProperty({ description: 'Contenu du message' })
  @Transform(trim)
  @IsString({ message: 'Le message doit être une chaîne de caractères' })
  @MinLength(10, { message: 'Le message doit contenir au moins 10 caractères' })
  @MaxLength(4000, { message: 'Le message ne peut pas dépasser 4000 caractères' })
  message: string;

  /** Champ piège anti-robot : doit rester vide (invisible dans le formulaire). */
  @ApiPropertyOptional({ description: 'Champ anti-spam (doit rester vide)' })
  @IsOptional()
  @IsString()
  @MaxLength(0, { message: 'Requête invalide' })
  website?: string;
}

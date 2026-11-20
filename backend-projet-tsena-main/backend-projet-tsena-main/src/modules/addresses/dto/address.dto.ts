import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateAddressDto {
  @ApiProperty({ description: 'Libellé (Domicile, Bureau…)', example: 'Domicile' })
  @IsString({ message: 'Le libellé doit être une chaîne de caractères' })
  @MinLength(2, { message: 'Le libellé doit contenir au moins 2 caractères' })
  @MaxLength(40, { message: 'Le libellé ne peut pas dépasser 40 caractères' })
  label: string;

  @ApiProperty({ description: 'Nom complet du destinataire' })
  @IsString({ message: 'Le nom du destinataire doit être une chaîne de caractères' })
  @MinLength(3, { message: 'Le nom du destinataire doit contenir au moins 3 caractères' })
  @MaxLength(120, { message: 'Le nom du destinataire ne peut pas dépasser 120 caractères' })
  recipientName: string;

  @ApiProperty({ description: 'Téléphone de contact pour la livraison', example: '034 00 000 00' })
  @IsString({ message: 'Le téléphone doit être une chaîne de caractères' })
  @Matches(/^\+?[0-9 ]{9,15}$/, { message: 'Numéro de téléphone invalide (ex. 034 00 000 00)' })
  phone: string;

  @ApiProperty({ description: 'Adresse détaillée (lot, rue, quartier)' })
  @IsString({ message: "L'adresse doit être une chaîne de caractères" })
  @MinLength(5, { message: "L'adresse doit contenir au moins 5 caractères" })
  @MaxLength(200, { message: "L'adresse ne peut pas dépasser 200 caractères" })
  street: string;

  @ApiPropertyOptional({ description: 'Complément (bâtiment, étage…)' })
  @IsString({ message: 'Le complément doit être une chaîne de caractères' })
  @IsOptional()
  @MaxLength(120, { message: 'Le complément ne peut pas dépasser 120 caractères' })
  complement?: string;

  @ApiProperty({ description: 'Ville', example: 'Antananarivo' })
  @IsString({ message: 'La ville doit être une chaîne de caractères' })
  @MinLength(2, { message: 'La ville doit contenir au moins 2 caractères' })
  @MaxLength(80, { message: 'La ville ne peut pas dépasser 80 caractères' })
  city: string;

  @ApiPropertyOptional({ description: 'Région', example: 'Analamanga' })
  @IsString({ message: 'La région doit être une chaîne de caractères' })
  @IsOptional()
  @MaxLength(80, { message: 'La région ne peut pas dépasser 80 caractères' })
  state?: string;

  @ApiPropertyOptional({ description: 'Code postal', example: '101' })
  @IsString({ message: 'Le code postal doit être une chaîne de caractères' })
  @IsOptional()
  @MaxLength(12, { message: 'Le code postal ne peut pas dépasser 12 caractères' })
  postalCode?: string;

  @ApiPropertyOptional({ description: 'Pays', default: 'Madagascar' })
  @IsString({ message: 'Le pays doit être une chaîne de caractères' })
  @IsOptional()
  @MaxLength(60, { message: 'Le pays ne peut pas dépasser 60 caractères' })
  country?: string;

  @ApiPropertyOptional({ description: 'Instructions pour le livreur' })
  @IsString({ message: 'Les instructions doivent être une chaîne de caractères' })
  @IsOptional()
  @MaxLength(200, { message: 'Les instructions ne peuvent pas dépasser 200 caractères' })
  instructions?: string;

  @ApiPropertyOptional({ description: 'Définir comme adresse par défaut' })
  @IsBoolean({ message: 'isDefault doit être un booléen' })
  @IsOptional()
  isDefault?: boolean;
}

export class UpdateAddressDto extends PartialType(CreateAddressDto) {}

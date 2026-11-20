import { IsString, IsOptional, IsUUID, IsBoolean, MaxLength, MinLength, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({ description: 'Nom de la catégorie', example: 'Électronique' })
  @IsString({ message: 'Le nom de la catégorie doit être une chaîne de caractères' })
  @MinLength(2, { message: 'Le nom de la catégorie doit contenir au moins 2 caractères' })
  @MaxLength(100, { message: 'Le nom de la catégorie ne peut pas dépasser 100 caractères' })
  @IsNotEmpty({ message: 'Le nom de la catégorie est obligatoire' })
  name: string;

  @ApiPropertyOptional({ description: 'Slug URL (auto-généré si non fourni)', example: 'electronique' })
  @IsString()
  @IsOptional()
  @MaxLength(100, { message: 'Le slug ne peut pas dépasser 100 caractères' })
  slug?: string;

  @ApiPropertyOptional({ description: 'Description de la catégorie' })
  @IsString({ message: 'La description doit être une chaîne de caractères' })
  @IsOptional()
  @MaxLength(500, { message: 'La description ne peut pas dépasser 500 caractères' })
  description?: string;

  @ApiPropertyOptional({ description: 'URL de l\'image de la catégorie' })
  @IsString({ message: 'L\'URL de l\'image doit être une chaîne de caractères' })
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'ID de la catégorie parente (pour sous-catégories)' })
  @IsUUID('4', { message: 'L\'ID de la catégorie parente doit être un UUID valide' })
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({ description: 'Ordre d\'affichage', default: 0 })
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Catégorie active ou non', default: true })
  @IsBoolean({ message: 'Le champ actif doit être vrai ou faux' })
  @IsOptional()
  isActive?: boolean;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ description: 'Nom de la catégorie' })
  @IsString({ message: 'Le nom de la catégorie doit être une chaîne de caractères' })
  @MinLength(2, { message: 'Le nom de la catégorie doit contenir au moins 2 caractères' })
  @MaxLength(100, { message: 'Le nom de la catégorie ne peut pas dépasser 100 caractères' })
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Slug URL' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  slug?: string;

  @ApiPropertyOptional({ description: 'Description' })
  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'La description ne peut pas dépasser 500 caractères' })
  description?: string;

  @ApiPropertyOptional({ description: 'URL de l\'image' })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'ID de la catégorie parente' })
  @IsUUID('4', { message: 'L\'ID de la catégorie parente doit être un UUID valide' })
  @IsOptional()
  parentId?: string | null;

  @ApiPropertyOptional({ description: 'Ordre d\'affichage' })
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Catégorie active ou non' })
  @IsBoolean({ message: 'Le champ actif doit être vrai ou faux' })
  @IsOptional()
  isActive?: boolean;
}

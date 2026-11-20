import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, MinLength, ArrayMaxSize } from 'class-validator';
import { ShopLevel, ShopStatus } from '../../../database/entities/role.enum';

export class CreateShopDto {
  @ApiProperty({ example: 'Boutique Rado' })
  @IsString({ message: 'Le nom de la boutique doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le nom de la boutique est obligatoire' })
  @MinLength(3, { message: 'Le nom de la boutique doit contenir au moins 3 caractères' })
  @MaxLength(120, { message: 'Le nom de la boutique ne peut pas dépasser 120 caractères' })
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'La description doit être une chaîne de caractères' })
  @MaxLength(3000, { message: 'La description ne peut pas dépasser 3000 caractères' })
  description?: string;

  @ApiPropertyOptional({ description: 'Identifiants des catégories principales', type: [String] })
  @IsOptional()
  @IsArray({ message: 'Les catégories principales doivent être un tableau' })
  @ArrayMaxSize(5, { message: '5 catégories principales au maximum' })
  @IsUUID('4', { each: true, message: 'Identifiant de catégorie invalide' })
  mainCategoryIds?: string[];

  @ApiPropertyOptional({ example: 'Antananarivo — Analakely' })
  @IsOptional()
  @IsString({ message: 'La localisation doit être une chaîne de caractères' })
  @MaxLength(120, { message: 'La localisation ne peut pas dépasser 120 caractères' })
  location?: string;

  @ApiPropertyOptional({ example: 'Antananarivo', description: 'Ville (filtre « localisation » du catalogue)' })
  @IsOptional()
  @IsString({ message: 'La ville doit être une chaîne de caractères' })
  @MaxLength(80, { message: 'La ville ne peut pas dépasser 80 caractères' })
  city?: string;

  @ApiPropertyOptional({ description: 'Conditions de livraison affichées aux clients' })
  @IsOptional()
  @IsString({ message: 'Les conditions de livraison doivent être une chaîne de caractères' })
  @MaxLength(2000, { message: 'Les conditions de livraison ne peuvent pas dépasser 2000 caractères' })
  deliveryConditions?: string;

  @ApiPropertyOptional({ description: 'Produits mis en avant sur la page boutique', type: [String] })
  @IsOptional()
  @IsArray({ message: 'Les produits mis en avant doivent être un tableau' })
  @ArrayMaxSize(8, { message: '8 produits mis en avant au maximum' })
  @IsUUID('4', { each: true, message: 'Identifiant de produit invalide' })
  featuredProductIds?: string[];
}

export class UpdateShopDto extends CreateShopDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Le nom de la boutique doit contenir au moins 3 caractères' })
  @MaxLength(120)
  declare name: string;
}

export class FilterShopsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional({ enum: ShopLevel }) @IsOptional() @IsEnum(ShopLevel, { message: 'Niveau invalide' }) level?: ShopLevel;
  @ApiPropertyOptional({ enum: ShopStatus, description: 'Admin uniquement' }) @IsOptional() @IsEnum(ShopStatus, { message: 'Statut invalide' }) status?: ShopStatus;
  @ApiPropertyOptional() @IsOptional() @IsUUID('4') categoryId?: string;
  @ApiPropertyOptional({ enum: ['followers', 'rating', 'recent', 'name'] }) @IsOptional() @IsIn(['followers', 'rating', 'recent', 'name']) sortBy?: 'followers' | 'rating' | 'recent' | 'name';
  @ApiPropertyOptional() @IsOptional() page?: number;
  @ApiPropertyOptional() @IsOptional() limit?: number;
}

export class AdminShopStatusDto {
  @ApiProperty({ enum: ShopStatus })
  @IsEnum(ShopStatus, { message: 'Statut de boutique invalide' })
  status: ShopStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AdminShopLevelDto {
  @ApiProperty({ enum: ShopLevel, description: 'founder = attribution manuelle auditée ; autre = retrait du statut Fondateur' })
  @IsEnum(ShopLevel, { message: 'Niveau invalide' })
  level: ShopLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AdminIdentityDto {
  @ApiProperty()
  @IsBoolean({ message: 'verified doit être un booléen' })
  verified: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

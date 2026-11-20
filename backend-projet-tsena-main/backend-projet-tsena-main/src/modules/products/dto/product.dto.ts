import {
  IsString,
  IsOptional,
  IsNumber,
  IsUUID,
  IsBoolean,
  IsArray,
  IsEnum,
  Min,
  Max,
  MaxLength,
  MinLength,
  ValidateNested,
  IsNotEmpty,
  ArrayMaxSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ProductStatus } from '../../../database/entities/role.enum';

export class CreateProductImageDto {
  @ApiProperty({ description: 'URL de l\'image' })
  @IsString({ message: 'L\'URL de l\'image doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'L\'URL de l\'image est obligatoire' })
  url: string;

  @ApiPropertyOptional({ description: 'Texte alternatif (accessibilité)' })
  @IsString({ message: 'Le texte alternatif doit être une chaîne de caractères' })
  @IsOptional()
  alt?: string;

  @ApiPropertyOptional({ description: 'Ordre d\'affichage', default: 0 })
  @IsNumber({}, { message: 'L\'ordre d\'affichage doit être un nombre' })
  @Min(0, { message: 'L\'ordre d\'affichage ne peut pas être négatif' })
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Image principale', default: false })
  @IsBoolean({ message: 'Le champ image principale doit être vrai ou faux' })
  @IsOptional()
  isPrimary?: boolean;
}

export class CreateProductDto {
  @ApiProperty({ description: 'Nom du produit', example: 'Riz parfumé Basmati 5kg' })
  @IsString({ message: 'Le nom du produit doit être une chaîne de caractères' })
  @MinLength(3, { message: 'Le nom du produit doit contenir au moins 3 caractères' })
  @MaxLength(200, { message: 'Le nom du produit ne peut pas dépasser 200 caractères' })
  name: string;

  @ApiPropertyOptional({ description: 'Slug URL (auto-généré si non fourni)' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  slug?: string;

  @ApiPropertyOptional({ description: 'Description courte du produit' })
  @IsString({ message: 'La description courte doit être une chaîne de caractères' })
  @IsOptional()
  @MaxLength(500, { message: 'La description courte ne peut pas dépasser 500 caractères' })
  shortDescription?: string;

  @ApiPropertyOptional({ description: 'Description détaillée du produit' })
  @IsString({ message: 'La description doit être une chaîne de caractères' })
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Prix du produit en Ariary', example: 25000 })
  @IsNumber({}, { message: 'Le prix doit être un nombre' })
  @Min(0, { message: 'Le prix ne peut pas être négatif' })
  @Max(999999999, { message: 'Le prix est trop élevé' })
  price: number;

  @ApiPropertyOptional({ description: 'Prix comparé avant réduction', example: 30000 })
  @IsNumber({}, { message: 'Le prix comparé doit être un nombre' })
  @Min(0, { message: 'Le prix comparé ne peut pas être négatif' })
  @IsOptional()
  compareAtPrice?: number;

  @ApiPropertyOptional({ description: 'Coût d\'achat (pour calcul de marge)' })
  @IsNumber({}, { message: 'Le coût d\'achat doit être un nombre' })
  @Min(0, { message: 'Le coût d\'achat ne peut pas être négatif' })
  @IsOptional()
  costPrice?: number;

  @ApiProperty({ description: 'ID de la catégorie du produit' })
  @IsUUID('4', { message: 'L\'ID de la catégorie doit être un UUID valide' })
  @IsNotEmpty({ message: 'La catégorie est obligatoire' })
  categoryId: string;

  @ApiPropertyOptional({ description: 'SKU (référence unique)', example: 'RIZ-BAS-5KG' })
  @IsString()
  @IsOptional()
  @MaxLength(100, { message: 'Le SKU ne peut pas dépasser 100 caractères' })
  sku?: string;

  @ApiPropertyOptional({ description: 'Stock disponible', default: 0 })
  @IsNumber({}, { message: 'Le stock doit être un nombre' })
  @Min(0, { message: 'Le stock ne peut pas être négatif' })
  @Max(999999, { message: 'Le stock est trop élevé' })
  @IsOptional()
  stockQuantity?: number;

  @ApiPropertyOptional({ description: 'Seuil d\'alerte de stock bas', default: 5 })
  @IsNumber({}, { message: 'Le seuil d\'alerte doit être un nombre' })
  @Min(0, { message: 'Le seuil d\'alerte ne peut pas être négatif' })
  @IsOptional()
  lowStockThreshold?: number;

  @ApiPropertyOptional({ description: 'Poids en kg' })
  @IsNumber({}, { message: 'Le poids doit être un nombre' })
  @Min(0, { message: 'Le poids ne peut pas être négatif' })
  @Max(1000, { message: 'Le poids ne peut pas dépasser 1000 kg' })
  @IsOptional()
  weight?: number;

  @ApiPropertyOptional({ description: 'Images du produit' })
  @IsArray({ message: 'Les images doivent être un tableau' })
  @ValidateNested({ each: true })
  @Type(() => CreateProductImageDto)
  @IsOptional()
  images?: CreateProductImageDto[];

  @ApiPropertyOptional({ description: 'Tags du produit', example: ['bio', 'importé'] })
  @IsArray({ message: 'Les tags doivent être un tableau' })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ description: 'Produit en vedette', default: false })
  @IsBoolean({ message: 'Le champ en vedette doit être vrai ou faux' })
  @IsOptional()
  isFeatured?: boolean;

  @ApiPropertyOptional({ description: 'Statut du produit', enum: ProductStatus, default: ProductStatus.DRAFT })
  @IsEnum(ProductStatus, { message: 'Le statut doit être : draft, active, published, archived, ou rejected' })
  @IsOptional()
  status?: ProductStatus;
}

export class UpdateProductDto {
  @ApiPropertyOptional({ description: 'Nom du produit' })
  @IsString({ message: 'Le nom du produit doit être une chaîne de caractères' })
  @MinLength(3, { message: 'Le nom du produit doit contenir au moins 3 caractères' })
  @MaxLength(200, { message: 'Le nom du produit ne peut pas dépasser 200 caractères' })
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Slug URL' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  slug?: string;

  @ApiPropertyOptional({ description: 'Description courte' })
  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'La description courte ne peut pas dépasser 500 caractères' })
  shortDescription?: string;

  @ApiPropertyOptional({ description: 'Description détaillée' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Prix du produit' })
  @IsNumber({}, { message: 'Le prix doit être un nombre' })
  @Min(0, { message: 'Le prix ne peut pas être négatif' })
  @Max(999999999, { message: 'Le prix est trop élevé' })
  @IsOptional()
  price?: number;

  @ApiPropertyOptional({ description: 'Prix comparé avant réduction' })
  @IsNumber({}, { message: 'Le prix comparé doit être un nombre' })
  @Min(0, { message: 'Le prix comparé ne peut pas être négatif' })
  @IsOptional()
  compareAtPrice?: number;

  @ApiPropertyOptional({ description: 'ID de la catégorie' })
  @IsUUID('4', { message: 'L\'ID de la catégorie doit être un UUID valide' })
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'SKU' })
  @IsString()
  @IsOptional()
  @MaxLength(100, { message: 'Le SKU ne peut pas dépasser 100 caractères' })
  sku?: string;

  @ApiPropertyOptional({ description: 'Stock disponible' })
  @IsNumber({}, { message: 'Le stock doit être un nombre' })
  @Min(0, { message: 'Le stock ne peut pas être négatif' })
  @IsOptional()
  stockQuantity?: number;

  @ApiPropertyOptional({ description: 'Tags' })
  @IsArray({ message: 'Les tags doivent être un tableau' })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ description: 'Produit en vedette' })
  @IsBoolean({ message: 'Le champ en vedette doit être vrai ou faux' })
  @IsOptional()
  isFeatured?: boolean;

  @ApiPropertyOptional({ description: 'Statut du produit' })
  @IsEnum(ProductStatus, { message: 'Le statut doit être : draft, active, published, archived, ou rejected' })
  @IsOptional()
  status?: ProductStatus;
}

export class FilterProductDto {
  @ApiPropertyOptional({ description: 'Recherche par nom ou description' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Filtrer par catégorie' })
  @IsUUID('4', { message: 'L\'ID de la catégorie doit être un UUID valide' })
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Prix minimum' })
  @IsNumber({}, { message: 'Le prix minimum doit être un nombre' })
  @Min(0, { message: 'Le prix minimum ne peut pas être négatif' })
  @IsOptional()
  @Type(() => Number)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Prix maximum' })
  @IsNumber({}, { message: 'Le prix maximum doit être un nombre' })
  @Min(0, { message: 'Le prix maximum ne peut pas être négatif' })
  @IsOptional()
  @Type(() => Number)
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'Statut du produit' })
  @IsEnum(ProductStatus, { message: 'Le statut doit être : draft, active, published, archived, ou rejected' })
  @IsOptional()
  status?: ProductStatus;

  @ApiPropertyOptional({ description: 'Vendeur (ID)' })
  @IsUUID('4', { message: 'L\'ID du vendeur doit être un UUID valide' })
  @IsOptional()
  sellerId?: string;

  @ApiPropertyOptional({ description: 'En vedette uniquement' })
  @IsBoolean({ message: 'Le champ en vedette doit être vrai ou faux' })
  @IsOptional()
  @Type(() => Boolean)
  isFeatured?: boolean;

  @ApiPropertyOptional({ description: 'En stock uniquement' })
  @IsBoolean({ message: 'Le champ en stock doit être vrai ou faux' })
  @IsOptional()
  @Type(() => Boolean)
  inStock?: boolean;

  @ApiPropertyOptional({ description: 'Tags à filtrer (séparés par virgule)' })
  @IsString()
  @IsOptional()
  tags?: string;

  @ApiPropertyOptional({ description: 'Localisation : ville de la boutique du vendeur (voir GET /products/locations)' })
  @IsString()
  @IsOptional()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({ description: 'Trier par: name, price, createdAt, updatedAt, stockQuantity, salesCount (popularité), averageRating' })
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({ description: 'Ordre: ASC, DESC' })
  @IsString()
  @IsOptional()
  order?: 'ASC' | 'DESC';

  @ApiPropertyOptional({ description: 'Page', example: 1 })
  @IsNumber({}, { message: 'Le numéro de page doit être un nombre' })
  @Min(1, { message: 'Le numéro de page doit être au moins 1' })
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ description: 'Nombre par page', example: 20 })
  @IsNumber({}, { message: 'Le nombre par page doit être un nombre' })
  @Min(1, { message: 'Le nombre par page doit être au moins 1' })
  @Max(100, { message: 'Le nombre par page ne peut pas dépasser 100' })
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}

export class ReorderProductImagesDto {
  @ApiProperty({ description: 'Identifiants des images dans l\'ordre d\'affichage souhaité', type: [String] })
  @IsArray({ message: 'La liste des images doit être un tableau' })
  @ArrayMaxSize(10, { message: 'Un produit accepte au maximum 10 images' })
  @IsUUID('4', { each: true, message: 'Identifiant d\'image invalide' })
  imageIds: string[];
}

import { IsUUID, IsString, IsOptional, IsNumber, IsBoolean, Min, Max, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateReviewDto {
  @ApiProperty({ description: 'ID de la commande' })
  @IsUUID()
  orderId: string;

  @ApiProperty({ description: 'ID de l\'utilisateur évalué (vendeur ou acheteur)' })
  @IsUUID()
  reviewedId: string;

  @ApiProperty({ description: 'Note (1 à 5)', minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  rating: number;

  @ApiPropertyOptional({ description: 'Commentaire' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  comment?: string;

  @ApiPropertyOptional({ description: 'Note du produit (1 à 5)', minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  @IsOptional()
  @Type(() => Number)
  productRating?: number;

  @ApiPropertyOptional({ description: 'Note de la livraison (1 à 5)', minimum: 1, maximum: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  @IsOptional()
  @Type(() => Number)
  deliveryRating?: number;

  @ApiPropertyOptional({ description: 'Produit concerné par la note produit (doit appartenir à la commande)' })
  @IsUUID()
  @IsOptional()
  productId?: string;
}

export class SellerReplyDto {
  @ApiProperty({ description: 'Réponse publique du vendeur' })
  @IsString()
  @MinLength(2, { message: 'La réponse doit contenir au moins 2 caractères' })
  @MaxLength(1000)
  reply: string;
}

export class ReportReviewDto {
  @ApiProperty({ description: 'Motif du signalement' })
  @IsString()
  @MinLength(5, { message: 'Le motif doit contenir au moins 5 caractères' })
  @MaxLength(500)
  reason: string;
}

export class ModerateReviewDto {
  @ApiProperty({ description: 'Masquer (false) ou rétablir (true) l\'avis' })
  @IsBoolean()
  isVisible: boolean;

  @ApiPropertyOptional({ description: 'Motif de modération (audité)' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}

export class UpdateReviewDto {
  @ApiPropertyOptional({ description: 'Nouvelle note (1 à 5)' })
  @IsNumber()
  @Min(1)
  @Max(5)
  @IsOptional()
  @Type(() => Number)
  rating?: number;

  @ApiPropertyOptional({ description: 'Nouveau commentaire' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  comment?: string;

  @ApiPropertyOptional({ description: 'Visible publiquement' })
  @IsBoolean()
  @IsOptional()
  isVisible?: boolean;
}

export class FilterReviewDto {
  @ApiPropertyOptional({ description: 'ID du reviewer' })
  @IsUUID()
  @IsOptional()
  reviewerId?: string;

  @ApiPropertyOptional({ description: 'ID du reviewed' })
  @IsUUID()
  @IsOptional()
  reviewedId?: string;

  @ApiPropertyOptional({ description: 'Avis portant sur un produit' })
  @IsUUID()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional({ description: 'Admin : uniquement les avis signalés' })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  reported?: boolean;

  @ApiPropertyOptional({ description: 'Admin : inclure les avis masqués' })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  includeHidden?: boolean;

  @ApiPropertyOptional({ description: 'Note minimale' })
  @IsNumber()
  @Min(1)
  @Max(5)
  @IsOptional()
  @Type(() => Number)
  minRating?: number;

  @ApiPropertyOptional({ description: 'Note maximale' })
  @IsNumber()
  @Min(1)
  @Max(5)
  @IsOptional()
  @Type(() => Number)
  maxRating?: number;

  @ApiPropertyOptional({ description: 'Page', example: 1 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ description: 'Nombre par page', example: 20 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}

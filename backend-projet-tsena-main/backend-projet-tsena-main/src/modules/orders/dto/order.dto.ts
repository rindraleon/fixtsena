import { IsUUID, IsString, IsOptional, IsNumber, IsEnum, Min, Max, MaxLength, IsNotEmpty, IsBoolean, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { OrderStatus } from '../../../database/entities/role.enum';

export class CreateOrderDto {
  @ApiPropertyOptional({ description: 'ID de l\'adresse de livraison' })
  @IsUUID('4', { message: 'L\'ID de l\'adresse doit être un UUID valide' })
  @IsOptional()
  addressId?: string;

  @ApiPropertyOptional({ description: 'Notes pour la commande' })
  @IsString({ message: 'Les notes doivent être une chaîne de caractères' })
  @IsOptional()
  @MaxLength(500, { message: 'Les notes ne peuvent pas dépasser 500 caractères' })
  notes?: string;

  @ApiPropertyOptional({ description: 'Zone de livraison (tarif figé à la création de la commande)' })
  @IsUUID('4', { message: 'La zone de livraison est invalide' })
  @IsOptional()
  deliveryZoneId?: string;

  @ApiPropertyOptional({
    description:
      'Confirmer la commande même si le prix d’un article a changé depuis son ajout au panier (UC-ACH-01). ' +
      'Sans ce drapeau, un changement de prix renvoie 409 PRICE_CHANGED.',
  })
  @IsBoolean({ message: 'acceptPriceChanges doit être un booléen' })
  @IsOptional()
  acceptPriceChanges?: boolean;
}

export class UpdateOrderStatusDto {
  @ApiProperty({
    description: 'Nouveau statut',
    enum: OrderStatus,
  })
  @IsEnum(OrderStatus, {
    message: 'Le statut doit être : pending, confirmed, processing, shipped, delivered, cancelled, refunded, ou in_dispute',
  })
  @IsNotEmpty({ message: 'Le statut est obligatoire' })
  status: OrderStatus;

  @ApiPropertyOptional({ description: 'Transporteur / mode d’acheminement (expédition)' })
  @IsString({ message: 'Le transporteur doit être une chaîne de caractères' })
  @IsOptional()
  @MaxLength(80, { message: 'Le transporteur ne peut pas dépasser 80 caractères' })
  carrier?: string;

  @ApiPropertyOptional({ description: 'Numéro de suivi du colis (expédition)' })
  @IsString({ message: 'Le numéro de suivi doit être une chaîne de caractères' })
  @IsOptional()
  @MaxLength(80, { message: 'Le numéro de suivi ne peut pas dépasser 80 caractères' })
  trackingNumber?: string;

  @ApiPropertyOptional({ description: 'Date de livraison estimée (ISO 8601)' })
  @IsDateString({}, { message: 'La date de livraison estimée est invalide' })
  @IsOptional()
  estimatedDeliveryAt?: string;

  @ApiPropertyOptional({ description: 'Mode de livraison (livreur, retrait en main propre, transporteur…)' })
  @IsString({ message: 'Le mode de livraison doit être une chaîne de caractères' })
  @IsOptional()
  @MaxLength(60, { message: 'Le mode de livraison ne peut pas dépasser 60 caractères' })
  deliveryMethod?: string;

  @ApiPropertyOptional({ description: 'Commentaire sur le changement de statut' })
  @IsString({ message: 'Le commentaire doit être une chaîne de caractères' })
  @IsOptional()
  @MaxLength(500, { message: 'Le commentaire ne peut pas dépasser 500 caractères' })
  comment?: string;
}

export class FilterOrderDto {
  @ApiPropertyOptional({ description: 'Statut de la commande' })
  @IsEnum(OrderStatus, {
    message: 'Le statut doit être : pending, confirmed, processing, shipped, delivered, cancelled, refunded, ou in_dispute',
  })
  @IsOptional()
  status?: OrderStatus;

  @ApiPropertyOptional({ description: 'ID du vendeur' })
  @IsUUID('4', { message: 'L\'ID du vendeur doit être un UUID valide' })
  @IsOptional()
  sellerId?: string;

  @ApiPropertyOptional({ description: 'ID de l\'acheteur' })
  @IsUUID('4', { message: 'L\'ID de l\'acheteur doit être un UUID valide' })
  @IsOptional()
  buyerId?: string;

  @ApiPropertyOptional({ description: 'Recherche par numéro de commande' })
  @IsString({ message: 'La recherche doit être une chaîne de caractères' })
  @IsOptional()
  @MaxLength(50, { message: 'La recherche ne peut pas dépasser 50 caractères' })
  search?: string;

  @ApiPropertyOptional({ description: 'Date de début (ISO)' })
  @IsString({ message: 'La date de début doit être une chaîne ISO 8601' })
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Date de fin (ISO)' })
  @IsString({ message: 'La date de fin doit être une chaîne ISO 8601' })
  @IsOptional()
  endDate?: string;

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

export enum DeliveryEventStatus {
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  DELIVERY_FAILED = 'delivery_failed',
  RETURNED = 'returned',
}

export class UpdateDeliveryDto {
  @ApiPropertyOptional({ description: 'Nouvel état de l’acheminement', enum: DeliveryEventStatus })
  @IsEnum(DeliveryEventStatus, { message: 'État de livraison invalide (in_transit, delivered, delivery_failed, returned)' })
  @IsOptional()
  status?: DeliveryEventStatus;

  @ApiPropertyOptional({ description: 'Transporteur' })
  @IsString({ message: 'Le transporteur doit être une chaîne de caractères' })
  @IsOptional()
  @MaxLength(80, { message: 'Le transporteur ne peut pas dépasser 80 caractères' })
  carrier?: string;

  @ApiPropertyOptional({ description: 'Numéro de suivi' })
  @IsString({ message: 'Le numéro de suivi doit être une chaîne de caractères' })
  @IsOptional()
  @MaxLength(80, { message: 'Le numéro de suivi ne peut pas dépasser 80 caractères' })
  trackingNumber?: string;

  @ApiPropertyOptional({ description: 'Date de livraison estimée (ISO 8601)' })
  @IsDateString({}, { message: 'La date de livraison estimée est invalide' })
  @IsOptional()
  estimatedDeliveryAt?: string;

  @ApiPropertyOptional({ description: 'Mode de livraison' })
  @IsString({ message: 'Le mode de livraison doit être une chaîne de caractères' })
  @IsOptional()
  @MaxLength(60, { message: 'Le mode de livraison ne peut pas dépasser 60 caractères' })
  deliveryMethod?: string;

  @ApiPropertyOptional({ description: 'Commentaire (motif d’échec, précision…)' })
  @IsString({ message: 'Le commentaire doit être une chaîne de caractères' })
  @IsOptional()
  @MaxLength(500, { message: 'Le commentaire ne peut pas dépasser 500 caractères' })
  comment?: string;
}

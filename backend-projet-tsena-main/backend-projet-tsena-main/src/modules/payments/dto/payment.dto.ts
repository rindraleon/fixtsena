import { IsUUID, IsString, IsOptional, IsNumber, IsEnum, IsIn, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaymentStatus } from '../../../database/entities/role.enum';

export const PAYMENT_METHODS = ['mvola', 'orange_money', 'airtel_money', 'cash_on_delivery'] as const;

export class InitiatePaymentDto {
  @ApiProperty({ description: 'ID de la commande à payer' })
  @IsUUID()
  orderId: string;

  @ApiProperty({ description: 'Méthode de paiement', example: 'mvola', enum: PAYMENT_METHODS })
  @IsIn(PAYMENT_METHODS, { message: 'Méthode de paiement non prise en charge' })
  method: string;
}

export class PaymentCallbackDto {
  @ApiProperty({ description: 'ID de la transaction' })
  @IsString()
  transactionId: string;

  @ApiProperty({ description: 'Statut du paiement', enum: PaymentStatus })
  @IsEnum(PaymentStatus)
  status: PaymentStatus;

  @ApiPropertyOptional({ description: 'Réponse du provider' })
  @IsString()
  @IsOptional()
  providerResponse?: string;
}

export class FilterPaymentDto {
  @ApiPropertyOptional({ description: 'Statut du paiement' })
  @IsEnum(PaymentStatus)
  @IsOptional()
  status?: PaymentStatus;

  @ApiPropertyOptional({ description: 'ID de la commande' })
  @IsUUID()
  @IsOptional()
  orderId?: string;

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

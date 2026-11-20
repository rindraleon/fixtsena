import { IsUUID, IsString, IsOptional, IsEnum, MaxLength, IsNumber, Min, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { DisputeReasonCode } from '../../../database/entities/role.enum';
import { DisputeStatus } from '../../../database/entities/role.enum';

export class CreateDisputeDto {
  @ApiProperty({ description: 'ID de la commande en litige' })
  @IsUUID()
  orderId: string;

  @ApiPropertyOptional({ description: 'Motif normalisé (F-LIT-02)', enum: DisputeReasonCode, default: DisputeReasonCode.OTHER })
  @IsEnum(DisputeReasonCode, { message: 'Motif de litige invalide' })
  @IsOptional()
  reasonCode?: DisputeReasonCode;

  @ApiProperty({ description: 'Description détaillée du problème' })
  @IsString()
  @MaxLength(1000)
  reason: string;
}

export class AddEvidenceDto {
  @ApiProperty({ description: 'URL de la preuve (image/document)' })
  @IsString()
  url: string;

  @ApiPropertyOptional({ description: 'Description de la preuve' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}

export class ResolveDisputeDto {
  @ApiProperty({ description: 'Décision du litige', enum: ['resolved_buyer', 'resolved_seller', 'partial_resolution'] })
  @IsIn(['resolved_buyer', 'resolved_seller', 'partial_resolution'], { message: 'Décision invalide : resolved_buyer, resolved_seller ou partial_resolution' })
  decision: 'resolved_buyer' | 'resolved_seller' | 'partial_resolution';

  @ApiProperty({ description: 'Explication de la décision' })
  @IsString()
  @MaxLength(2000)
  adminDecision: string;

  @ApiPropertyOptional({ description: 'Pourcentage de remboursement (0-100, pour partial_resolution)', example: 50 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  refundPercentage?: number;
}

export class FilterDisputeDto {
  @ApiPropertyOptional({ description: 'Statut du litige' })
  @IsEnum(DisputeStatus)
  @IsOptional()
  status?: DisputeStatus;

  @ApiPropertyOptional({ description: 'ID de la commande' })
  @IsUUID()
  @IsOptional()
  orderId?: string;

  @ApiPropertyOptional({ description: 'ID du rapporteur' })
  @IsUUID()
  @IsOptional()
  reporterId?: string;

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

export enum DisputeStatusAction {
  OPEN = 'open',
  UNDER_REVIEW = 'under_review',
  AWAITING_EVIDENCE = 'awaiting_evidence',
  CLOSED = 'closed',
  CANCELLED = 'cancelled',
}

export class UpdateDisputeStatusDto {
  @ApiProperty({ description: 'Nouvel état du dossier', enum: DisputeStatusAction })
  @IsEnum(DisputeStatusAction, { message: 'État de litige invalide (open, under_review, awaiting_evidence, closed, cancelled)' })
  status: DisputeStatusAction;

  @ApiPropertyOptional({ description: 'Note / demande adressée aux parties (obligatoire pour une demande d’informations)' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  note?: string;
}

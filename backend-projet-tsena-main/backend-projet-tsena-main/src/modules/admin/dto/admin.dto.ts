import { IsUUID, IsString, IsOptional, IsNumber, Min, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class RejectProductDto {
  @IsString({ message: 'Le motif doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le motif de rejet est obligatoire' })
  @MaxLength(500, { message: 'Le motif ne peut pas dépasser 500 caractères' })
  reason: string;
}

export class FilterAuditLogDto {
  @ApiPropertyOptional({ description: 'ID de l\'utilisateur' })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ description: 'Action effectuée' })
  @IsString()
  @IsOptional()
  action?: string;

  @ApiPropertyOptional({ description: 'Entité concernée' })
  @IsString()
  @IsOptional()
  entity?: string;

  @ApiPropertyOptional({ description: 'ID de l\'entité' })
  @IsUUID()
  @IsOptional()
  entityId?: string;

  @ApiPropertyOptional({ description: 'Date de début (ISO)' })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Date de fin (ISO)' })
  @IsString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Page', example: 1 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ description: 'Nombre par page', example: 50 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}

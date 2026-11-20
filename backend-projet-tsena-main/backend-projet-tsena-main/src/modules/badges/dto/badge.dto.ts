import { IsString, IsOptional, IsBoolean, IsObject, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBadgeDto {
  @ApiProperty({ description: 'Nom du badge', example: 'Vendeur Vérifié' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Description du badge' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'URL de l\'icône' })
  @IsString()
  @IsOptional()
  iconUrl?: string;

  @ApiPropertyOptional({ description: 'Critères d\'attribution (JSON)' })
  @IsObject()
  @IsOptional()
  criteria?: object;

  @ApiPropertyOptional({ description: 'Badge actif', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateBadgeDto {
  @ApiPropertyOptional({ description: 'Nom du badge' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Description' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'URL de l\'icône' })
  @IsString()
  @IsOptional()
  iconUrl?: string;

  @ApiPropertyOptional({ description: 'Critères' })
  @IsObject()
  @IsOptional()
  criteria?: object;

  @ApiPropertyOptional({ description: 'Actif' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class AwardBadgeDto {
  @ApiPropertyOptional({ description: 'Badge actif' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

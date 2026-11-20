import { IsUUID, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEscrowDto {
  @ApiProperty({ description: 'ID du paiement' })
  @IsUUID()
  paymentId: string;

  @ApiProperty({ description: 'ID de la commande' })
  @IsUUID()
  orderId: string;
}

export class BlockEscrowDto {
  @ApiProperty({ description: 'Raison du blocage' })
  @IsString()
  reason: string;
}

export class ReleaseEscrowDto {
  @ApiPropertyOptional({ description: 'ID du destinataire (vendeur)' })
  @IsUUID()
  @IsOptional()
  releasedTo?: string;
}

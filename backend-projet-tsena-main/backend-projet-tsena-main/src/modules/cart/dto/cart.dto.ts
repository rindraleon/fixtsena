import { IsUUID, IsNumber, Min, Max, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AddToCartDto {
  @ApiProperty({ description: 'ID du produit à ajouter' })
  @IsUUID('4', { message: 'L\'ID du produit doit être un UUID valide' })
  @IsNotEmpty({ message: 'L\'ID du produit est obligatoire' })
  productId: string;

  @ApiProperty({ description: 'Quantité à ajouter', default: 1, minimum: 1 })
  @IsNumber({}, { message: 'La quantité doit être un nombre' })
  @Min(1, { message: 'La quantité minimale est de 1' })
  @Max(99, { message: 'La quantité maximale est de 99 par article' })
  @Type(() => Number)
  quantity: number;
}

export class UpdateCartItemDto {
  @ApiProperty({ description: 'Nouvelle quantité', minimum: 1 })
  @IsNumber({}, { message: 'La quantité doit être un nombre' })
  @Min(1, { message: 'La quantité minimale est de 1' })
  @Max(99, { message: 'La quantité maximale est de 99 par article' })
  @Type(() => Number)
  quantity: number;
}

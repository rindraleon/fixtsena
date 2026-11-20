import { IsEmail, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class SendTestMailDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Adresse e-mail de destination invalide' })
  to?: string;
}

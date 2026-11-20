import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { CommissionsService } from './commissions.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CommissionTier, UserRole } from '../../database/entities/role.enum';

export class UpsertRateDto {
  @ValidateIf((o) => o.categoryId !== null && o.categoryId !== undefined) @IsUUID('4', { message: 'Identifiant de catégorie invalide' }) categoryId?: string | null;
  @IsEnum(CommissionTier, { message: 'Palier invalide (new, verified, big_seller)' }) tier: CommissionTier;
  @IsNumber({}, { message: 'Le taux doit être un nombre' }) @Min(0) @Max(50) ratePercent: number;
  @IsOptional() @IsString() validFrom?: string | null;
  @IsOptional() @IsString() validTo?: string | null;
}

export class SaveZoneDto {
  @IsString() @MaxLength(80) name: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string | null;
  @IsNumber({}, { message: 'Le prix doit être un nombre' }) @Min(0) price: number;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

@ApiTags('commissions')
@Controller()
export class CommissionsController {
  constructor(private readonly commissionsService: CommissionsService) {}

  @Public()
  @Get('delivery-zones')
  @ApiOperation({ summary: 'Zones de livraison actives et tarifs' })
  async zones() {
    return { success: true, message: 'Zones de livraison', data: await this.commissionsService.zones(false) };
  }

  @Get('commissions/preview')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Aperçu commission / net vendeur pour un prix et une catégorie' })
  async preview(@CurrentUser() user: { id: string }, @Query('categoryId') categoryId?: string, @Query('price') price?: string, @Query('sellerId') sellerId?: string) {
    const quote = await this.commissionsService.quote(sellerId || user.id, categoryId || null);
    const amount = Number(price) || 0;
    const computed = this.commissionsService.compute(amount, quote.ratePercent);
    return { success: true, message: 'Aperçu de commission', data: { ...quote, price: amount, ...computed } };
  }

  @Get('admin/commissions')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  async grid() {
    return { success: true, message: 'Grille de commission', data: await this.commissionsService.grid() };
  }

  @Put('admin/commissions')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Créer / modifier un taux (catégorie × palier) — les commandes passées ne changent pas' })
  async upsert(@Body() dto: UpsertRateDto, @CurrentUser() user: { id: string }) {
    return { success: true, message: 'Taux enregistré', data: await this.commissionsService.upsertRate(user.id, { ...dto, categoryId: dto.categoryId ?? null }) };
  }

  @Delete('admin/commissions/:categoryId/:tier')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async removeRate(@Param('categoryId') categoryId: string, @Param('tier') tier: CommissionTier) {
    await this.commissionsService.removeRate(categoryId, tier);
    return { success: true, message: 'Taux supprimé (retour au taux par défaut)' };
  }

  @Post('admin/commissions/seed')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Réinitialiser la grille à partir du cahier des charges' })
  async seed() {
    const count = await this.commissionsService.seedGrid();
    return { success: true, message: `Grille réinitialisée (${count} lignes)`, data: await this.commissionsService.grid() };
  }

  @Get('admin/delivery-zones')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  async adminZones() {
    return { success: true, message: 'Zones de livraison', data: await this.commissionsService.zones(true) };
  }

  @Post('admin/delivery-zones')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  async createZone(@Body() dto: SaveZoneDto) {
    return { success: true, message: 'Zone créée', data: await this.commissionsService.saveZone(dto) };
  }

  @Put('admin/delivery-zones/:id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  async updateZone(@Param('id') id: string, @Body() dto: SaveZoneDto) {
    return { success: true, message: 'Zone mise à jour', data: await this.commissionsService.saveZone({ ...dto, id }) };
  }

  @Delete('admin/delivery-zones/:id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async removeZone(@Param('id') id: string) {
    await this.commissionsService.removeZone(id);
    return { success: true, message: 'Zone désactivée' };
  }
}

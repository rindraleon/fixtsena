import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { PromotionsService } from './promotions.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PromotionStatus, PromotionType, UserRole } from '../../database/entities/role.enum';
import { SellerShopGuard } from '../../common/guards/seller-shop.guard';

export class CreatePromotionDto {
  @IsUUID('4', { message: 'Identifiant de produit invalide' }) productId: string;
  @IsEnum(PromotionType, { message: 'Type de promotion invalide (boost, highlight, featured)' }) type: PromotionType;
  @IsInt({ message: 'La durée doit être un entier (jours)' }) @Min(1) durationDays: number;
}
export class PayPromotionDto {
  @IsIn(['mvola', 'orange_money', 'airtel_money'], { message: 'Moyen de paiement invalide' }) method: string;
}
export class StopPromotionDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

@ApiTags('promotions')
@Controller()
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Public()
  @Get('promotions/offers')
  @ApiOperation({ summary: 'Offres de promotion (public : tarifs catalogue)' })
  offers() {
    return { success: true, message: 'Offres de promotion', data: this.promotionsService.offers(null) };
  }

  @Get('promotions/offers/me')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Offres avec remise selon mon niveau de boutique' })
  async myOffers(@CurrentUser() user: { id: string }) {
    return { success: true, message: 'Offres de promotion', data: await this.promotionsService.offersForSeller(user.id) };
  }

  @Get('promotions/me')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth()
  async mine(@CurrentUser() user: { id: string }) {
    return { success: true, message: 'Mes promotions', data: await this.promotionsService.mine(user.id) };
  }

  @Post('promotions')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @UseGuards(SellerShopGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Acheter une promotion (en attente de paiement)' })
  async create(@Body() dto: CreatePromotionDto, @CurrentUser() user: { id: string }) {
    return { success: true, message: 'Promotion créée : procédez au paiement pour l\'activer', data: await this.promotionsService.create(user.id, dto.productId, dto.type, dto.durationDays) };
  }

  @Post('promotions/:id/pay')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @UseGuards(SellerShopGuard)
  @ApiBearerAuth()
  async pay(@Param('id') id: string, @Body() dto: PayPromotionDto, @CurrentUser() user: { id: string }) {
    return { success: true, message: 'Paiement confirmé : la promotion est active', data: await this.promotionsService.pay(user.id, id, dto.method) };
  }

  @Post('promotions/:id/cancel')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth()
  async cancel(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return { success: true, message: 'Promotion annulée', data: await this.promotionsService.cancelPending(user.id, id) };
  }

  @Get('admin/promotions')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  async adminList(@Query('status') status?: PromotionStatus, @Query('type') type?: PromotionType, @Query('page') page?: string, @Query('limit') limit?: string) {
    const result = await this.promotionsService.adminList({ status, type, page: page ? Number(page) : undefined, limit: limit ? Number(limit) : undefined });
    const totalPages = Math.max(1, Math.ceil(result.total / result.limit));
    return { success: true, message: 'Promotions', data: result.items, meta: { page: result.page, limit: result.limit, total: result.total, totalPages, hasNextPage: result.page < totalPages, hasPreviousPage: result.page > 1 } };
  }

  @Get('admin/promotions/stats')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  async adminStats() {
    return { success: true, message: 'Statistiques promotions', data: await this.promotionsService.adminStats() };
  }

  @Post('admin/promotions/:id/stop')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Arrêter une promotion active (audité)' })
  async stop(@Param('id') id: string, @Body() dto: StopPromotionDto, @CurrentUser() user: { id: string }) {
    return { success: true, message: 'Promotion arrêtée', data: await this.promotionsService.adminStop(user.id, id, dto.reason) };
  }
}

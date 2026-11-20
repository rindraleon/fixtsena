import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { ShopsService } from './shops.service';
import { SubscriptionsService } from './subscriptions.service';
import { UploadService } from '../upload/upload.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SubscriptionPeriod, SubscriptionPlan, SubscriptionStatus, UserRole } from '../../database/entities/role.enum';
import { AdminIdentityDto, AdminShopLevelDto, AdminShopStatusDto, CreateShopDto, FilterShopsDto, UpdateShopDto } from './dto/shop.dto';

type AuthUser = { id: string; roles: UserRole[] };

export class SubscribeDto {
  @IsEnum(SubscriptionPlan, { message: 'Formule invalide (gold ou premium)' }) plan: SubscriptionPlan;
  @IsOptional() @IsEnum(SubscriptionPeriod, { message: 'Période invalide (monthly ou yearly)' }) period?: SubscriptionPeriod;
}
export class PaySubscriptionDto {
  @IsIn(['mvola', 'orange_money', 'airtel_money'], { message: 'Moyen de paiement invalide' }) method: string;
}

function meta(result: { page: number; limit: number; total: number }) {
  const totalPages = Math.max(1, Math.ceil(result.total / result.limit));
  return { page: result.page, limit: result.limit, total: result.total, totalPages, hasNextPage: result.page < totalPages, hasPreviousPage: result.page > 1 };
}

@ApiTags('shops')
@Controller()
export class ShopsController {
  constructor(
    private readonly shopsService: ShopsService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly uploadService: UploadService,
  ) {}

  @Public()
  @Get('shops')
  @ApiOperation({ summary: 'Liste publique des boutiques actives (admin : tous statuts)' })
  async list(@Query() filter: FilterShopsDto, @CurrentUser() user?: AuthUser) {
    const result = await this.shopsService.findPublic(filter, user);
    return { success: true, message: 'Boutiques', data: result.items, meta: meta(result) };
  }

  @Get('shops/me')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ma boutique (vendeur)' })
  async mine(@CurrentUser() user: AuthUser) {
    const shop = await this.shopsService.findMine(user.id);
    return { success: true, message: shop ? 'Ma boutique' : 'Aucune boutique', data: shop };
  }

  @Get('shops/me/eligibility')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Éligibilité aux niveaux Vérifié / Gold / Premium (vendeur)' })
  async eligibility(@CurrentUser() user: AuthUser) {
    return { success: true, message: 'Éligibilité', data: await this.shopsService.eligibilityReport(user.id) };
  }

  @Get('shops/followed')
  @Roles(UserRole.CLIENT, UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Boutiques que je suis' })
  async followed(@CurrentUser() user: AuthUser, @Query('page') page?: string, @Query('limit') limit?: string) {
    const result = await this.shopsService.followedShops(user.id, Math.max(1, Number(page) || 1), Math.min(50, Math.max(1, Number(limit) || 20)));
    return { success: true, message: 'Boutiques suivies', data: result.items, meta: meta(result) };
  }

  @Public()
  @Get('shops/:idOrSlug')
  @ApiOperation({ summary: 'Fiche publique d\'une boutique' })
  async detail(@Param('idOrSlug') idOrSlug: string, @CurrentUser() user?: AuthUser) {
    return { success: true, message: 'Boutique', data: await this.shopsService.findByIdOrSlug(idOrSlug, user) };
  }

  @Post('shops')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Créer ma boutique (brouillon)' })
  async create(@Body() dto: CreateShopDto, @CurrentUser() user: AuthUser) {
    return { success: true, message: 'Boutique créée', data: await this.shopsService.create(user.id, dto) };
  }

  @Patch('shops/me')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Modifier ma boutique' })
  async update(@Body() dto: UpdateShopDto, @CurrentUser() user: AuthUser) {
    return { success: true, message: 'Boutique mise à jour', data: await this.shopsService.updateMine(user.id, dto) };
  }

  @Post('shops/me/submit')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Soumettre ma boutique à vérification' })
  async submit(@CurrentUser() user: AuthUser) {
    return { success: true, message: 'Boutique soumise à vérification', data: await this.shopsService.submitMine(user.id) };
  }

  @Post('shops/me/logo')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Téléverser le logo de ma boutique' })
  async uploadLogo(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthUser) {
    const shop = await this.shopsService.findBySellerId(user.id);
    if (!shop) return { success: false, message: "Vous n'avez pas encore de boutique" };
    const stored = await this.uploadService.uploadShopImage(file, shop.id, 'logo');
    const previous = shop.logoUrl;
    const saved = await this.shopsService.setImage(user.id, 'logo', stored.url);
    await this.uploadService.removeByUrl(previous);
    return { success: true, message: 'Logo mis à jour', data: { logoUrl: saved.logoUrl } };
  }

  @Post('shops/me/cover')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Téléverser l\'image de couverture de ma boutique' })
  async uploadCover(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthUser) {
    const shop = await this.shopsService.findBySellerId(user.id);
    if (!shop) return { success: false, message: "Vous n'avez pas encore de boutique" };
    const stored = await this.uploadService.uploadShopImage(file, shop.id, 'cover');
    const previous = shop.coverUrl;
    const saved = await this.shopsService.setImage(user.id, 'cover', stored.url);
    await this.uploadService.removeByUrl(previous);
    return { success: true, message: 'Image de couverture mise à jour', data: { coverUrl: saved.coverUrl } };
  }

  @Post('shops/:id/follow')
  @Roles(UserRole.CLIENT, UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Suivre une boutique' })
  async follow(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return { success: true, message: 'Vous suivez cette boutique', data: await this.shopsService.follow(user.id, id) };
  }

  @Delete('shops/:id/follow')
  @Roles(UserRole.CLIENT, UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ne plus suivre une boutique' })
  async unfollow(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return { success: true, message: 'Vous ne suivez plus cette boutique', data: await this.shopsService.unfollow(user.id, id) };
  }

  @Public()
  @Get('subscriptions/plans')
  @ApiOperation({ summary: 'Formules Gold / Premium (prix, places restantes, avantages)' })
  async plans() {
    return { success: true, message: 'Formules', data: await this.subscriptionsService.plans() };
  }

  @Get('subscriptions/me')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mon abonnement (courant, en attente, historique)' })
  async mySubscription(@CurrentUser() user: AuthUser) {
    return { success: true, message: 'Mon abonnement', data: await this.subscriptionsService.mine(user.id) };
  }

  @Post('subscriptions')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Souscrire une formule (en attente de paiement)' })
  async subscribe(@Body() dto: SubscribeDto, @CurrentUser() user: AuthUser) {
    const created = await this.subscriptionsService.subscribe(user.id, dto.plan, dto.period ?? SubscriptionPeriod.MONTHLY);
    return { success: true, message: created.changeMessage, data: created };
  }

  @Get('subscriptions/preview')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Nature du changement induit par une formule (nouveau, renouvellement, montée en gamme, rétrogradation programmée)' })
  async previewChange(@Query('plan') plan: SubscriptionPlan, @CurrentUser() user: AuthUser) {
    if (!Object.values(SubscriptionPlan).includes(plan)) throw new BadRequestException('Formule invalide (gold ou premium)');
    return { success: true, message: 'Aperçu du changement', data: await this.subscriptionsService.previewChange(user.id, plan) };
  }

  @Post('subscriptions/:id/pay')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Payer un abonnement (mobile money simulé) → activation' })
  async pay(@Param('id') id: string, @Body() dto: PaySubscriptionDto, @CurrentUser() user: AuthUser) {
    const paid = await this.subscriptionsService.pay(user.id, id, dto.method);
    const message = paid.status === SubscriptionStatus.SCHEDULED
      ? `Paiement confirmé : votre abonnement prendra effet le ${paid.startsAt?.toLocaleDateString('fr-FR')}`
      : 'Paiement confirmé : votre abonnement est actif';
    return { success: true, message, data: paid };
  }

  @Post('subscriptions/:id/cancel')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Annuler un abonnement en attente de paiement' })
  async cancel(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return { success: true, message: 'Abonnement annulé', data: await this.subscriptionsService.cancelPending(user.id, id) };
  }

  @Get('admin/shops/stats')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  async adminStats() {
    return { success: true, message: 'Statistiques boutiques', data: await this.shopsService.adminStats() };
  }

  @Patch('admin/shops/:id/status')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Changer le statut d\'une boutique (activer, suspendre, désactiver, archiver)' })
  async adminStatus(@Param('id') id: string, @Body() dto: AdminShopStatusDto, @CurrentUser() user: AuthUser) {
    return { success: true, message: 'Statut de la boutique mis à jour', data: await this.shopsService.adminSetStatus(user.id, id, dto) };
  }

  @Patch('admin/shops/:id/identity')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Marquer l\'identité du vendeur comme vérifiée (ou retirer)' })
  async adminIdentity(@Param('id') id: string, @Body() dto: AdminIdentityDto, @CurrentUser() user: AuthUser) {
    return { success: true, message: dto.verified ? 'Identité vérifiée' : 'Vérification d\'identité retirée', data: await this.shopsService.adminSetIdentity(user.id, id, dto) };
  }

  @Patch('admin/shops/:id/level')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Attribuer / retirer le niveau Fondateur (audité)' })
  async adminLevel(@Param('id') id: string, @Body() dto: AdminShopLevelDto, @CurrentUser() user: AuthUser) {
    return { success: true, message: 'Niveau de la boutique mis à jour', data: await this.shopsService.adminSetLevel(user.id, id, dto) };
  }

  @Get('admin/subscriptions')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  async adminSubscriptions(@Query('status') status?: SubscriptionStatus, @Query('plan') plan?: SubscriptionPlan, @Query('page') page?: string, @Query('limit') limit?: string) {
    const result = await this.subscriptionsService.adminList({ status, plan, page: page ? Number(page) : undefined, limit: limit ? Number(limit) : undefined });
    return { success: true, message: 'Abonnements', data: result.items, meta: meta(result) };
  }
}

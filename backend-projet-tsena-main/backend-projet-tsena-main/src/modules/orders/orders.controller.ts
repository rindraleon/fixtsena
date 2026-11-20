import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderStatusDto,
  UpdateDeliveryDto, FilterOrderDto } from './dto/order.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../database/entities/role.enum';
import { SellerShopGuard } from '../../common/guards/seller-shop.guard';

@ApiTags('orders')
@Controller('orders')
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Roles(UserRole.CLIENT, UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Créer une commande depuis le panier' })
  async createOrder(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateOrderDto,
  ) {
    const orders = await this.ordersService.createOrdersFromCart(user.id, dto);
    return {
      success: true,
      message: `${orders.length} commande(s) créée(s) avec succès`,
      data: orders.map((order) => this.ordersService.forViewer(order, user.id, [])),
    };
  }

  @Get()
  @Roles(UserRole.CLIENT, UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Lister mes commandes' })
  async findAll(
    @Query() filters: FilterOrderDto,
    @CurrentUser() user: { id: string; roles: UserRole[] },
  ) {
    const result = await this.ordersService.findAll(filters, user.id, user.roles);
    return {
      success: true,
      message: 'Commandes récupérées avec succès',
      data: result.items.map((order) => this.ordersService.forViewer(order, user.id, user.roles)),
      meta: result.meta,
    };
  }

  @Get('checkout/quote')
  @Roles(UserRole.CLIENT, UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Récapitulatif du panier avant validation (frais de livraison par zone)' })
  async checkoutQuote(
    @CurrentUser() user: { id: string },
    @Query('deliveryZoneId') deliveryZoneId?: string,
  ) {
    const quote = await this.ordersService.checkoutQuote(user.id, deliveryZoneId);
    return {
      success: true,
      message: 'Récapitulatif calculé',
      data: quote,
    };
  }

  @Get('seller/stats')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Statistiques commandes vendeur' })
  async getSellerStats(@CurrentUser() user: { id: string }) {
    const stats = await this.ordersService.getSellerStats(user.id);
    return {
      success: true,
      message: 'Statistiques vendeur récupérées avec succès',
      data: stats,
    };
  }

  @Get('buyer/stats')
  @Roles(UserRole.CLIENT, UserRole.BUYER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Statistiques commandes acheteur' })
  async getBuyerStats(@CurrentUser() user: { id: string }) {
    const stats = await this.ordersService.getBuyerStats(user.id);
    return {
      success: true,
      message: 'Statistiques acheteur récupérées avec succès',
      data: stats,
    };
  }

  @Get('number/:orderNumber')
  @Roles(UserRole.CLIENT, UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Trouver une commande par numéro' })
  async findByOrderNumber(
    @Param('orderNumber') orderNumber: string,
    @CurrentUser() user: { id: string; roles: UserRole[] },
  ) {
    const order = await this.ordersService.findByOrderNumber(orderNumber);
    this.ordersService.assertCanView(order, user.id, user.roles);
    return {
      success: true,
      message: 'Commande récupérée avec succès',
      data: order,
    };
  }

  @Get(':id')
  @Roles(UserRole.CLIENT, UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Détail d\'une commande' })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; roles: UserRole[] },
  ) {
    const order = await this.ordersService.findById(id);
    this.ordersService.assertCanView(order, user.id, user.roles);

    return {
      success: true,
      message: 'Commande récupérée avec succès',
      data: this.ordersService.forViewer(order, user.id, user.roles),
    };
  }

  @Patch(':id/status')
  @Roles(UserRole.CLIENT, UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Mettre à jour le statut d\'une commande' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: { id: string; roles: UserRole[] },
  ) {
    const order = await this.ordersService.updateStatus(id, dto, user.id, user.roles);
    return {
      success: true,
      message: `Commande mise à jour: ${order.status}`,
      data: this.ordersService.forViewer(order, user.id, user.roles),
    };
  }

  @Patch(':id/delivery')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @UseGuards(SellerShopGuard)
  @ApiOperation({ summary: 'Mettre à jour le suivi de livraison (transporteur, n° de suivi, événement d’acheminement)' })
  async updateDelivery(
    @Param('id') id: string,
    @Body() dto: UpdateDeliveryDto,
    @CurrentUser() user: { id: string; roles: UserRole[] },
  ) {
    const order = await this.ordersService.updateDelivery(id, dto, user.id, user.roles);
    return {
      success: true,
      message: 'Suivi de livraison mis à jour',
      data: this.ordersService.forViewer(order, user.id, user.roles),
    };
  }
}

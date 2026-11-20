import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { AddToCartDto, UpdateCartItemDto } from './dto/cart.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../database/entities/role.enum';

@ApiTags('cart')
@Controller('cart')
@ApiBearerAuth()
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @Roles(UserRole.CLIENT, UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Obtenir le panier de l\'utilisateur' })
  async getCart(@CurrentUser() user: { id: string }) {
    const result = await this.cartService.getCart(user.id);
    return {
      success: true,
      message: 'Panier récupéré avec succès',
      data: result,
    };
  }

  @Get('count')
  @Roles(UserRole.CLIENT, UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Compter les articles du panier' })
  async getCartCount(@CurrentUser() user: { id: string }) {
    const count = await this.cartService.getCartItemCount(user.id);
    return {
      success: true,
      message: 'Nombre d\'articles récupéré',
      data: { count },
    };
  }

  @Post('items')
  @Roles(UserRole.CLIENT, UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Ajouter un article au panier' })
  async addItem(
    @CurrentUser() user: { id: string },
    @Body() dto: AddToCartDto,
  ) {
    const result = await this.cartService.addItem(user.id, dto);
    return {
      success: true,
      message: 'Article ajouté au panier',
      data: result,
    };
  }

  @Patch('items/:itemId')
  @Roles(UserRole.CLIENT, UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Modifier la quantité d\'un article' })
  async updateItem(
    @CurrentUser() user: { id: string },
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    const result = await this.cartService.updateItemQuantity(user.id, itemId, dto);
    return {
      success: true,
      message: 'Quantité mise à jour',
      data: result,
    };
  }

  @Delete('items/:itemId')
  @Roles(UserRole.CLIENT, UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer un article du panier' })
  async removeItem(
    @CurrentUser() user: { id: string },
    @Param('itemId') itemId: string,
  ) {
    const result = await this.cartService.removeItem(user.id, itemId);
    return {
      success: true,
      message: 'Article supprimé du panier',
      data: result,
    };
  }

  @Delete()
  @Roles(UserRole.CLIENT, UserRole.BUYER, UserRole.SELLER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Vider le panier' })
  async clearCart(@CurrentUser() user: { id: string }) {
    const result = await this.cartService.clearCart(user.id);
    return {
      success: true,
      message: 'Panier vidé avec succès',
      data: result,
    };
  }
}

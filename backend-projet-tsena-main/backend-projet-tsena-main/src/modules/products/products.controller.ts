import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import {
  CreateProductDto,
  UpdateProductDto,
  FilterProductDto,
  CreateProductImageDto,
  ReorderProductImagesDto,
} from './dto/product.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../database/entities/role.enum';
import { SellerShopGuard } from '../../common/guards/seller-shop.guard';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @UseGuards(SellerShopGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Créer un produit (vendeur/admin)' })
  async create(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: { id: string; roles: UserRole[] },
  ) {
    const product = await this.productsService.create(dto, user.id, user.roles ?? []);
    return {
      success: true,
      message: 'Produit créé avec succès',
      data: product,
    };
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Lister les produits avec filtres' })
  async findAll(
    @Query() filters: FilterProductDto,
    @CurrentUser() user?: { id: string; roles: UserRole[] },
  ) {
    const result = await this.productsService.findAll(filters, user);
    return {
      success: true,
      message: 'Produits récupérés avec succès',
      data: result.items,
      meta: result.meta,
    };
  }

  @Get('featured')
  @Public()
  @ApiOperation({ summary: 'Produits en vedette' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getFeatured(@Query('limit') limit?: number) {
    const products = await this.productsService.getFeatured(limit ? +limit : 10);
    return {
      success: true,
      message: 'Produits en vedette récupérés avec succès',
      data: products,
    };
  }

  @Get('locations')
  @Public()
  @ApiOperation({ summary: 'Localisations disponibles (villes des boutiques avec produits publiés) — filtre F-CAT-03' })
  async getLocations() {
    const locations = await this.productsService.locations();
    return {
      success: true,
      message: 'Localisations récupérées avec succès',
      data: locations,
    };
  }

  @Get('seller/stats')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Statistiques produits du vendeur connecté' })
  async getSellerStats(@CurrentUser() user: { id: string }) {
    const stats = await this.productsService.getSellerStats(user.id);
    return {
      success: true,
      message: 'Statistiques récupérées avec succès',
      data: stats,
    };
  }

  @Get(':idOrSlug')
  @Public()
  @ApiOperation({ summary: 'Trouver un produit par ID ou slug' })
  async findByIdOrSlug(
    @Param('idOrSlug') idOrSlug: string,
    @CurrentUser() user?: { id: string; roles: UserRole[] },
  ) {
    const product = await this.productsService.findPublic(idOrSlug, user);

    return {
      success: true,
      message: 'Produit récupéré avec succès',
      data: product,
    };
  }

  @Put(':id')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @UseGuards(SellerShopGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mettre à jour un produit' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: { id: string; roles: UserRole[] },
  ) {
    const product = await this.productsService.update(id, dto, user.id, user.roles);
    return {
      success: true,
      message: 'Produit mis à jour avec succès',
      data: product,
    };
  }

  @Delete(':id')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @UseGuards(SellerShopGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer un produit' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; roles: UserRole[] },
  ) {
    await this.productsService.remove(id, user.id, user.roles);
    return {
      success: true,
      message: 'Produit supprimé avec succès',
    };
  }

  @Post(':id/images')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @UseGuards(SellerShopGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ajouter une image à un produit' })
  async addImage(
    @Param('id') id: string,
    @Body() dto: CreateProductImageDto,
    @CurrentUser() user: { id: string; roles: UserRole[] },
  ) {
    const image = await this.productsService.addImage(
      id,
      dto.url,
      dto.alt,
      dto.isPrimary,
      user.id,
      user.roles,
    );
    return {
      success: true,
      message: 'Image ajoutée avec succès',
      data: image,
    };
  }

  @Patch(':id/images/reorder')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @UseGuards(SellerShopGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Réordonner les images de présentation d\'un produit' })
  async reorderImages(
    @Param('id') id: string,
    @Body() dto: ReorderProductImagesDto,
    @CurrentUser() user: { id: string; roles: UserRole[] },
  ) {
    const images = await this.productsService.reorderImages(id, dto.imageIds, user.id, user.roles);
    return {
      success: true,
      message: 'Ordre des images mis à jour',
      data: images,
    };
  }

  @Patch(':id/images/:imageId/primary')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @UseGuards(SellerShopGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Définir une image comme couverture du produit' })
  async setPrimaryImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @CurrentUser() user: { id: string; roles: UserRole[] },
  ) {
    const images = await this.productsService.setPrimaryImage(id, imageId, user.id, user.roles);
    return {
      success: true,
      message: 'Image de couverture mise à jour',
      data: images,
    };
  }

  @Delete(':id/images/:imageId')
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @UseGuards(SellerShopGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer une image d\'un produit' })
  async removeImage(
    @Param('imageId') imageId: string,
    @CurrentUser() user: { id: string; roles: UserRole[] },
  ) {
    await this.productsService.removeImage(imageId, user.id, user.roles);
    return {
      success: true,
      message: 'Image supprimée avec succès',
    };
  }
}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product, ProductImage, Category } from '../../database/entities/catalog.entity';
import { User } from '../../database/entities/user.entity';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ShopsModule } from '../shops/shops.module';
import { SellerShopGuard } from '../../common/guards/seller-shop.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Product, ProductImage, Category, User]), ShopsModule],
  controllers: [ProductsController],
  providers: [ProductsService, SellerShopGuard],
  exports: [ProductsService],
})
export class ProductsModule {}

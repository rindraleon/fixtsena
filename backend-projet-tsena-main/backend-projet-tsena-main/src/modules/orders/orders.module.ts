import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order, OrderLine, Cart, CartItem, Payment, Escrow } from '../../database/entities/transaction.entity';
import { Product } from '../../database/entities/catalog.entity';
import { Address, User } from '../../database/entities/user.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { CartModule } from '../cart/cart.module';
import { ShopsModule } from '../shops/shops.module';
import { SellerShopGuard } from '../../common/guards/seller-shop.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderLine, Cart, CartItem, Product, Address, User, Payment, Escrow]),
    CartModule,
    ShopsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, SellerShopGuard],
  exports: [OrdersService],
})
export class OrdersModule {}

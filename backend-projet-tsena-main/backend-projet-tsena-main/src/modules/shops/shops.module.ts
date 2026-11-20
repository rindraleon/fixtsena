import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SellerSubscription, Shop, ShopFollow } from '../../database/entities/marketplace.entity';
import { User } from '../../database/entities/user.entity';
import { Product } from '../../database/entities/catalog.entity';
import { AuditLog, Dispute, Order } from '../../database/entities/transaction.entity';
import { ShopsService } from './shops.service';
import { SubscriptionsService } from './subscriptions.service';
import { ShopsController } from './shops.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Shop, ShopFollow, SellerSubscription, User, Product, Order, Dispute, AuditLog])],
  controllers: [ShopsController],
  providers: [ShopsService, SubscriptionsService],
  exports: [ShopsService, SubscriptionsService],
})
export class ShopsModule {}

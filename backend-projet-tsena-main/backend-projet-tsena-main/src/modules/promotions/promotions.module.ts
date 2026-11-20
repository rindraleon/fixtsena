import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Promotion, Shop } from '../../database/entities/marketplace.entity';
import { Product } from '../../database/entities/catalog.entity';
import { AuditLog } from '../../database/entities/transaction.entity';
import { PromotionsService } from './promotions.service';
import { PromotionsController } from './promotions.controller';
import { ShopsModule } from '../shops/shops.module';
import { SellerShopGuard } from '../../common/guards/seller-shop.guard';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Promotion, Shop, Product, AuditLog]), ShopsModule],
  controllers: [PromotionsController],
  providers: [PromotionsService, SellerShopGuard],
  exports: [PromotionsService],
})
export class PromotionsModule {}

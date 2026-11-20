import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Shop } from '../../database/entities/marketplace.entity';
import { Delivery, Escrow, Order } from '../../database/entities/transaction.entity';
import { ShopsModule } from '../shops/shops.module';
import { OrdersModule } from '../orders/orders.module';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceController } from './maintenance.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Shop, Order, Delivery, Escrow]), ShopsModule, OrdersModule],
  controllers: [MaintenanceController],
  providers: [MaintenanceService],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}

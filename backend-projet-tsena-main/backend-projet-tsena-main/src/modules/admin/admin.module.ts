import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsModule } from '../products/products.module';
import { User } from '../../database/entities/user.entity';
import { Product } from '../../database/entities/catalog.entity';
import { Order, Payment, Escrow, Dispute, AuditLog } from '../../database/entities/transaction.entity';
import { AdminService } from './admin.service';
import { ReportsService } from './reports.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, Product, Order, Payment, Escrow, Dispute, AuditLog]), ProductsModule],
  controllers: [AdminController],
  providers: [AdminService, ReportsService],
  exports: [AdminService],
})
export class AdminModule {}

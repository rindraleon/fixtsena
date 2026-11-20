import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommissionRate, DeliveryZone, Shop } from '../../database/entities/marketplace.entity';
import { Category } from '../../database/entities/catalog.entity';
import { CommissionsService } from './commissions.service';
import { CommissionsController } from './commissions.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([CommissionRate, DeliveryZone, Shop, Category])],
  controllers: [CommissionsController],
  providers: [CommissionsService],
  exports: [CommissionsService],
})
export class CommissionsModule {}

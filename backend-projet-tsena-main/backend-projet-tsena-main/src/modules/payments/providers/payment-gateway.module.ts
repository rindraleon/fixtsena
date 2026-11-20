import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment, Order, Escrow } from '../../../database/entities/transaction.entity';
import { MVolaProvider } from './mvola.provider';
import { AirtelMoneyProvider } from './airtel.provider';
import { PaymentGatewayService } from './payment-gateway.service';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, Order, Escrow])],
  providers: [MVolaProvider, AirtelMoneyProvider, PaymentGatewayService],
  exports: [PaymentGatewayService, MVolaProvider, AirtelMoneyProvider],
})
export class PaymentGatewayModule {}

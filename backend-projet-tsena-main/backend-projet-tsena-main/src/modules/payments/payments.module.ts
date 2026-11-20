import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment, Escrow, Order } from '../../database/entities/transaction.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PaymentGatewayModule } from './providers/payment-gateway.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Escrow, Order]),
    PaymentGatewayModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService, PaymentGatewayModule],
})
export class PaymentsModule {}

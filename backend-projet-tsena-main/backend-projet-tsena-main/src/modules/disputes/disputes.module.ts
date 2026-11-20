import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../database/entities/user.entity';
import { Dispute, DisputeEvidence, Order, Escrow, Payment } from '../../database/entities/transaction.entity';
import { DisputesService } from './disputes.service';
import { DisputesController } from './disputes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Dispute, DisputeEvidence, Order, Escrow, Payment, User])],
  controllers: [DisputesController],
  providers: [DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}

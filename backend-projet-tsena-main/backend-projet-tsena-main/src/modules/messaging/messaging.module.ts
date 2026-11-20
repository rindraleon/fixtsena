import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation, Message, Shop } from '../../database/entities/marketplace.entity';
import { User } from '../../database/entities/user.entity';
import { Product } from '../../database/entities/catalog.entity';
import { Dispute, Order } from '../../database/entities/transaction.entity';
import { MessagingService } from './messaging.service';
import { MessagingController } from './messaging.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, Message, Shop, User, Product, Order, Dispute])],
  controllers: [MessagingController],
  providers: [MessagingService],
  exports: [MessagingService],
})
export class MessagingModule {}

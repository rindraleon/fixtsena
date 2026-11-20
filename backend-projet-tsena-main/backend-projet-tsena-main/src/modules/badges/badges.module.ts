import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Badge, UserBadge } from '../../database/entities/transaction.entity';
import { User } from '../../database/entities/user.entity';
import { BadgesService } from './badges.service';
import { BadgesController } from './badges.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Badge, UserBadge, User])],
  controllers: [BadgesController],
  providers: [BadgesService],
  exports: [BadgesService],
})
export class BadgesModule {}

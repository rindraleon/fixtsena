import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Profile, User } from '../../database/entities';
import { AdminBootstrapService } from './admin-bootstrap.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Profile])],
  providers: [AdminBootstrapService],
  exports: [AdminBootstrapService],
})
export class AdminBootstrapModule {}

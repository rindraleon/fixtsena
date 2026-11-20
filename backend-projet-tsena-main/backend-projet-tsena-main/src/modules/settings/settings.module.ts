import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformSetting } from '../../database/entities/marketplace.entity';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([PlatformSetting])],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}

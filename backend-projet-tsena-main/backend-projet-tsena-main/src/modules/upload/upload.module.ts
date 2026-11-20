import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { S3ClientService } from './s3.client';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';
import { ProductsModule } from '../products/products.module';
import { StorageService } from './storage/storage.service';

@Global()
@Module({
  imports: [
    ConfigModule,
    ProductsModule,
    MulterModule.register({
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
      storage: undefined,
    }),
  ],
  controllers: [UploadController],
  providers: [S3ClientService, StorageService, UploadService],
  exports: [UploadService, StorageService],
})
export class UploadModule {}

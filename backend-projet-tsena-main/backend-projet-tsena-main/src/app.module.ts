import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ApiThrottlerGuard } from './common/guards/api-throttler.guard';
import { databaseConfig } from './config/database.config';
import { MailModule } from './modules/mail/mail.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ProductsModule } from './modules/products/products.module';
import { UploadModule } from './modules/upload/upload.module';
import { CartModule } from './modules/cart/cart.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { EscrowModule } from './modules/escrow/escrow.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { BadgesModule } from './modules/badges/badges.module';
import { AdminModule } from './modules/admin/admin.module';
import { HealthModule } from './modules/health/health.module';
import { SettingsModule } from './modules/settings/settings.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ShopsModule } from './modules/shops/shops.module';
import { CommissionsModule } from './modules/commissions/commissions.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => databaseConfig(config),
    }),

    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: Number(config.get('THROTTLE_TTL_MS') ?? 60_000),
            limit: Number(config.get('THROTTLE_LIMIT') ?? 300),
          },
        ],
      }),
    }),

    SettingsModule,
    NotificationsModule,

    MailModule,
    AuthModule,
    UsersModule,

    CategoriesModule,
    ProductsModule,

    UploadModule,

    CartModule,
    OrdersModule,
    PaymentsModule,
    EscrowModule,

    DisputesModule,
    ReviewsModule,
    BadgesModule,

    CommissionsModule,
    PromotionsModule,
    ShopsModule,
    MessagingModule,
    AddressesModule,
    MaintenanceModule,

    AdminModule,

    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ApiThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

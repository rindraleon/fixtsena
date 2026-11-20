import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from '../../database/entities/user.entity';
import { PasswordResetToken } from '../../database/entities/password-reset-token.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { EmailValidationService } from './services/email-validation.service';
import { EmailVerificationService } from './services/email-verification.service';
import { PasswordResetService } from './services/password-reset.service';
import { EmailVerifiedGuard } from './guards/email-verified.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, PasswordResetToken]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn:
            config.get<string>('JWT_EXPIRATION') ||
            config.get<string>('JWT_ACCESS_EXPIRES') ||
            '15m',
        },
      }),
    }),
    ConfigModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    EmailValidationService,
    EmailVerificationService,
    PasswordResetService,
    EmailVerifiedGuard,
  ],
  exports: [
    AuthService,
    EmailValidationService,
    EmailVerificationService,
    PasswordResetService,
    EmailVerifiedGuard,
  ],
})
export class AuthModule {}

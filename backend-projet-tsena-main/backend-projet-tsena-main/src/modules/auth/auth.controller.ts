import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  UpdateProfileDto,
} from './dto/auth.dto';
import {
  VerifyEmailDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from './dto/auth-extra.dto';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, IUserPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @Public()
  @ApiOperation({ summary: 'Inscription — crée un compte non vérifié' })
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    const message =
      result.accountType === 'seller'
        ? "Compte créé. Votre demande vendeur sera examinée par un administrateur ; consultez votre e-mail pour vérifier votre adresse."
        : result.accountType === 'admin'
          ? 'Compte administrateur créé. Consultez votre e-mail pour vérifier votre adresse.'
          : 'Compte créé avec succès. Consultez votre e-mail pour vérifier votre adresse.';
    return { success: true, message, data: result };
  }

  @Get('register/options')
  @Public()
  @ApiOperation({ summary: "Types de compte proposés à l'inscription (le rôle admin n'est ouvert qu'au premier compte)" })
  async registerOptions() {
    return { success: true, message: 'OK', data: await this.authService.getRegistrationOptions() };
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Connexion — retourne des tokens JWT' })
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);
    return {
      success: true,
      message: 'Connexion réussie',
      data: result,
    };
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rafraîchir la session — échange un refresh token valide contre de nouveaux tokens (rotation)',
  })
  async refresh(@Body() dto: RefreshTokenDto) {
    const result = await this.authService.refreshToken(dto.refreshToken);
    return {
      success: true,
      message: 'Session rafraîchie',
      data: result,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Déconnexion — invalide le refresh token côté serveur' })
  async logout(@CurrentUser() user: IUserPayload) {
    await this.authService.logout(user.id);
    return {
      success: true,
      message: 'Déconnexion réussie',
      data: null,
    };
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Profil de l'utilisateur connecté" })
  async getProfile(@CurrentUser() user: IUserPayload) {
    const profile = await this.authService.getProfile(user.id);
    return {
      success: true,
      message: 'Profil récupéré avec succès',
      data: profile,
    };
  }

  @Patch('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Mettre à jour le profil de l'utilisateur connecté" })
  async updateProfile(@CurrentUser() user: IUserPayload, @Body() dto: UpdateProfileDto) {
    const profile = await this.authService.updateProfile(user.id, dto);
    return {
      success: true,
      message: 'Profil mis à jour',
      data: profile,
    };
  }

  @Post('verify-email')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Vérifier l'adresse e-mail avec un token" })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    const result = await this.authService.verifyEmail(dto.token);
    return {
      success: true,
      message: result.message,
      data: result.user,
    };
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('email-verification/resend')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Renvoyer l'e-mail de vérification" })
  async resendVerification(@CurrentUser() user: IUserPayload) {
    const result = await this.authService.resendVerificationEmail(user.id);
    return {
      success: true,
      message: result.message,
      data: null,
    };
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Demander un lien de réinitialisation (réponse générique)' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    const result = await this.authService.forgotPassword(dto.email);
    return {
      success: true,
      message: result.message,
      data: null,
    };
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Réinitialiser le mot de passe avec un token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    const result = await this.authService.resetPassword(dto.token, dto.newPassword);
    return {
      success: true,
      message: result.message,
      data: null,
    };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Changer le mot de passe depuis le profil' })
  async changePassword(@CurrentUser() user: IUserPayload, @Body() dto: ChangePasswordDto) {
    const result = await this.authService.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
    return {
      success: true,
      message: result.message,
      data: { tokens: result.tokens },
    };
  }
}

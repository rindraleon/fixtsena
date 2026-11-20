import { Injectable, UnauthorizedException, ConflictException, BadRequestException, ForbiddenException, NotFoundException, Logger, Optional } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import { SettingsService } from '../settings/settings.service';
import { User } from '../../database/entities/user.entity';
import { UserRole, AccountStatus, Gender } from '../../database/entities/role.enum';
import { RegisterDto, LoginDto, UpdateProfileDto, RegistrationAccountType } from './dto/auth.dto';
import { EmailValidationService, EmailValidationError } from './services/email-validation.service';
import { EmailVerificationService } from './services/email-verification.service';
import { PasswordResetService } from './services/password-reset.service';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { envBool, envInt } from '../../common/utils/env.util';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly maxFailedAttempts: number;
  private readonly lockDurationMinutes: number;

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly emailValidationService: EmailValidationService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly passwordResetService: PasswordResetService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    @Optional() private readonly settings?: SettingsService,
  ) {
    this.maxFailedAttempts = envInt(
      this.configService.get<string>('MAX_FAILED_LOGIN_ATTEMPTS'),
      5,
    );
    this.lockDurationMinutes = envInt(
      this.configService.get<string>('ACCOUNT_LOCK_DURATION_MINUTES'),
      15,
    );
  }

  private resolveAccountType(dto: RegisterDto): RegistrationAccountType {
    if (dto.accountType) return dto.accountType;
    return dto.requestSellerAccount ? RegistrationAccountType.SELLER : RegistrationAccountType.CLIENT;
  }

  private adminSelfRegistrationEnabled(): boolean {
    return envBool(this.configService.get<string>('ADMIN_SELF_REGISTRATION'), true);
  }

  private countAdmins(repository: Repository<User> = this.usersRepository): Promise<number> {
    return repository
      .createQueryBuilder('user')
      .where("(',' || user.roles || ',') LIKE :role", { role: `%,${UserRole.ADMIN},%` })
      .getCount();
  }

  async getRegistrationOptions() {
    let adminRegistrationOpen = false;
    let adminRegistrationReason: string | null = null;
    if (!this.adminSelfRegistrationEnabled()) {
      adminRegistrationReason = "L'inscription administrateur est désactivée par la configuration du serveur.";
    } else if ((await this.countAdmins()) > 0) {
      adminRegistrationReason = "Un administrateur existe déjà : ce rôle est désormais attribué depuis l'espace d'administration.";
    } else {
      adminRegistrationOpen = true;
    }
    return {
      accountTypes: Object.values(RegistrationAccountType),
      adminRegistrationOpen,
      adminRegistrationReason,
      sellerApprovalRequired: true,
    };
  }

  private adminRegistrationClosed(reason: string): ForbiddenException {
    return new ForbiddenException({
      message: reason,
      errors: [{ field: 'accountType', message: reason }],
    });
  }

  private async assertAdminRegistrationOpen(): Promise<void> {
    const options = await this.getRegistrationOptions();
    if (!options.adminRegistrationOpen) {
      throw this.adminRegistrationClosed(options.adminRegistrationReason ?? "L'inscription administrateur n'est pas disponible.");
    }
  }

  private async saveFirstAdmin(user: User): Promise<User> {
    return this.usersRepository.manager.transaction(async (manager: EntityManager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1)', [AuthService.ADMIN_REGISTRATION_LOCK_KEY]);
      if ((await this.countAdmins(manager.getRepository(User))) > 0) {
        throw this.adminRegistrationClosed(
          "Un administrateur existe déjà : ce rôle est désormais attribué depuis l'espace d'administration.",
        );
      }
      return manager.getRepository(User).save(user);
    });
  }

  private static readonly ADMIN_REGISTRATION_LOCK_KEY = 7_420_260_001;

  async register(dto: RegisterDto) {
    const accountType = this.resolveAccountType(dto);
    if (accountType === RegistrationAccountType.ADMIN) {
      await this.assertAdminRegistrationOpen();
    }

    const emailValidation = this.emailValidationService.validate(dto.email);
    if (!emailValidation.valid) {
      if (emailValidation.errors.includes(EmailValidationError.DISPOSABLE_DOMAIN)) {
        throw new BadRequestException(
          'Les adresses e-mail temporaires ou jetables ne sont pas autorisées. Veuillez utiliser une adresse e-mail valide et durable.'
        );
      }
      throw new BadRequestException('Adresse e-mail invalide. Vérifiez le format.');
    }

    const normalizedEmail = emailValidation.normalized;

    const existing = await this.usersRepository.findOne({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new ConflictException('Un compte avec cette adresse e-mail existe déjà');
    }

    const saltRounds = this.bcryptRounds();
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    const user = this.usersRepository.create({
      email: normalizedEmail,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone?.trim() || undefined,
      roles: accountType === RegistrationAccountType.ADMIN ? [UserRole.ADMIN] : [UserRole.CLIENT],
      status: AccountStatus.ACTIVE,
      emailVerified: false,
      failedLoginAttempts: 0,
      sellerRequestedAt: accountType === RegistrationAccountType.SELLER ? new Date() : null,
      termsAcceptedAt: new Date(),
      birthDate: dto.birthDate || null,
      gender: dto.gender ?? Gender.UNSPECIFIED,
      marketingOptIn: dto.marketingOptIn === true,
      marketingOptInAt: dto.marketingOptIn === true ? new Date() : null,
    });

    const savedUser =
      accountType === RegistrationAccountType.ADMIN
        ? await this.saveFirstAdmin(user)
        : await this.usersRepository.save(user);

    if (accountType === RegistrationAccountType.ADMIN) {
      this.logger.warn(
        `Premier compte administrateur créé via l'inscription publique : ${savedUser.email} — l'inscription administrateur est désormais fermée.`,
      );
    } else if (accountType === RegistrationAccountType.SELLER) {
      this.logger.log(`Demande vendeur enregistrée à l'inscription : ${savedUser.email}`);
    }

    try {
      await this.emailVerificationService.sendVerificationEmail(savedUser.id);
    } catch (error) {
      this.logger.warn(`Échec envoi e-mail de vérification: ${error.message}`);
    }

    const tokens = await this.generateTokens(savedUser);

    return {
      user: this.sanitizeUser(savedUser),
      tokens,
      emailVerificationRequired: !savedUser.emailVerified,
      accountType,
      sellerRequestPending: accountType === RegistrationAccountType.SELLER,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersRepository.findOne({
      where: { email: this.emailValidationService.normalize(dto.email) },
    });

    if (!user) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    if (user.lockedUntil && new Date() < user.lockedUntil) {
      const remainingMinutes = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / (1000 * 60)
      );
      throw new UnauthorizedException(
        `Compte temporairement verrouillé. Réessayez dans ${remainingMinutes} minute(s).`
      );
    }

    const isPasswordValid = await this.safeCompare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

      if (user.failedLoginAttempts >= this.maxFailedAttempts) {
        const lockUntil = new Date();
        lockUntil.setMinutes(lockUntil.getMinutes() + this.lockDurationMinutes);
        user.lockedUntil = lockUntil;
        await this.usersRepository.save(user);

        this.logger.warn(`Compte verrouillé: ${user.email} (${this.maxFailedAttempts} tentatives)`);

        await this.mailService.sendSecurityAlert(
          user.email,
          'Compte verrouillé',
          `Trop de tentatives de connexion échouées (${this.maxFailedAttempts}). Le compte est verrouillé pour ${this.lockDurationMinutes} minutes.`,
          user.firstName,
        );

        throw new UnauthorizedException(
          `Compte temporairement verrouillé suite à trop de tentatives. Réessayez dans ${this.lockDurationMinutes} minutes.`
        );
      }

      await this.usersRepository.save(user);
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    if (user.status === AccountStatus.SUSPENDED) {
      throw new ForbiddenException(
        'Votre compte est suspendu. Contactez le support pour plus d\'informations.',
      );
    }
    if (user.status === AccountStatus.DISABLED) {
      throw new ForbiddenException('Ce compte a été désactivé.');
    }

    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;
    user.lastLoginAt = new Date();
    await this.usersRepository.save(user);

    const tokens = await this.generateTokens(user);

    return {
      user: this.sanitizeUser(user),
      tokens,
      emailVerificationRequired: !user.emailVerified,
    };
  }

  async logout(userId: string) {
    await this.usersRepository.update(userId, { refreshTokenHash: null as unknown as string });
  }

  async refreshToken(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Token de rafraîchissement manquant');
    }

    let payload: { sub?: string; type?: string };
    try {
      payload = this.jwtService.verify(refreshToken, { secret: this.refreshSecret() });
    } catch (error) {
      const expired = error instanceof Error && error.name === 'TokenExpiredError';
      throw new UnauthorizedException(
        expired
          ? 'Session expirée. Veuillez vous reconnecter.'
          : 'Token de rafraîchissement invalide',
      );
    }

    if (!payload?.sub || payload.type !== 'refresh') {
      throw new UnauthorizedException('Token de rafraîchissement invalide');
    }

    const user = await this.usersRepository.findOne({ where: { id: payload.sub } });
    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Session expirée. Veuillez vous reconnecter.');
    }

    const matches = await this.safeCompare(this.fingerprint(refreshToken), user.refreshTokenHash);
    if (!matches) {
      await this.logout(user.id);
      throw new UnauthorizedException('Session expirée. Veuillez vous reconnecter.');
    }

    if (user.status === AccountStatus.SUSPENDED) {
      await this.logout(user.id);
      throw new ForbiddenException('Votre compte est suspendu.');
    }

    const tokens = await this.generateTokens(user);

    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  async getProfile(userId: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Utilisateur non trouvé');
    }
    return this.sanitizeUser(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    if (dto.firstName !== undefined) user.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) user.lastName = dto.lastName.trim();
    if (dto.phone !== undefined) user.phone = dto.phone.trim() || (null as unknown as string);
    if (dto.avatarUrl !== undefined) user.avatarUrl = dto.avatarUrl || (null as unknown as string);

    if (dto.birthDate !== undefined) {
      if (dto.birthDate === '') {
        user.birthDate = null;
      } else {
        const date = new Date(`${dto.birthDate}T00:00:00Z`);
        if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dto.birthDate) {
          throw new BadRequestException('Date de naissance invalide');
        }
        const age = computeAge(dto.birthDate);
        if (date.getTime() > Date.now()) throw new BadRequestException('La date de naissance ne peut pas être dans le futur');
        if (age > 120) throw new BadRequestException('Date de naissance invalide (âge supérieur à 120 ans)');
        user.birthDate = dto.birthDate;
      }
    }
    if (dto.gender !== undefined) user.gender = dto.gender;
    if (dto.marketingOptIn !== undefined && dto.marketingOptIn !== user.marketingOptIn) {
      user.marketingOptIn = dto.marketingOptIn;
      user.marketingOptInAt = dto.marketingOptIn ? new Date() : null;
    }
    if (dto.notifyFollowedShopProducts !== undefined) user.notifyFollowedShopProducts = dto.notifyFollowedShopProducts;
    if (dto.notifyFollowedShopPromotions !== undefined) user.notifyFollowedShopPromotions = dto.notifyFollowedShopPromotions;
    if (dto.notifyMessagesByEmail !== undefined) user.notifyMessagesByEmail = dto.notifyMessagesByEmail;

    const saved = await this.usersRepository.save(user);
    return this.sanitizeUser(saved);
  }

  async verifyEmail(token: string) {
    const user = await this.emailVerificationService.verifyEmail(token);
    return {
      message: 'Adresse e-mail vérifiée avec succès. Votre compte est maintenant actif.',
      user: this.sanitizeUser(user),
    };
  }

  async resendVerificationEmail(userId: string) {
    await this.emailVerificationService.sendVerificationEmail(userId);
    return {
      message: 'Un nouvel e-mail de vérification a été envoyé. Consultez votre boîte de réception.',
    };
  }

  async forgotPassword(email: string) {
    return this.passwordResetService.requestPasswordReset(email);
  }

  async resetPassword(token: string, newPassword: string) {
    await this.passwordResetService.resetPassword(token, newPassword);
    return {
      message: 'Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.',
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    await this.passwordResetService.changePassword(userId, currentPassword, newPassword);

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    const tokens = user ? await this.generateTokens(user) : null;

    return {
      message: 'Mot de passe modifié avec succès.',
      tokens,
    };
  }

  private bcryptRounds(): number {
    return envInt(this.configService.get<string>('BCRYPT_ROUNDS'), 12);
  }

  private async safeCompare(plain: string, hash: string | null | undefined): Promise<boolean> {
    if (!plain || !hash) return false;
    try {
      return await bcrypt.compare(plain, hash);
    } catch {
      return false;
    }
  }

  private refreshSecret(): string {
    return (
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      `${this.configService.get<string>('JWT_SECRET') || 'default-secret'}-refresh`
    );
  }

  private accessExpiresIn(): string {
    return (
      this.configService.get<string>('JWT_EXPIRATION') ||
      this.configService.get<string>('JWT_ACCESS_EXPIRES') ||
      '15m'
    );
  }

  private refreshExpiresIn(): string {
    return this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '7d';
  }

  private fingerprint(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async generateTokens(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.accessExpiresIn(),
    });

    const refreshToken = this.jwtService.sign(
      { sub: user.id, type: 'refresh', jti: randomUUID() },
      { secret: this.refreshSecret(), expiresIn: this.refreshExpiresIn() },
    );

    const refreshTokenHash = await bcrypt.hash(this.fingerprint(refreshToken), this.bcryptRounds());
    await this.usersRepository.update(user.id, { refreshTokenHash });

    const decoded = this.jwtService.decode(accessToken) as { exp?: number } | null;
    const expiresIn = decoded?.exp
      ? Math.max(0, decoded.exp - Math.floor(Date.now() / 1000))
      : 15 * 60;

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer' as const,
      expiresIn,
    };
  }

  private sanitizeUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      roles: user.roles,
      status: user.status,
      emailVerified: user.emailVerified,
      emailVerifiedAt: user.emailVerifiedAt,
      reputationScore: Number(user.reputationScore ?? 0),
      reviewCount: Number(user.reviewCount ?? 0),
      sellerRequestedAt: user.sellerRequestedAt ?? null,
      createdAt: user.createdAt,
      birthDate: user.birthDate ?? null,
      age: user.birthDate ? computeAge(user.birthDate) : null,
      isAdult: user.birthDate ? computeAge(user.birthDate) >= this.majorityAge() : null,
      gender: user.gender ?? Gender.UNSPECIFIED,
      marketingOptIn: !!user.marketingOptIn,
      marketingOptInAt: user.marketingOptInAt ?? null,
      termsAcceptedAt: user.termsAcceptedAt ?? null,
      notifyFollowedShopProducts: user.notifyFollowedShopProducts ?? true,
      notifyFollowedShopPromotions: user.notifyFollowedShopPromotions ?? true,
      notifyMessagesByEmail: user.notifyMessagesByEmail ?? true,
    };
  }

  private majorityAge(): number {
    return Number(this.settings?.get('account.majorityAge') ?? 18) || 18;
  }
}

export function computeAge(birthDate: string): number {
  const [y, m, d] = birthDate.split('-').map(Number);
  const now = new Date();
  let age = now.getUTCFullYear() - y;
  if (now.getUTCMonth() + 1 < m || (now.getUTCMonth() + 1 === m && now.getUTCDate() < d)) age -= 1;
  return age;
}

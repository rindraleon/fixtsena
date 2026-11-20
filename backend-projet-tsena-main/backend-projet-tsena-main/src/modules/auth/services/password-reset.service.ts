import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { User } from '../../../database/entities/user.entity';
import { PasswordResetToken } from '../../../database/entities/password-reset-token.entity';
import { MailService } from '../../mail/mail.service';
import { EmailValidationService } from './email-validation.service';
import { envInt } from '../../../common/utils/env.util';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly tokenExpiryMinutes: number;
  private readonly maxTokensPerHour: number;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(PasswordResetToken)
    private readonly tokenRepository: Repository<PasswordResetToken>,
    private readonly mailService: MailService,
    private readonly emailValidationService: EmailValidationService,
    private readonly configService: ConfigService,
  ) {
    this.tokenExpiryMinutes = envInt(
      this.configService.get<string>('PASSWORD_RESET_TOKEN_EXPIRY_MINUTES'),
      60,
    );
    this.maxTokensPerHour = envInt(
      this.configService.get<string>('PASSWORD_RESET_MAX_TOKENS_PER_HOUR'),
      3,
    );
  }

  private bcryptRounds(): number {
    return envInt(this.configService.get<string>('BCRYPT_ROUNDS'), 12);
  }

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const normalizedEmail = this.emailValidationService.normalize(email);

    const validation = this.emailValidationService.validate(normalizedEmail);
    if (!validation.valid) {
      this.logger.warn(`Tentative de réinitialisation avec e-mail invalide: ${normalizedEmail}`);
      return {
        message: 'Si un compte existe avec cette adresse, un e-mail de réinitialisation a été envoyé.',
      };
    }

    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (!user) {
      this.logger.log(`Réinitialisation demandée pour e-mail inexistant: ${normalizedEmail}`);
      return {
        message: 'Si un compte existe avec cette adresse, un e-mail de réinitialisation a été envoyé.',
      };
    }

    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    const recentTokens = await this.tokenRepository.count({
      where: {
        userId: user.id,
        createdAt: MoreThan(oneHourAgo),
      },
    });

    if (recentTokens >= this.maxTokensPerHour) {
      this.logger.warn(`Rate limit atteint pour ${user.email}: ${recentTokens} tokens/h`);
      throw new BadRequestException(
        'Trop de demandes de réinitialisation. Veuillez réessayer dans une heure.'
      );
    }

    await this.tokenRepository.update(
      { userId: user.id, usedAt: undefined as any, invalidatedAt: undefined as any },
      { invalidatedAt: new Date() },
    );

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.tokenExpiryMinutes);

    const tokenEntity = this.tokenRepository.create({
      userId: user.id,
      tokenHash,
      expiresAt,
    });
    await this.tokenRepository.save(tokenEntity);

    const sent = await this.mailService.sendPasswordResetEmail(
      user.email,
      rawToken,
      user.firstName,
    );

    if (sent) this.logger.log(`E-mail de réinitialisation envoyé à ${user.email}`);
    else this.logger.warn(`E-mail de réinitialisation NON envoyé à ${user.email} (transport e-mail indisponible).`);

    return {
      message: 'Si un compte existe avec cette adresse, un e-mail de réinitialisation a été envoyé.',
    };
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (!token) {
      throw new BadRequestException('Token manquant');
    }

    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('Le mot de passe doit contenir au moins 8 caractères');
    }

    this.validatePasswordStrength(newPassword);

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const tokenEntity = await this.tokenRepository.findOne({
      where: { tokenHash },
      relations: ['user'],
    });

    if (!tokenEntity) {
      throw new BadRequestException('Ce lien de réinitialisation n\'est plus valide. Demandez un nouveau lien.');
    }

    if (new Date() > tokenEntity.expiresAt) {
      throw new BadRequestException('Ce lien de réinitialisation a expiré. Veuillez demander un nouveau lien.');
    }

    if (tokenEntity.usedAt) {
      throw new BadRequestException('Ce lien a déjà été utilisé. Veuillez demander un nouveau lien.');
    }

    if (tokenEntity.invalidatedAt) {
      throw new BadRequestException('Ce lien n\'est plus valide. Veuillez demander un nouveau lien.');
    }

    const user = tokenEntity.user;
    const saltRounds = this.bcryptRounds();
    user.passwordHash = await bcrypt.hash(newPassword, saltRounds);
    user.passwordChangedAt = new Date();
    user.refreshTokenHash = undefined;

    tokenEntity.usedAt = new Date();

    await this.tokenRepository.update(
      { userId: user.id, usedAt: undefined as any, invalidatedAt: undefined as any },
      { invalidatedAt: new Date() },
    );

    await this.userRepository.save(user);
    await this.tokenRepository.save(tokenEntity);

    await this.mailService.sendPasswordChangedEmail(user.email, user.firstName);

    this.logger.log(`Mot de passe réinitialisé pour ${user.email}`);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const isValid = currentPassword
      ? await bcrypt.compare(currentPassword, user.passwordHash)
      : false;
    if (!isValid) {
      throw new BadRequestException('Le mot de passe actuel est incorrect');
    }

    this.validatePasswordStrength(newPassword);

    if (currentPassword === newPassword) {
      throw new BadRequestException('Le nouveau mot de passe doit être différent de l\'ancien');
    }

    const saltRounds = this.bcryptRounds();
    user.passwordHash = await bcrypt.hash(newPassword, saltRounds);
    user.passwordChangedAt = new Date();
    user.refreshTokenHash = undefined;
    await this.userRepository.save(user);

    await this.mailService.sendPasswordChangedEmail(user.email, user.firstName);

    this.logger.log(`Mot de passe changé pour ${user.email}`);
  }

  private validatePasswordStrength(password: string): void {
    if (password.length < 8) {
      throw new BadRequestException('Le mot de passe doit contenir au moins 8 caractères');
    }
    if (password.length > 128) {
      throw new BadRequestException('Le mot de passe ne peut pas dépasser 128 caractères');
    }
    if (!/[a-z]/.test(password)) {
      throw new BadRequestException('Le mot de passe doit contenir au moins une lettre minuscule');
    }
    if (!/[A-Z]/.test(password)) {
      throw new BadRequestException('Le mot de passe doit contenir au moins une lettre majuscule');
    }
    if (!/\d/.test(password)) {
      throw new BadRequestException('Le mot de passe doit contenir au moins un chiffre');
    }
  }
}

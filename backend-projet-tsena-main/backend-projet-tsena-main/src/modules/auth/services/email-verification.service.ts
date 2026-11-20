import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { User } from '../../../database/entities/user.entity';
import { MailService } from '../../mail/mail.service';
import { envInt } from '../../../common/utils/env.util';

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);
  private readonly tokenExpiryHours: number;
  private readonly resendCooldownMinutes: number;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {
    this.tokenExpiryHours = envInt(
      this.configService.get<string>('EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS'),
      24,
    );
    this.resendCooldownMinutes = envInt(
      this.configService.get<string>('EMAIL_VERIFICATION_RESEND_COOLDOWN_MINUTES'),
      2,
    );
  }

  async sendVerificationEmail(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    if (user.emailVerified) {
      throw new BadRequestException('L\'adresse e-mail est déjà vérifiée');
    }

    if (user.lastVerificationEmailSentAt) {
      const cooldownEnd = new Date(user.lastVerificationEmailSentAt);
      cooldownEnd.setMinutes(cooldownEnd.getMinutes() + this.resendCooldownMinutes);
      if (new Date() < cooldownEnd) {
        const waitSeconds = Math.ceil((cooldownEnd.getTime() - Date.now()) / 1000);
        throw new BadRequestException(
          `Veuillez patienter ${waitSeconds} secondes avant de renvoyer un e-mail de vérification`
        );
      }
    }

    const token = this.generateSecureToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.tokenExpiryHours);

    user.emailVerificationToken = token;
    user.emailVerificationTokenExpiresAt = expiresAt;
    user.lastVerificationEmailSentAt = new Date();
    await this.userRepository.save(user);

    const sent = await this.mailService.sendVerificationEmail(
      user.email,
      token,
      user.firstName,
    );

    if (sent) this.logger.log(`E-mail de vérification envoyé à ${user.email}`);
    else this.logger.warn(`E-mail de vérification NON envoyé à ${user.email} (transport e-mail indisponible) — l'utilisateur pourra demander un renvoi.`);
  }

  async verifyEmail(token: string): Promise<User> {
    if (!token) {
      throw new BadRequestException('Token de vérification manquant');
    }

    const user = await this.userRepository.findOne({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      throw new BadRequestException('Token de vérification invalide');
    }

    if (user.emailVerificationTokenExpiresAt && new Date() > user.emailVerificationTokenExpiresAt) {
      throw new BadRequestException('Ce lien de vérification a expiré. Veuillez demander un nouveau lien.');
    }

    if (user.emailVerified) {
      throw new BadRequestException('L\'adresse e-mail est déjà vérifiée');
    }

    user.emailVerified = true;
    user.emailVerifiedAt = new Date();
    user.emailVerificationToken = undefined;
    user.emailVerificationTokenExpiresAt = undefined;
    await this.userRepository.save(user);

    this.logger.log(`E-mail vérifié avec succès pour ${user.email}`);

    return user;
  }

  async isTokenValid(token: string): Promise<boolean> {
    if (!token) return false;

    const user = await this.userRepository.findOne({
      where: { emailVerificationToken: token },
    });

    if (!user) return false;
    if (user.emailVerified) return false;
    if (user.emailVerificationTokenExpiresAt && new Date() > user.emailVerificationTokenExpiresAt) {
      return false;
    }

    return true;
  }

  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}

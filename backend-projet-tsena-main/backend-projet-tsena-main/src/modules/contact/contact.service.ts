import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { SettingsService } from '../settings/settings.service';
import { CreateContactMessageDto } from './dto/contact.dto';

export interface ContactDeliveryResult {
  readonly delivered: boolean;
  /** Adresse de support effective (jamais un secret) : utile pour le repli côté client. */
  readonly supportEmail: string;
}

/** Formulaire de contact public : le message part vers l'adresse de support configurée. */
@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private readonly mailService: MailService,
    private readonly settings: SettingsService,
  ) {}

  async submit(dto: CreateContactMessageDto, userId?: string | null): Promise<ContactDeliveryResult> {
    const supportEmail = this.settings.get('notifications.helpEmail');

    if (dto.website) {
      // Robot détecté : on répond normalement sans rien envoyer.
      return { delivered: true, supportEmail };
    }

    const delivered = await this.mailService.sendContactMessage({
      to: supportEmail,
      name: dto.name,
      email: dto.email,
      subject: dto.subject,
      message: dto.message,
      userId: userId ?? null,
    });

    if (!delivered) {
      this.logger.warn(`Message de contact non transmis (expéditeur ${dto.email})`);
    }
    return { delivered, supportEmail };
  }
}

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { EmailLog, Notification } from '../../database/entities/marketplace.entity';
import { User } from '../../database/entities/user.entity';
import { EmailDeliveryStatus, NotificationChannel } from '../../database/entities/role.enum';
import { MailService } from '../mail/mail.service';
import { SettingsService } from '../settings/settings.service';
import { MARKETING_TYPES, NotifyOptions } from './notification-types';
import {
  MESSAGE_NOTIFICATION_TYPE,
  isMessageNotification,
  messageNotificationBody,
  presentNotification,
  senderNameFromMetadata,
  type NotificationView,
} from './message-notifications';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification) private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(EmailLog) private readonly emailLogRepository: Repository<EmailLog>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly mailService: MailService,
    private readonly settings: SettingsService,
  ) {}

  async notify(options: NotifyOptions): Promise<Notification | null> {
    try {
      const user = await this.userRepository.findOne({ where: { id: options.userId } });
      if (!user) return null;

      const isMarketing = MARKETING_TYPES.has(options.type);
      if (isMarketing && !user.marketingOptIn) return null;
      if (options.type === 'follow.new_product' && !user.notifyFollowedShopProducts) return null;
      if (options.type === 'follow.promotion' && !user.notifyFollowedShopPromotions) return null;

      const body = isMessageNotification(options.type)
        ? messageNotificationBody(senderNameFromMetadata(options.metadata))
        : options.body;

      const notification = await this.notificationRepository.save(
        this.notificationRepository.create({
          userId: user.id,
          type: options.type,
          title: options.title.slice(0, 200),
          body,
          link: options.link ?? null,
          metadata: options.metadata ?? null,
          channel: NotificationChannel.IN_APP,
        }),
      );

      const wantsEmail = options.email !== false && !(isMessageNotification(options.type) && !user.notifyMessagesByEmail);
      if (wantsEmail && user.email) {
        void this.sendEmailWithRetry(user, { ...options, body });
      }
      return notification;
    } catch (error) {
      this.logger.error(`Notification non enregistrée (${options.type}): ${(error as Error).message}`);
      return null;
    }
  }

  async notifyMany(userIds: string[], build: (userId: string) => NotifyOptions): Promise<void> {
    for (const userId of new Set(userIds)) await this.notify(build(userId));
  }

  private async sendEmailWithRetry(user: User, options: NotifyOptions): Promise<void> {
    const email = options.email || {};
    const subject = email.subject ?? `Tsena — ${options.title}`;
    const log = await this.emailLogRepository.save(
      this.emailLogRepository.create({ userId: user.id, to: user.email, type: options.type, subject, status: EmailDeliveryStatus.QUEUED, payload: { link: options.link ?? null } }),
    );
    const maxAttempts = Math.max(1, Number(this.settings.get('notifications.emailRetryCount')) || 1);
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const sent = await this.mailService.sendTransactional({
          to: user.email,
          name: user.firstName || user.email,
          subject,
          heading: options.title,
          message: options.body,
          orderNumber: email.orderNumber ?? null,
          status: email.status ?? null,
          nextAction: email.nextAction ?? null,
          actionLabel: email.actionLabel,
          actionPath: options.link ?? null,
          helpEmail: this.settings.get('notifications.helpEmail'),
        });
        if (sent) {
          await this.emailLogRepository.update(log.id, { status: EmailDeliveryStatus.SENT, attempts: attempt, sentAt: new Date(), lastError: null });
          return;
        }
        await this.emailLogRepository.update(log.id, { attempts: attempt, lastError: 'Transport e-mail non configuré' });
      } catch (error) {
        await this.emailLogRepository.update(log.id, { attempts: attempt, lastError: (error as Error).message });
      }
      if (attempt < maxAttempts) await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
    await this.emailLogRepository.update(log.id, { status: EmailDeliveryStatus.FAILED });
  }

  async list(userId: string, options: { unreadOnly?: boolean; page?: number; limit?: number } = {}) {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(50, Math.max(1, options.limit ?? 20));
    const where = options.unreadOnly ? { userId, readAt: IsNull() } : { userId };
    const [rows, total] = await this.notificationRepository.findAndCount({ where, order: { createdAt: 'DESC' }, skip: (page - 1) * limit, take: limit });
    const unreadCount = await this.notificationRepository.count({ where: { userId, readAt: IsNull() } });
    return { items: rows.map(presentNotification), total, page, limit, unreadCount };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.notificationRepository.count({ where: { userId, readAt: IsNull() } });
  }

  async markRead(userId: string, id: string): Promise<NotificationView> {
    const notification = await this.notificationRepository.findOne({ where: { id, userId } });
    if (!notification) throw new NotFoundException('Notification non trouvée');
    if (!notification.readAt) {
      notification.readAt = new Date();
      await this.notificationRepository.save(notification);
    }
    return presentNotification(notification);
  }

  async markConversationRead(userId: string, conversationId: string): Promise<number> {
    if (!conversationId) return 0;
    const result = await this.notificationRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ readAt: new Date() })
      .where('"userId" = :userId', { userId })
      .andWhere('"readAt" IS NULL')
      .andWhere('"type" = :type', { type: MESSAGE_NOTIFICATION_TYPE })
      .andWhere("metadata ->> 'conversationId' = :conversationId", { conversationId })
      .execute();
    return result.affected ?? 0;
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.notificationRepository.update({ userId, readAt: IsNull() }, { readAt: new Date() });
    return result.affected ?? 0;
  }

  async emailLogs(options: { status?: EmailDeliveryStatus; page?: number; limit?: number } = {}) {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 20));
    const [items, total] = await this.emailLogRepository.findAndCount({
      where: options.status ? { status: options.status } : {},
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit };
  }
}

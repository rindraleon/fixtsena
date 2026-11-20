import type { Notification } from '../../database/entities/marketplace.entity';

export const MESSAGE_NOTIFICATION_TYPE = 'message.new';

export interface MessageNotificationMetadata {
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string | null;
  shopId?: string | null;
  shopName?: string | null;
  subject?: string | null;
  messageId?: string;

  [key: string]: unknown;
}

export function isMessageNotification(type: string): boolean {
  return type === MESSAGE_NOTIFICATION_TYPE;
}

export function messageNotificationBody(senderName?: string | null): string {
  const from = senderName?.trim();
  return from
    ? `Nouveau message de ${from}. Ouvrez la conversation dans votre messagerie pour le lire.`
    : 'Vous avez reçu un nouveau message. Ouvrez la conversation dans votre messagerie pour le lire.';
}

export function senderNameFromMetadata(metadata?: Record<string, unknown> | null): string | null {
  const value = metadata?.senderName;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export interface NotificationView extends Notification {

  isMessage: boolean;

  conversationId: string | null;
  senderName: string | null;
  senderAvatarUrl: string | null;
}

export function presentNotification(notification: Notification): NotificationView {
  if (!isMessageNotification(notification.type)) {
    return { ...notification, isMessage: false, conversationId: null, senderName: null, senderAvatarUrl: null };
  }
  const metadata = (notification.metadata ?? {}) as Partial<MessageNotificationMetadata>;
  const senderName = typeof metadata.senderName === 'string' && metadata.senderName.trim() ? metadata.senderName.trim() : null;
  return {
    ...notification,
    body: messageNotificationBody(senderName),
    isMessage: true,
    conversationId: typeof metadata.conversationId === 'string' ? metadata.conversationId : null,
    senderName,
    senderAvatarUrl: typeof metadata.senderAvatarUrl === 'string' ? metadata.senderAvatarUrl : null,
  };
}

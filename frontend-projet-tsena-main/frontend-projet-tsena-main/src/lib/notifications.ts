import type { ApiNotification } from '../types/api';

export const MESSAGE_NOTIFICATION_TYPE = 'message.new';

type NotifiableLike = Pick<ApiNotification, 'type'> & Partial<Pick<ApiNotification, 'isMessage' | 'conversationId' | 'senderName' | 'body' | 'link'>>;

export function isMessageNotification(notification: NotifiableLike): boolean {
  return notification.isMessage ?? notification.type === MESSAGE_NOTIFICATION_TYPE;
}

export function messagesPath(role: 'client' | 'seller'): string {
  return role === 'seller' ? '/dashboard/vendeur/messages' : '/dashboard/client/messages';
}

export function notificationHref(notification: ApiNotification, role: 'client' | 'seller'): string | null {
  if (isMessageNotification(notification) && notification.conversationId) {
    return `${messagesPath(role)}?conversation=${encodeURIComponent(notification.conversationId)}`;
  }
  return notification.link ?? null;
}

export function notificationDescription(notification: ApiNotification): string {
  if (isMessageNotification(notification)) {
    const sender = notification.senderName?.trim();
    return sender
      ? `Nouveau message de ${sender}. Le contenu est consultable dans votre messagerie.`
      : 'Vous avez reçu un nouveau message. Le contenu est consultable dans votre messagerie.';
  }
  return notification.body;
}

export function notificationActionLabel(notification: ApiNotification): string {
  return isMessageNotification(notification) ? 'Ouvrir la conversation' : 'Voir le détail';
}

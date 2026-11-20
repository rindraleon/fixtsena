export type NotificationType =
  | 'order.created'
  | 'order.payment_initiated'
  | 'order.payment_success'
  | 'order.payment_failed'
  | 'order.escrow_held'
  | 'order.confirmed'
  | 'order.processing'
  | 'order.shipped'
  | 'order.tracking'
  | 'order.delivered'
  | 'order.reception_confirmed'
  | 'order.funds_released'
  | 'order.cancelled'
  | 'order.refunded'
  | 'dispute.created'
  | 'dispute.decided'
  | 'review.received'
  | 'review.replied'
  | 'message.new'
  | 'subscription.activated'
  | 'subscription.scheduled'
  | 'subscription.expiring'
  | 'subscription.expired'
  | 'promotion.activated'
  | 'promotion.stopped'
  | 'shop.status'
  | 'shop.level'
  | 'follow.new_product'
  | 'follow.promotion'
  | 'account.security';

export const MARKETING_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>(['follow.new_product', 'follow.promotion']);

export interface NotifyOptions {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
  metadata?: Record<string, unknown>;
  email?: {
    subject?: string;
    orderNumber?: string | null;
    status?: string | null;
    nextAction?: string | null;
    actionLabel?: string;
  } | false;
}

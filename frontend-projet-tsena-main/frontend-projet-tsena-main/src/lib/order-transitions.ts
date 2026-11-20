import type { AppRole } from '../types/auth';
import type { ApiPayment, OrderStatus } from '../types/api';

export function isOrderPayable(payments: readonly Pick<ApiPayment, 'method' | 'status'>[]): boolean {
  return payments.some(
    (payment) =>
      payment.status === 'success' || payment.status === 'escrow' || payment.status === 'released' ||
      (payment.method === 'cash_on_delivery' && payment.status !== 'cancelled' && payment.status !== 'failed'),
  );
}

const SELLER_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
};

const BUYER_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending: ['cancelled'],
  shipped: ['delivered'],
};

const ADMIN_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['refunded'],
  in_dispute: ['refunded', 'delivered', 'confirmed', 'cancelled'],
};

export function allowedOrderTransitions(status: OrderStatus, role: AppRole): OrderStatus[] {
  const table = role === 'admin' ? ADMIN_TRANSITIONS : role === 'seller' ? SELLER_TRANSITIONS : BUYER_TRANSITIONS;
  return table[status] ?? [];
}

export const ORDER_ACTION_LABELS: Record<OrderStatus, string> = {
  pending: 'Remettre en attente',
  confirmed: 'Confirmer la commande',
  processing: 'Passer en préparation',
  shipped: 'Marquer comme expédiée',
  delivered: 'Marquer comme livrée',
  cancelled: 'Annuler la commande',
  refunded: 'Rembourser',
  in_dispute: 'Ouvrir un litige',
};

export function orderActionLabel(status: OrderStatus, role: AppRole): string {
  if (role === 'client' && status === 'delivered') return 'Confirmer la réception';
  if (role === 'seller' && status === 'cancelled') return 'Refuser / annuler la commande';
  return ORDER_ACTION_LABELS[status];
}

export const DESTRUCTIVE_ORDER_STATUSES: ReadonlySet<OrderStatus> = new Set(['cancelled', 'refunded', 'in_dispute']);

export const ACTIVE_ORDER_STATUSES: readonly OrderStatus[] = ['pending', 'confirmed', 'processing', 'shipped'];

export const DISPUTABLE_ORDER_STATUSES: readonly OrderStatus[] = ['shipped', 'delivered'];

import type { ApiProduct, ApiUser, OrderStatus, PaymentStatus, ProductStatus, UserRole, DisputeStatus, DeliveryStatus } from '../types/api';
import { resolveMediaUrl } from './media';

export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const ariaryFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

export function formatPrice(value: string | number | null | undefined): string {
  return `${ariaryFormatter.format(Math.round(toNumber(value)))} Ar`;
}

export function formatNumber(value: number): string {
  return ariaryFormatter.format(value);
}

export function formatDate(value: string | Date | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR', options ?? { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  return formatDate(value, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatRelativeDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `il y a ${days} j`;
  return formatDate(date);
}

export function discountPercent(product: Pick<ApiProduct, 'price' | 'compareAtPrice'>): number {
  const price = toNumber(product.price);
  const compareAt = toNumber(product.compareAtPrice);
  if (compareAt <= price || compareAt <= 0) return 0;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

export function primaryImageUrl(product: Pick<ApiProduct, 'images'> | null | undefined): string | undefined {
  const images = product?.images ?? [];
  if (images.length === 0) return undefined;
  const primary = images.find((img) => img.isPrimary);
  return resolveMediaUrl((primary ?? [...images].sort((a, b) => a.sortOrder - b.sortOrder)[0])?.url);
}

export function sortedProductImages<T extends { isPrimary: boolean; sortOrder: number }>(images: readonly T[] | null | undefined): T[] {
  return [...(images ?? [])].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder);
}

export function fullName(user: Pick<ApiUser, 'firstName' | 'lastName' | 'email'> | null | undefined): string {
  if (!user) return '';
  const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
  return name || user.email;
}

export function initials(user: Pick<ApiUser, 'firstName' | 'lastName' | 'email'> | null | undefined): string {
  if (!user) return '?';
  const first = user.firstName?.trim()?.[0] ?? '';
  const last = user.lastName?.trim()?.[0] ?? '';
  const value = `${first}${last}`.toUpperCase();
  return value || user.email[0]?.toUpperCase() || '?';
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  processing: 'En préparation',
  shipped: 'Expédiée',
  delivered: 'Livrée',
  cancelled: 'Annulée',
  refunded: 'Remboursée',
  in_dispute: 'En litige',
};

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  draft: 'Brouillon',
  pending_review: 'En attente de validation',
  active: 'Actif',
  published: 'Publié',
  unavailable: 'Indisponible',
  sold_out: 'Épuisé',
  suspended: 'Suspendu',
  archived: 'Archivé',
  rejected: 'Rejeté',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  initiated: 'Initié',
  pending: 'En attente',
  processing: 'En cours',
  success: 'Réussi',
  failed: 'Échoué',
  cancelled: 'Annulé',
  escrow: 'Séquestre',
  blocked: 'Bloqué',
  released: 'Libéré',
  refunded: 'Remboursé',
  partially_refunded: 'Partiellement remboursé',
};

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  to_prepare: 'À préparer',
  preparing: 'En préparation',
  shipped: 'Expédiée',
  in_transit: 'En transit',
  delivered: 'Livrée (à confirmer)',
  reception_confirmed: 'Réception confirmée',
  delivery_failed: 'Échec de livraison',
  returned: 'Retournée',
  in_dispute: 'En litige',
};

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  reported: 'Signalé',
  open: 'Ouvert',
  awaiting_evidence: "En attente d'informations",
  under_review: "En cours d'analyse",
  resolved_buyer: "Résolu (acheteur)",
  resolved_seller: 'Résolu (vendeur)',
  partial_resolution: 'Résolu partiellement',
  closed: 'Fermé',
  cancelled: 'Annulé',
};

export const ACCOUNT_STATUS_LABELS: Record<string, string> = {
  active: 'Actif',
  inactive: 'Inactif',
  suspended: 'Suspendu',
  disabled: 'Désactivé',
  pending_verification: 'En attente de vérification',
  banned: 'Banni',
  deleted: 'Supprimé',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  visitor: 'Visiteur',
  client: 'Client',
  buyer: 'Client',
  seller: 'Vendeur',
  admin: 'Administrateur',
};

export function roleLabels(roles: readonly string[] | undefined): string[] {
  const order: string[] = ['admin', 'seller', 'client', 'buyer', 'visitor'];
  const sorted = [...(roles ?? [])].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const labels = sorted.map((r) => ROLE_LABELS[r as UserRole] ?? r);
  return labels.filter((label, index) => labels.indexOf(label) === index);
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  mvola: 'MVola',
  airtel_money: 'Airtel Money',
  orange_money: 'Orange Money',
  cash_on_delivery: 'Paiement à la livraison',
  card: 'Carte bancaire',
};

export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status as OrderStatus] ?? status;
}

export function productStatusLabel(status: string): string {
  return PRODUCT_STATUS_LABELS[status as ProductStatus] ?? status;
}

export function paymentStatusLabel(status: string): string {
  return PAYMENT_STATUS_LABELS[status as PaymentStatus] ?? status;
}

export function paymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method] ?? method;
}

export function partyName(party: { firstName: string; lastName?: string | null } | null | undefined, fallback = 'Utilisateur supprimé'): string {
  if (!party) return fallback;
  return [party.firstName, party.lastName].filter(Boolean).join(' ') || fallback;
}

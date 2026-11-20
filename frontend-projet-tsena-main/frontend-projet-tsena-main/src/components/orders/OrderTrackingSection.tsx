import { useState } from 'react';
import { Truck, MapPin, History, PackageCheck, CheckCircle2, AlertTriangle, RotateCcw, Hash, CalendarClock, User, Store, ShieldCheck, Cpu } from 'lucide-react';
import clsx from 'clsx';
import Button from '../common/Button';
import ConfirmDialog from '../common/ConfirmDialog';
import StatusBadge from '../../shared/components/StatusBadge';
import { useUpdateDelivery } from '../../hooks/mutations/useOrderMutations';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import { DELIVERY_STATUS_LABELS, ORDER_STATUS_LABELS, formatDate, formatDateTime } from '../../lib/format';
import type { AppRole } from '../../types/auth';
import type { ApiOrder, DeliveryEventStatus, DeliveryStatus, OrderHistoryEntry, OrderStatus } from '../../types/api';

const DELIVERY_TONES: Record<DeliveryStatus, string> = {
  to_prepare: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-200',
  preparing: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200',
  shipped: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200',
  in_transit: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200',
  delivered: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200',
  reception_confirmed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-100',
  delivery_failed: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200',
  returned: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-200',
  in_dispute: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-200',
};

const SELLER_DELIVERY_EVENTS: { status: DeliveryEventStatus; label: string; icon: typeof Truck; variant: 'outline' | 'primary' | 'danger'; description: string }[] = [
  { status: 'in_transit', label: 'En transit', icon: Truck, variant: 'outline', description: 'Le colis est en cours d’acheminement vers l’acheteur.' },
  { status: 'delivered', label: 'Colis remis', icon: PackageCheck, variant: 'primary', description: 'Le colis a été remis. L’acheteur devra confirmer la réception pour clôturer la commande et libérer les fonds.' },
  { status: 'delivery_failed', label: 'Échec de livraison', icon: AlertTriangle, variant: 'danger', description: 'La livraison n’a pas pu être effectuée (absence, adresse introuvable…). Précisez le motif pour l’acheteur.' },
  { status: 'returned', label: 'Retour expéditeur', icon: RotateCcw, variant: 'danger', description: 'Le colis est retourné à l’expéditeur. Précisez le motif pour l’acheteur.' },
];

const DELIVERY_PREFIX = 'delivery:';

export function historyLabel(status: string | null): string {
  if (!status) return 'Création';
  if (status.startsWith(DELIVERY_PREFIX)) {
    const key = status.slice(DELIVERY_PREFIX.length) as DeliveryStatus;
    return `Livraison · ${DELIVERY_STATUS_LABELS[key] ?? key}`;
  }
  return ORDER_STATUS_LABELS[status as OrderStatus] ?? status;
}

const ACTOR_META: Record<string, { label: string; icon: typeof User }> = {
  buyer: { label: 'Acheteur', icon: User },
  seller: { label: 'Vendeur', icon: Store },
  admin: { label: 'Administrateur', icon: ShieldCheck },
  system: { label: 'Système', icon: Cpu },
};

interface OrderTrackingSectionProps {
  readonly order: ApiOrder;
  readonly role: AppRole;
}

export default function OrderTrackingSection({ order, role }: OrderTrackingSectionProps) {
  const updateDelivery = useUpdateDelivery();
  const confirmEvent = useConfirmAction<DeliveryEventStatus>();
  const [note, setNote] = useState('');
  const delivery = order.delivery ?? null;
  const address = order.shippingAddress ?? null;
  const history = order.history ?? [];
  const canDeclareEvents = role !== 'client' && order.status === 'shipped' && !!delivery;
  const currentEvent = confirmEvent.target ? SELLER_DELIVERY_EVENTS.find((e) => e.status === confirmEvent.target) ?? null : null;
  const noteRequired = currentEvent?.status === 'delivery_failed' || currentEvent?.status === 'returned';

  return (
    <>
      {address && (
        <section aria-labelledby="order-address-heading" data-testid="order-shipping-address">
          <h3 id="order-address-heading" className="text-sm font-semibold text-text mb-2 flex items-center gap-1.5"><MapPin size={14} className="text-primary" /> Adresse de livraison</h3>
          <address className="not-italic text-sm bg-surface-secondary rounded-lg px-3 py-2.5 leading-relaxed text-text">
            {(address.recipientName || address.phone) && <p className="font-medium">{[address.recipientName, address.phone].filter(Boolean).join(' · ')}</p>}
            <p className="text-muted">{address.street}{address.complement ? `, ${address.complement}` : ''}</p>
            <p className="text-muted">{[address.postalCode, address.city, address.state].filter(Boolean).join(' ')}{address.country ? ` — ${address.country}` : ''}</p>
            {address.instructions && <p className="text-xs text-muted italic mt-1">« {address.instructions} »</p>}
          </address>
        </section>
      )}

      <section aria-labelledby="order-tracking-heading" data-testid="order-tracking">
        <h3 id="order-tracking-heading" className="text-sm font-semibold text-text mb-2 flex items-center gap-1.5"><Truck size={14} className="text-primary" /> Suivi de livraison</h3>
        {delivery ? (
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-surface-secondary">
              <span className={clsx('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold', DELIVERY_TONES[delivery.status])} data-testid="delivery-status">
                {DELIVERY_STATUS_LABELS[delivery.status] ?? delivery.status}
              </span>
              {delivery.estimatedDeliveryAt && !delivery.deliveredAt && (
                <span className="text-xs text-muted inline-flex items-center gap-1"><CalendarClock size={12} /> Estimée le {formatDate(delivery.estimatedDeliveryAt)}</span>
              )}
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 px-3 py-3 text-sm">
              {(delivery.carrier || delivery.method) && (
                <div><dt className="text-[11px] uppercase tracking-wide text-muted">Transporteur / mode</dt><dd className="text-text font-medium">{[delivery.carrier, delivery.method].filter(Boolean).join(' · ')}</dd></div>
              )}
              {delivery.trackingNumber && (
                <div><dt className="text-[11px] uppercase tracking-wide text-muted">Numéro de suivi</dt><dd className="text-text font-mono inline-flex items-center gap-1"><Hash size={12} className="text-muted" /> {delivery.trackingNumber}</dd></div>
              )}
              {delivery.shippedAt && <div><dt className="text-[11px] uppercase tracking-wide text-muted">Expédiée le</dt><dd className="text-text">{formatDateTime(delivery.shippedAt)}</dd></div>}
              {delivery.deliveredAt && <div><dt className="text-[11px] uppercase tracking-wide text-muted">Remise le</dt><dd className="text-text">{formatDateTime(delivery.deliveredAt)}</dd></div>}
              {delivery.receptionConfirmedAt && <div><dt className="text-[11px] uppercase tracking-wide text-muted">Réception confirmée le</dt><dd className="text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1"><CheckCircle2 size={13} /> {formatDateTime(delivery.receptionConfirmedAt)}</dd></div>}
              {delivery.note && <div className="sm:col-span-2"><dt className="text-[11px] uppercase tracking-wide text-muted">Dernière information</dt><dd className="text-text">{delivery.note}</dd></div>}
            </dl>
            {canDeclareEvents && (
              <div className="px-3 pb-3 flex flex-wrap gap-2" data-testid="delivery-actions">
                {SELLER_DELIVERY_EVENTS.filter((e) => e.status !== delivery.status).map((event) => (
                  <Button key={event.status} size="sm" variant={event.variant} icon={event.icon} onClick={() => { setNote(''); confirmEvent.request(event.status); }} disabled={updateDelivery.isPending} data-testid={`delivery-action-${event.status}`}>
                    {event.label}
                  </Button>
                ))}
              </div>
            )}
            {role === 'client' && order.status === 'shipped' && (
              <p className="px-3 pb-3 text-xs text-muted">Dès réception du colis, confirmez la réception depuis les actions ci-dessous : cela clôture la commande et libère le paiement au vendeur.</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted bg-surface-secondary rounded-lg px-3 py-2">
            {order.status === 'pending' ? 'La préparation débutera dès la confirmation de la commande par le vendeur.' : order.status === 'cancelled' ? 'Commande annulée : aucune livraison.' : 'Aucune information de livraison pour le moment.'}
          </p>
        )}
      </section>

      {history.length > 0 && (
        <section aria-labelledby="order-history-heading" data-testid="order-history">
          <h3 id="order-history-heading" className="text-sm font-semibold text-text mb-2 flex items-center gap-1.5"><History size={14} className="text-primary" /> Historique</h3>
          <ol className="relative border-l border-border ml-2 space-y-3">
            {[...history].reverse().map((entry: OrderHistoryEntry) => {
              const actor = entry.actorRole ? ACTOR_META[entry.actorRole] : undefined;
              const ActorIcon = actor?.icon ?? Cpu;
              const isDelivery = entry.toStatus.startsWith(DELIVERY_PREFIX);
              return (
                <li key={entry.id} className="ml-4">
                  <span className={clsx('absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full ring-4 ring-surface', isDelivery ? 'bg-indigo-400' : 'bg-primary')} aria-hidden="true" />
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                    {isDelivery ? <span className="font-medium text-text">{historyLabel(entry.toStatus)}</span> : <StatusBadge status={entry.toStatus} kind="order" />}
                    <time dateTime={entry.createdAt} className="text-xs text-muted">{formatDateTime(entry.createdAt)}</time>
                  </div>
                  <p className="text-xs text-muted inline-flex items-center gap-1 mt-0.5"><ActorIcon size={11} /> {actor?.label ?? 'Système'}{entry.comment ? ` — ${entry.comment}` : ''}</p>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <ConfirmDialog
        open={confirmEvent.isOpen}
        variant={currentEvent?.variant === 'danger' ? 'warning' : 'default'}
        title={currentEvent ? `${currentEvent.label} ?` : ''}
        description={currentEvent ? `${currentEvent.description} L'acheteur sera notifié de la commande ${order.orderNumber}.` : undefined}
        confirmLabel={currentEvent?.label ?? 'Confirmer'}
        loadingLabel="Mise à jour..."
        loading={updateDelivery.isPending}
        onConfirm={() => {
          if (noteRequired && note.trim().length < 3) return;
          void confirmEvent.run((status) => updateDelivery.mutateAsync({ id: order.id, dto: { status, comment: note.trim() || undefined } }));
        }}
        onCancel={confirmEvent.cancel}
      >
        <label className="block text-sm text-text text-left">
          <span className="block font-medium mb-1">{noteRequired ? 'Motif (obligatoire)' : 'Information pour l’acheteur (optionnel)'}</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} className="w-full px-3 py-2 border border-input-border bg-input-bg rounded-lg text-sm focus:outline-none focus:border-primary" placeholder={noteRequired ? 'Ex. destinataire absent, nouvelle tentative demain matin' : 'Ex. remis au gardien, colis déposé au point relais…'} data-testid="delivery-note" />
          {noteRequired && note.trim().length < 3 && <span className="block text-xs text-danger mt-1">Précisez le motif pour l’acheteur.</span>}
        </label>
      </ConfirmDialog>
    </>
  );
}

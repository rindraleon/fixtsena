import { useState } from 'react';
import { CheckCircle2, PackageCheck, Truck, XCircle, AlertTriangle, RotateCcw, Clock, type LucideIcon } from 'lucide-react';
import Button from '../common/Button';
import ConfirmDialog from '../common/ConfirmDialog';
import { FormField } from '../form';
import { useUpdateOrderStatus } from '../../hooks/mutations/useOrderMutations';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import { allowedOrderTransitions, DESTRUCTIVE_ORDER_STATUSES, isOrderPayable, orderActionLabel } from '../../lib/order-transitions';
import { ORDER_STATUS_LABELS } from '../../lib/format';
import type { AppRole } from '../../types/auth';
import type { ApiOrder, ApiPayment, OrderStatus } from '../../types/api';

const CARRIER_SUGGESTIONS = ['Livreur de la boutique', 'Colis Express', 'Paositra Malagasy', 'Taxi-brousse / coopérative', 'Retrait en boutique'];

interface ShippingForm {
  carrier: string;
  trackingNumber: string;
  estimatedDeliveryAt: string;
}

const EMPTY_SHIPPING: ShippingForm = { carrier: '', trackingNumber: '', estimatedDeliveryAt: '' };

const ICONS: Record<OrderStatus, LucideIcon> = {
  pending: Clock,
  confirmed: CheckCircle2,
  processing: PackageCheck,
  shipped: Truck,
  delivered: CheckCircle2,
  cancelled: XCircle,
  refunded: RotateCcw,
  in_dispute: AlertTriangle,
};

interface OrderStatusActionsProps {
  readonly order: ApiOrder;
  readonly role: AppRole;
  readonly size?: 'sm' | 'md';
  readonly payments?: readonly ApiPayment[];
}

export default function OrderStatusActions({ order, role, size = 'sm', payments }: OrderStatusActionsProps) {
  const updateStatus = useUpdateOrderStatus();
  const confirm = useConfirmAction<OrderStatus>();
  const [comment, setComment] = useState('');
  const [shipping, setShipping] = useState<ShippingForm>(EMPTY_SHIPPING);
  const [shippingTouched, setShippingTouched] = useState(false);
  const transitions = allowedOrderTransitions(order.status, role);
  const awaitingPayment = role === 'seller' && order.status === 'pending' && payments !== undefined && !isOrderPayable(payments);

  if (transitions.length === 0) return null;

  const pendingFor = updateStatus.isPending && updateStatus.variables?.id === order.id ? updateStatus.variables.dto.status : null;
  const target = confirm.target;
  const destructive = target ? DESTRUCTIVE_ORDER_STATUSES.has(target) : false;
  const isShipping = target === 'shipped' && role !== 'client';
  const shippingError = isShipping && shipping.carrier.trim().length < 2 ? 'Indiquez le mode de livraison ou le transporteur.' : undefined;

  const submitTransition = (status: OrderStatus) => {
    const base = { status, comment: comment.trim() || undefined };
    if (status === 'shipped' && role !== 'client') {
      return updateStatus.mutateAsync({
        id: order.id,
        dto: {
          ...base,
          carrier: shipping.carrier.trim(),
          trackingNumber: shipping.trackingNumber.trim() || undefined,
          estimatedDeliveryAt: shipping.estimatedDeliveryAt ? new Date(shipping.estimatedDeliveryAt).toISOString() : undefined,
        },
      });
    }
    return updateStatus.mutateAsync({ id: order.id, dto: base });
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {transitions.map((status) => {
          const Icon = ICONS[status];
          const isDestructive = DESTRUCTIVE_ORDER_STATUSES.has(status);
          return (
            <Button
              key={status}
              size={size}
              variant={isDestructive ? 'danger' : status === 'delivered' || status === 'confirmed' ? 'primary' : 'outline'}
              icon={Icon}
              loading={pendingFor === status}
              disabled={updateStatus.isPending || (awaitingPayment && status === 'confirmed')}
              title={awaitingPayment && status === 'confirmed' ? 'En attente du paiement de l’acheteur' : undefined}
              onClick={() => { setComment(''); setShipping(EMPTY_SHIPPING); setShippingTouched(false); confirm.request(status); }}
              data-testid={`order-action-${status}`}
            >
              {orderActionLabel(status, role)}
            </Button>
          );
        })}
      </div>
      {awaitingPayment && (
        <p className="text-xs text-muted flex items-center gap-1.5 mt-2" data-testid="order-awaiting-payment">
          <Clock size={13} /> En attente du paiement de l’acheteur : la commande pourra être acceptée dès que le paiement sera confirmé.
        </p>
      )}

      <ConfirmDialog
        open={confirm.isOpen}
        variant={destructive ? 'destructive' : 'default'}
        title={target ? `${orderActionLabel(target, role)} ?` : ''}
        description={target ? (role === 'client' && target === 'delivered'
          ? `Vous attestez avoir reçu la commande ${order.orderNumber} conforme. Les fonds séquestrés seront libérés au vendeur ; cette action est définitive.`
          : isShipping
            ? `Renseignez les informations d'acheminement : l'acheteur recevra le numéro de suivi et pourra suivre la livraison de la commande ${order.orderNumber}.`
            : `La commande ${order.orderNumber} passera au statut « ${ORDER_STATUS_LABELS[target]} ».`) : undefined}
        confirmLabel={target ? orderActionLabel(target, role) : 'Confirmer'}
        loadingLabel="Mise à jour..."
        loading={updateStatus.isPending}
        onConfirm={() => {
          if (isShipping && shippingError) { setShippingTouched(true); return; }
          void confirm.run(submitTransition);
        }}
        onCancel={confirm.cancel}
      >
        {isShipping && (
          <div className="space-y-3 text-left" data-testid="shipping-form">
            <FormField label="Mode de livraison / transporteur" value={shipping.carrier} onChange={(e) => setShipping((f) => ({ ...f, carrier: e.target.value }))} list="carrier-suggestions" placeholder="Livreur de la boutique, Colis Express…" error={shippingTouched ? shippingError : undefined} required data-testid="shipping-carrier" />
            <datalist id="carrier-suggestions">
              {CARRIER_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
            </datalist>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Numéro de suivi" value={shipping.trackingNumber} onChange={(e) => setShipping((f) => ({ ...f, trackingNumber: e.target.value }))} placeholder="Ex. CE-2026-0001" maxLength={80} data-testid="shipping-tracking" />
              <FormField label="Livraison estimée" type="date" min={new Date().toISOString().slice(0, 10)} value={shipping.estimatedDeliveryAt} onChange={(e) => setShipping((f) => ({ ...f, estimatedDeliveryAt: e.target.value }))} data-testid="shipping-eta" />
            </div>
            <label className="block text-sm text-text">
              <span className="block font-medium mb-1">Message pour l'acheteur (optionnel)</span>
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} maxLength={500} className="w-full px-3 py-2 border border-input-border bg-input-bg rounded-lg text-sm focus:outline-none focus:border-primary" placeholder="Horaires de passage, consignes de remise…" />
            </label>
          </div>
        )}
        {destructive && (
          <label className="block text-sm text-text">
            <span className="block font-medium mb-1">Motif (optionnel)</span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              maxLength={500}
              className="w-full px-3 py-2 border border-input-border bg-input-bg rounded-lg text-sm focus:outline-none focus:border-primary"
              placeholder="Expliquez la raison à l'autre partie…"
            />
          </label>
        )}
      </ConfirmDialog>
    </>
  );
}

import { useState } from 'react';
import { Banknote, Smartphone, Wallet } from 'lucide-react';
import clsx from 'clsx';
import Button from '../common/Button';
import { useInitiatePayment } from '../../hooks/mutations/usePaymentMutations';
import { PAYMENT_METHOD_LABELS } from '../../lib/format';
import type { ApiOrder, PaymentMethod } from '../../types/api';

const METHODS: readonly PaymentMethod[] = ['mvola', 'orange_money', 'airtel_money', 'cash_on_delivery'];

interface OrderPaymentRetryProps {
  readonly order: ApiOrder;
}

export default function OrderPaymentRetry({ order }: OrderPaymentRetryProps) {
  const [method, setMethod] = useState<PaymentMethod>('mvola');
  const initiatePayment = useInitiatePayment();

  return (
    <section aria-labelledby="order-payment-retry-heading" className="rounded-xl border border-amber-300/70 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 p-3 space-y-3" data-testid="order-payment-retry">
      <div className="flex items-start gap-2">
        <Wallet size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" aria-hidden="true" />
        <div>
          <h3 id="order-payment-retry-heading" className="text-sm font-semibold text-text">Paiement en attente</h3>
          <p className="text-xs text-muted">Le vendeur ne pourra accepter la commande qu’une fois le paiement confirmé. Choisissez un moyen de paiement pour la régler.</p>
        </div>
      </div>
      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="sr-only">Moyen de paiement</legend>
        {METHODS.map((value) => {
          const Icon = value === 'cash_on_delivery' ? Banknote : Smartphone;
          const selected = method === value;
          return (
            <label key={value} className={clsx('flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs cursor-pointer transition-colors', selected ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted hover:border-primary/40')}>
              <input type="radio" name={`payment-retry-${order.id}`} value={value} checked={selected} onChange={() => setMethod(value)} className="accent-primary" />
              <Icon size={14} aria-hidden="true" />
              <span className="truncate">{PAYMENT_METHOD_LABELS[value]}</span>
            </label>
          );
        })}
      </fieldset>
      <Button
        size="sm"
        fullWidth
        loading={initiatePayment.isPending}
        loadingLabel="Paiement en cours..."
        onClick={() => initiatePayment.mutate({ orderId: order.id, method })}
        data-testid="order-pay-now"
      >
        Payer maintenant
      </Button>
    </section>
  );
}

import clsx from 'clsx';
import { Smartphone } from 'lucide-react';
import { PAYMENT_METHOD_LABELS } from '../../lib/format';

interface PaymentMethodPickerProps {
  readonly value: string;
  readonly onChange: (method: string) => void;
  readonly methods?: readonly string[];
  readonly disabled?: boolean;
}

const DEFAULT_METHODS = ['mvola', 'orange_money', 'airtel_money'] as const;

export default function PaymentMethodPicker({ value, onChange, methods = DEFAULT_METHODS, disabled }: PaymentMethodPickerProps) {
  return (
    <div role="radiogroup" aria-label="Moyen de paiement" className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      {methods.map((method) => {
        const selected = value === method;
        return (
          <label key={method} className={clsx('flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer text-sm transition-all', selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40', disabled && 'opacity-60 cursor-not-allowed')}>
            <input type="radio" name="payment-method" value={method} checked={selected} onChange={() => onChange(method)} disabled={disabled} className="accent-primary" />
            <Smartphone size={16} className={selected ? 'text-primary' : 'text-muted'} />
            <span className="font-medium text-text">{PAYMENT_METHOD_LABELS[method] ?? method}</span>
          </label>
        );
      })}
    </div>
  );
}

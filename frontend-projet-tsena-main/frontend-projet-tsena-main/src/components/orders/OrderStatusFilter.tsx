import clsx from 'clsx';
import { ORDER_STATUS_LABELS } from '../../lib/format';
import type { OrderStatus } from '../../types/api';

interface OrderStatusFilterProps {
  readonly value: OrderStatus | '';
  readonly onChange: (value: OrderStatus | '') => void;
  readonly statuses?: readonly OrderStatus[];
  readonly counts?: Partial<Record<OrderStatus | 'all', number>>;
}

const DEFAULT_STATUSES: readonly OrderStatus[] = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'in_dispute', 'refunded'];

export default function OrderStatusFilter({ value, onChange, statuses = DEFAULT_STATUSES, counts }: OrderStatusFilterProps) {
  const options: { key: OrderStatus | ''; label: string }[] = [{ key: '', label: 'Toutes' }, ...statuses.map((s) => ({ key: s, label: ORDER_STATUS_LABELS[s] }))];
  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1" role="tablist" aria-label="Filtrer par statut">
      {options.map((option) => {
        const active = option.key === value;
        const count = option.key === '' ? counts?.all : counts?.[option.key];
        return (
          <button
            key={option.key || 'all'}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.key)}
            className={clsx(
              'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              active ? 'bg-primary text-white border-primary' : 'bg-surface text-muted border-border hover:border-primary/40 hover:text-primary',
            )}
          >
            {option.label}
            {count !== undefined && <span className={clsx('ml-1.5 tabular-nums', active ? 'text-white/80' : 'text-muted')}>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

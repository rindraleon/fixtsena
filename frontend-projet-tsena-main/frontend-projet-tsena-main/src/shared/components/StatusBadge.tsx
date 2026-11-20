import clsx from 'clsx';
import { ACCOUNT_STATUS_LABELS, DISPUTE_STATUS_LABELS, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, PRODUCT_STATUS_LABELS } from '../../lib/format';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  processing: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  shipped: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300',
  delivered: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  refunded: 'bg-gray-100 text-gray-700 dark:bg-gray-500/15 dark:text-gray-300',
  in_dispute: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-500/15 dark:text-gray-300',
  pending_review: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  active: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  published: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  unavailable: 'bg-gray-100 text-gray-600 dark:bg-gray-500/15 dark:text-gray-300',
  sold_out: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  suspended: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  archived: 'bg-gray-100 text-gray-500 dark:bg-gray-500/15 dark:text-gray-400',
  initiated: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  success: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  escrow: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  released: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  inactive: 'bg-gray-100 text-gray-600 dark:bg-gray-500/15 dark:text-gray-300',
  pending_verification: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  banned: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  deleted: 'bg-gray-100 text-gray-500 dark:bg-gray-500/15 dark:text-gray-400',
  disabled: 'bg-gray-100 text-gray-600 dark:bg-gray-500/15 dark:text-gray-300',
  reported: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  open: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  awaiting_evidence: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  under_review: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  resolved_buyer: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  resolved_seller: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  partial_resolution: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
  closed: 'bg-gray-100 text-gray-600 dark:bg-gray-500/15 dark:text-gray-300',
  pending_payment: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  expired: 'bg-gray-100 text-gray-600 dark:bg-gray-500/15 dark:text-gray-300',
  replaced: 'bg-gray-100 text-gray-500 dark:bg-gray-500/15 dark:text-gray-400',
  stopped: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  sent: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  queued: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  skipped: 'bg-gray-100 text-gray-600 dark:bg-gray-500/15 dark:text-gray-300',
};

type StatusKind = 'order' | 'product' | 'payment' | 'account' | 'dispute' | 'auto' | 'generic';

interface StatusBadgeProps {
  readonly status: string;
  readonly kind?: StatusKind;
  readonly label?: string;
  readonly className?: string;
}

function resolveLabel(status: string, kind: StatusKind): string {
  const maps: Record<string, string>[] =
    kind === 'order' ? [ORDER_STATUS_LABELS]
    : kind === 'product' ? [PRODUCT_STATUS_LABELS]
    : kind === 'payment' ? [PAYMENT_STATUS_LABELS]
    : kind === 'account' ? [ACCOUNT_STATUS_LABELS]
    : kind === 'dispute' ? [DISPUTE_STATUS_LABELS]
    : [ORDER_STATUS_LABELS, PRODUCT_STATUS_LABELS, PAYMENT_STATUS_LABELS, ACCOUNT_STATUS_LABELS, DISPUTE_STATUS_LABELS];
  for (const map of maps) {
    if (map[status]) return map[status];
  }
  return status;
}

export default function StatusBadge({ status, kind = 'auto', label, className }: StatusBadgeProps) {
  return (
    <span className={clsx('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap', STATUS_STYLES[status] ?? 'bg-surface-tertiary text-muted', className)}>
      {label ?? (kind === 'generic' ? status : resolveLabel(status, kind))}
    </span>
  );
}

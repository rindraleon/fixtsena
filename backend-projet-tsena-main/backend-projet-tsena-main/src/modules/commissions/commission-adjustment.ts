export type RefundPolicy = 'full' | 'partial' | 'none';

export const REFUND_POLICIES: readonly RefundPolicy[] = ['full', 'partial', 'none'];

export const REFUND_POLICY_LABELS: Record<RefundPolicy, string> = {
  full: 'Restitution intégrale : la commission est annulée dès qu’un remboursement (total ou partiel) est accordé',
  partial: 'Au prorata : la commission est recalculée sur le montant effectivement conservé par le vendeur',
  none: 'Conservée : la commission reste due intégralement, même en cas de remboursement',
};

export interface CommissionAdjustmentInput {
  totalAmount: number | string | null;
  subtotalAmount: number | string | null;
  commissionAmount: number | string | null;
  refundAmount: number | string | null;
  policy: RefundPolicy | string | null | undefined;
}

export interface CommissionAdjustment {
  policy: RefundPolicy;
  refundedAmount: number;
  keptRatio: number;
  previousCommissionAmount: number;
  commissionAmount: number;
  sellerNetAmount: number;
  changed: boolean;
}

const toAmount = (value: number | string | null | undefined): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export function normalizeRefundPolicy(value: unknown): RefundPolicy {
  return REFUND_POLICIES.includes(value as RefundPolicy) ? (value as RefundPolicy) : 'partial';
}

export function refundAmountForPercentage(totalAmount: number | string | null, percentage: number | null | undefined): number {
  const total = toAmount(totalAmount);
  const pct = Math.min(100, Math.max(0, Number(percentage ?? 0) || 0));
  return Math.round((total * pct) / 100);
}

export function adjustCommissionAfterRefund(input: CommissionAdjustmentInput): CommissionAdjustment {
  const policy = normalizeRefundPolicy(input.policy);
  const total = toAmount(input.totalAmount);
  const subtotal = toAmount(input.subtotalAmount);
  const previous = Math.round(toAmount(input.commissionAmount));
  const refunded = Math.min(total, Math.round(toAmount(input.refundAmount)));
  const keptRatio = total > 0 ? (total - refunded) / total : refunded > 0 ? 0 : 1;

  let commission = previous;
  if (refunded > 0) {
    if (policy === 'full') commission = 0;
    else if (policy === 'partial') commission = Math.round(previous * keptRatio);
  }
  const sellerNet = Math.max(0, Math.round(subtotal * keptRatio - commission));

  return {
    policy,
    refundedAmount: refunded,
    keptRatio: Math.round(keptRatio * 10000) / 10000,
    previousCommissionAmount: previous,
    commissionAmount: commission,
    sellerNetAmount: sellerNet,
    changed: commission !== previous,
  };
}

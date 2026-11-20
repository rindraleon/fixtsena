import { SubscriptionPeriod, SubscriptionPlan } from '../../database/entities/role.enum';

export type SubscriptionChangeKind =
  | 'new'
  | 'renewal'
  | 'upgrade'
  | 'downgrade';

const PLAN_RANK: Record<SubscriptionPlan, number> = { [SubscriptionPlan.GOLD]: 1, [SubscriptionPlan.PREMIUM]: 2 };
const PLAN_LABEL: Record<SubscriptionPlan, string> = { [SubscriptionPlan.GOLD]: 'Gold', [SubscriptionPlan.PREMIUM]: 'Premium' };

export function resolveSubscriptionChange(activePlan: SubscriptionPlan | null | undefined, requested: SubscriptionPlan): SubscriptionChangeKind {
  if (!activePlan) return 'new';
  if (activePlan === requested) return 'renewal';
  return PLAN_RANK[requested] > PLAN_RANK[activePlan] ? 'upgrade' : 'downgrade';
}

export function isScheduledChange(kind: SubscriptionChangeKind): boolean {
  return kind === 'renewal' || kind === 'downgrade';
}

export function addSubscriptionPeriod(start: Date, period: SubscriptionPeriod): Date {
  const end = new Date(start);
  if (period === SubscriptionPeriod.YEARLY) end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  return end;
}

export function computeSubscriptionWindow(
  kind: SubscriptionChangeKind,
  period: SubscriptionPeriod,
  now: Date,
  activeEndsAt: Date | null | undefined,
): { startsAt: Date; endsAt: Date; scheduled: boolean } {
  const scheduled = isScheduledChange(kind) && !!activeEndsAt && new Date(activeEndsAt).getTime() > now.getTime();
  const startsAt = scheduled ? new Date(activeEndsAt as Date) : new Date(now);
  return { startsAt, endsAt: addSubscriptionPeriod(startsAt, period), scheduled };
}

const fr = (d: Date | null | undefined) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');

export function describeSubscriptionChange(kind: SubscriptionChangeKind, requested: SubscriptionPlan, activeEndsAt: Date | null | undefined): string {
  const label = PLAN_LABEL[requested];
  switch (kind) {
    case 'new':
      return `Abonnement ${label} créé : procédez au paiement pour activer vos avantages`;
    case 'renewal':
      return `Renouvellement ${label} créé : après paiement, il prolongera votre abonnement à partir du ${fr(activeEndsAt)}`;
    case 'upgrade':
      return `Passage à ${label} créé : après paiement, Premium remplace immédiatement votre abonnement Gold`;
    case 'downgrade':
      return `Passage à ${label} créé : après paiement, il prendra effet le ${fr(activeEndsAt)}, à l'expiration de votre abonnement Premium (vos avantages Premium restent actifs jusque-là)`;
  }
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarClock, Check, Crown, History, Info, Sparkles, Wallet } from 'lucide-react';
import clsx from 'clsx';
import { useTitle } from '../../hooks';
import { useMyShop, useMySubscription, useSubscriptionChangePreview, useSubscriptionPlans } from '../../hooks/queries/useShops';
import { useCancelSubscription, usePaySubscription, useSubscribe } from '../../hooks/mutations/useShopMutations';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import { Button, ConfirmDialog, EmptyState, ErrorState, LoadingState } from '../../components/common';
import PaymentMethodPicker from '../../components/common/PaymentMethodPicker';
import { ShopLevelBadge } from '../../components/shops';
import StatusBadge from '../../shared/components/StatusBadge';
import PageHeader from '../../shared/components/PageHeader';
import { formatDate, formatPrice, PAYMENT_METHOD_LABELS } from '../../lib/format';
import {
  SUBSCRIPTION_CHANGE_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
  type ApiSubscription,
  type SubscriptionChangeKind,
  type SubscriptionPeriod,
  type SubscriptionPlan,
} from '../../types/api';

const PERIOD_LABELS: Record<SubscriptionPeriod, string> = { monthly: 'Mensuel', yearly: 'Annuel' };
const PLAN_LABELS: Record<SubscriptionPlan, string> = { gold: 'Gold', premium: 'Premium' };

function resolveChangeKind(currentPlan: SubscriptionPlan | null, target: SubscriptionPlan): SubscriptionChangeKind {
  if (!currentPlan) return 'new';
  if (currentPlan === target) return 'renewal';
  return target === 'premium' ? 'upgrade' : 'downgrade';
}

function ctaLabel(kind: SubscriptionChangeKind, target: SubscriptionPlan, currentEndsAt: string | null): string {
  const date = currentEndsAt ? formatDate(currentEndsAt) : null;
  switch (kind) {
    case 'new':
      return `Choisir ${PLAN_LABELS[target]}`;
    case 'renewal':
      return date ? `Renouveler ${PLAN_LABELS[target]} (dès le ${date})` : `Renouveler ${PLAN_LABELS[target]}`;
    case 'upgrade':
      return 'Passer à Premium (immédiat)';
    case 'downgrade':
      return date ? `Passer à Gold le ${date}` : 'Passer à Gold à l’expiration';
  }
}

export default function SellerSubscriptionPage() {
  useTitle('Abonnement vendeur');
  const shopQuery = useMyShop();
  const plansQuery = useSubscriptionPlans();
  const mineQuery = useMySubscription({ enabled: !!shopQuery.data });
  const subscribe = useSubscribe();
  const pay = usePaySubscription();
  const cancel = useCancelSubscription();
  const cancelConfirm = useConfirmAction<ApiSubscription>();
  const [period, setPeriod] = useState<SubscriptionPeriod>('monthly');
  const [method, setMethod] = useState('mvola');

  if (shopQuery.isPending) return <LoadingState variant="page" label="Chargement..." />;
  if (shopQuery.isError) return <ErrorState error={shopQuery.error} onRetry={() => void shopQuery.refetch()} retrying={shopQuery.isFetching} />;
  if (!shopQuery.data) {
    return (
      <div className="max-w-3xl">
        <PageHeader title="Abonnement vendeur" subtitle="Niveaux Gold et Premium" />
        <EmptyState icon={Crown} title="Créez d'abord votre boutique" description="L'abonnement s'applique à une boutique active. Créez et faites vérifier votre boutique pour y accéder." action={{ label: 'Créer ma boutique', to: '/dashboard/vendeur/boutique' }} />
      </div>
    );
  }

  const shop = shopQuery.data;
  const mine = mineQuery.data;
  const current = mine?.current ?? null;
  const pending = mine?.pending ?? null;
  const scheduled = mine?.scheduled ?? null;
  const isFounder = mine?.shop?.founder ?? shop.level === 'founder';
  const daysLeft = current?.endsAt ? Math.ceil((new Date(current.endsAt).getTime() - Date.now()) / 86_400_000) : null;
  const expiringSoon = daysLeft !== null && daysLeft <= 7;

  const handleSubscribe = (plan: SubscriptionPlan) => subscribe.mutate({ plan, period });
  const pendingKind = pending ? resolveChangeKind(current?.plan ?? null, pending.plan) : null;

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title="Abonnement vendeur" subtitle="Débloquez les niveaux Gold et Premium : commissions réduites, visibilité et promotions à tarif préférentiel" />

      <section className="bg-surface rounded-xl border border-border p-5" aria-labelledby="current-heading" data-testid="subscription-current">
        <h2 id="current-heading" className="font-semibold text-text flex items-center gap-2 mb-3"><Crown size={18} className="text-primary" /> Mon niveau actuel</h2>
        <div className="flex flex-wrap items-center gap-3">
          <ShopLevelBadge level={shop.level} label={shop.levelLabel} size="sm" />
          {shop.status !== 'active' && <span className="text-xs text-amber-700 dark:text-amber-300 inline-flex items-center gap-1"><AlertTriangle size={13} /> Boutique non active ({shop.statusLabel}) : les avantages d'un abonnement ne s'appliquent qu'à une boutique active.</span>}
        </div>
        {mineQuery.isPending ? (
          <div className="mt-3"><LoadingState variant="inline" label="Chargement de l'abonnement..." /></div>
        ) : mineQuery.isError ? (
          <div className="mt-3"><ErrorState error={mineQuery.error} onRetry={() => void mineQuery.refetch()} compact /></div>
        ) : isFounder ? (
          <p className="mt-3 text-sm text-muted flex items-center gap-2"><Sparkles size={14} className="text-primary" /> Votre boutique bénéficie du statut <strong>Fondateur</strong>, attribué par l'administration : aucun abonnement n'est nécessaire.</p>
        ) : current ? (
          <div className={clsx('mt-3 rounded-lg border p-3 text-sm', expiringSoon ? 'border-amber-300 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30' : 'border-emerald-200 bg-emerald-50 dark:bg-emerald-500/10 dark:border-emerald-500/30')}>
            <p className="font-medium text-text">Abonnement {current.plan === 'premium' ? 'Premium' : 'Gold'} · {PERIOD_LABELS[current.period]} · {formatPrice(current.amount)}</p>
            <p className="text-muted mt-0.5">Actif depuis le {formatDate(current.startsAt)} — expire le {formatDate(current.endsAt)}{daysLeft !== null ? ` (${daysLeft > 0 ? `${daysLeft} jour${daysLeft > 1 ? 's' : ''} restant${daysLeft > 1 ? 's' : ''}` : 'aujourd’hui'})` : ''}.</p>
            {expiringSoon && !scheduled && <p className="mt-1 text-amber-800 dark:text-amber-200 flex items-center gap-1"><AlertTriangle size={13} /> Votre niveau repassera automatiquement au niveau d'éligibilité à l'expiration. Renouvelez ci-dessous.</p>}
            <p className="mt-1 text-xs text-muted">Aucun renouvellement automatique (F-ABV-05) : sans renouvellement de votre part, l'abonnement s'arrête de lui-même à l'échéance, sans frais.</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">Aucun abonnement actif. Votre niveau est déterminé par vos critères d'éligibilité (<Link to="/dashboard/vendeur/boutique" className="text-primary hover:underline">voir ma boutique</Link>).</p>
        )}
      </section>

      {scheduled && (
        <section className="bg-surface rounded-xl border border-sky-300 dark:border-sky-500/40 p-5" aria-labelledby="scheduled-heading" data-testid="subscription-scheduled">
          <h2 id="scheduled-heading" className="font-semibold text-text flex items-center gap-2 mb-1"><CalendarClock size={18} className="text-sky-600 dark:text-sky-300" /> Abonnement programmé</h2>
          <p className="text-sm text-muted">
            Abonnement {PLAN_LABELS[scheduled.plan]} · {PERIOD_LABELS[scheduled.period]} · <strong className="text-text">{formatPrice(scheduled.amount)}</strong> déjà réglé.
            {' '}Il prendra effet automatiquement le <strong className="text-text">{formatDate(scheduled.startsAt)}</strong>
            {current ? ` à l'expiration de votre abonnement ${PLAN_LABELS[current.plan]}` : ''} et courra jusqu'au {formatDate(scheduled.endsAt)}.
            {current && scheduled.plan === 'gold' && current.plan === 'premium' ? ' Vos avantages Premium restent actifs jusque-là.' : ''}
          </p>
          <p className="text-xs text-muted mt-2 flex items-start gap-1.5"><Info size={13} className="shrink-0 mt-0.5" /> Une seule programmation à la fois : toute nouvelle souscription sera possible après son activation.</p>
        </section>
      )}

      {pending && (
        <section className="bg-surface rounded-xl border-2 border-primary/40 p-5" aria-labelledby="pending-heading" data-testid="subscription-pending">
          <h2 id="pending-heading" className="font-semibold text-text flex items-center gap-2 mb-1"><Wallet size={18} className="text-primary" /> Paiement en attente</h2>
          <p className="text-sm text-muted mb-1">Abonnement {PLAN_LABELS[pending.plan]} · {PERIOD_LABELS[pending.period]} · <strong className="text-text">{formatPrice(pending.amount)}</strong>.</p>
          <PendingChangeNotice plan={pending.plan} fallbackKind={pendingKind} currentEndsAt={current?.endsAt ?? null} />
          <PaymentMethodPicker value={method} onChange={setMethod} disabled={pay.isPending} />
          <div className="flex flex-wrap justify-end gap-2 mt-3">
            <Button variant="ghost" onClick={() => cancelConfirm.request(pending)} disabled={pay.isPending}>Annuler la demande</Button>
            <Button icon={Wallet} loading={pay.isPending} loadingLabel="Paiement..." onClick={() => pay.mutate({ id: pending.id, method })} data-testid="subscription-pay">Payer {formatPrice(pending.amount)} via {PAYMENT_METHOD_LABELS[method] ?? method}</Button>
          </div>
        </section>
      )}

      {!isFounder && (
        <section aria-labelledby="plans-heading">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 id="plans-heading" className="font-semibold text-text text-lg">Offres</h2>
            <div className="inline-flex rounded-lg border border-border p-0.5 bg-surface" role="radiogroup" aria-label="Période">
              {(['monthly', 'yearly'] as SubscriptionPeriod[]).map((p) => (
                <button key={p} type="button" role="radio" aria-checked={period === p} onClick={() => setPeriod(p)} className={clsx('px-3 py-1.5 rounded-md text-sm font-medium transition-colors', period === p ? 'bg-primary text-white' : 'text-muted hover:text-text')}>{PERIOD_LABELS[p]}</button>
              ))}
            </div>
          </div>
          {plansQuery.isPending ? (
            <LoadingState variant="cards" count={2} />
          ) : plansQuery.isError ? (
            <ErrorState error={plansQuery.error} onRetry={() => void plansQuery.refetch()} retrying={plansQuery.isFetching} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="subscription-plans">
              {plansQuery.data?.map((offer) => {
                const price = period === 'yearly' ? offer.yearlyPrice : offer.monthlyPrice;
                const kind = resolveChangeKind(current?.plan ?? null, offer.plan);
                const isCurrent = kind === 'renewal';
                const soldOut = offer.slotsLeft <= 0 && !isCurrent;
                const disabled = !!pending || !!scheduled || soldOut || shop.status !== 'active' || subscribe.isPending;
                return (
                  <article key={offer.plan} className={clsx('relative bg-surface rounded-2xl border-2 p-6 flex flex-col', offer.plan === 'premium' ? 'border-primary shadow-lg' : 'border-border')}>
                    {offer.plan === 'premium' && <span className="absolute -top-3 left-6 px-2.5 py-0.5 rounded-full bg-primary text-white text-[11px] font-bold uppercase tracking-wide">Recommandé</span>}
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xl font-bold text-text flex items-center gap-2"><ShopLevelBadge level={offer.plan} size="sm" /></h3>
                      <span className="text-xs text-muted">{offer.slotsLeft > 0 ? `${offer.slotsLeft} place${offer.slotsLeft > 1 ? 's' : ''} restante${offer.slotsLeft > 1 ? 's' : ''}` : 'Complet'}</span>
                    </div>
                    {isCurrent && <span className="mt-2 inline-flex w-fit items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300"><Check size={12} /> Votre formule actuelle</span>}
                    <p className="mt-3"><span className="text-3xl font-bold text-primary">{formatPrice(price)}</span> <span className="text-sm text-muted">/ {period === 'yearly' ? 'an' : 'mois'}</span></p>
                    <ul className="mt-4 space-y-2 text-sm flex-1">
                      {offer.benefits.map((b) => <li key={b} className="flex items-start gap-2"><Check size={16} className="text-emerald-600 shrink-0 mt-0.5" /> <span className="text-text">{b}</span></li>)}
                    </ul>
                    {current && !scheduled && !pending && (
                      <p className="mt-4 text-xs text-muted flex items-start gap-1.5" data-testid={`change-hint-${offer.plan}`}>
                        <Info size={13} className="shrink-0 mt-0.5" />
                        <span><strong className="text-text">{SUBSCRIPTION_CHANGE_LABELS[kind]}</strong> — {kind === 'upgrade' ? 'Premium remplace Gold dès le paiement ; votre Gold est clôturé.' : kind === 'downgrade' ? `Vous conservez Premium jusqu'au ${formatDate(current.endsAt)} ; Gold démarre ensuite.` : `Prolonge votre abonnement à partir du ${formatDate(current.endsAt)}, sans interruption.`}</span>
                      </p>
                    )}
                    <Button className="mt-5" fullWidth variant={offer.plan === 'premium' ? 'primary' : 'outline'} disabled={disabled} loading={subscribe.isPending && subscribe.variables?.plan === offer.plan} loadingLabel="Création..." onClick={() => handleSubscribe(offer.plan)} data-testid={`subscribe-${offer.plan}`}>
                      {scheduled ? 'Programmation en attente d’activation' : soldOut ? 'Plus de place disponible' : ctaLabel(kind, offer.plan, current?.endsAt ?? null)}
                    </Button>
                  </article>
                );
              })}
            </div>
          )}
          <p className="text-xs text-muted mt-3 flex items-start gap-1.5"><Info size={13} className="shrink-0 mt-0.5" /> Un seul niveau actif à la fois : Premium remplace immédiatement Gold ; le passage de Premium à Gold et les renouvellements sont programmés à l'échéance de l'abonnement en cours. Les avantages s'appliquent uniquement après confirmation du paiement et cessent à l'expiration (retour automatique au niveau d'éligibilité). Les commandes en cours conservent leur taux de commission.</p>
        </section>
      )}

      {mine && mine.history.length > 0 && (
        <section className="bg-surface rounded-xl border border-border p-5" aria-labelledby="history-heading">
          <h2 id="history-heading" className="font-semibold text-text flex items-center gap-2 mb-3"><History size={18} className="text-primary" /> Historique</h2>
          <ul className="divide-y divide-border text-sm">
            {mine.history.map((s) => (
              <li key={s.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-text">{s.plan === 'premium' ? 'Premium' : 'Gold'} · {PERIOD_LABELS[s.period]} · {formatPrice(s.amount)}</span>
                <span className="text-xs text-muted">{s.startsAt ? `${formatDate(s.startsAt)} → ${formatDate(s.endsAt)}` : `Créé le ${formatDate(s.createdAt)}`}</span>
                <StatusBadge status={s.status} kind="generic" label={SUBSCRIPTION_STATUS_LABELS[s.status]} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <ConfirmDialog
        open={cancelConfirm.isOpen}
        variant="destructive"
        title="Annuler la demande d’abonnement ?"
        description="La demande en attente de paiement sera annulée. Vous pourrez en créer une nouvelle à tout moment."
        confirmLabel="Annuler la demande"
        loadingLabel="Traitement..."
        loading={cancel.isPending}
        onConfirm={() => void cancelConfirm.run((s) => cancel.mutateAsync(s.id))}
        onCancel={cancelConfirm.cancel}
      />
    </div>
  );
}

function PendingChangeNotice({ plan, fallbackKind, currentEndsAt }: { readonly plan: SubscriptionPlan; readonly fallbackKind: SubscriptionChangeKind | null; readonly currentEndsAt: string | null }) {
  const preview = useSubscriptionChangePreview(plan);
  const kind = preview.data?.change ?? fallbackKind ?? 'new';
  const message =
    preview.data?.message ??
    (kind === 'new' || kind === 'upgrade'
      ? 'Les avantages s’activent dès la confirmation du paiement.'
      : `Après paiement, l’abonnement prendra effet le ${currentEndsAt ? formatDate(currentEndsAt) : 'à l’échéance de votre abonnement actuel'}.`);
  return (
    <p className="text-sm text-muted mb-3 flex items-start gap-1.5" data-testid="pending-change-notice">
      <Info size={14} className="shrink-0 mt-0.5 text-primary" />
      <span><strong className="text-text">{SUBSCRIPTION_CHANGE_LABELS[kind]}</strong> — {message}</span>
    </p>
  );
}

import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Megaphone, Crown, StopCircle, Wallet, TrendingUp, Activity } from 'lucide-react';
import clsx from 'clsx';
import { useTitle } from '../../hooks';
import { useAdminPromotionStats, useAdminPromotions } from '../../hooks/queries/usePromotions';
import { useAdminSubscriptions } from '../../hooks/queries/useShops';
import { useAdminStopPromotion } from '../../hooks/mutations/usePromotionMutations';
import { Button, ConfirmDialog, DataTable, ErrorState, StatCardSkeleton } from '../../components/common';
import { FormField } from '../../components/form';
import { ShopLevelBadge } from '../../components/shops';
import StatusBadge from '../../shared/components/StatusBadge';
import PageHeader from '../../shared/components/PageHeader';
import { formatDate, formatPrice, fullName } from '../../lib/format';
import { PROMOTION_STATUS_LABELS, PROMOTION_TYPE_LABELS, SUBSCRIPTION_STATUS_LABELS, type ApiPromotion, type ApiSubscription, type PromotionStatus, type PromotionType, type SubscriptionPlan, type SubscriptionStatus } from '../../types/api';

type Tab = 'promotions' | 'subscriptions';
const PAGE_SIZE = 15;

function PromotionsTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const status = (searchParams.get('status') ?? '') as PromotionStatus | '';
  const type = (searchParams.get('type') ?? '') as PromotionType | '';
  const statsQuery = useAdminPromotionStats();
  const listQuery = useAdminPromotions({ status: status || undefined, type: type || undefined, page, limit: PAGE_SIZE });
  const stop = useAdminStopPromotion();
  const [stopping, setStopping] = useState<ApiPromotion | null>(null);
  const [reason, setReason] = useState('');

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'promotions');
    if (!value) next.delete(key); else next.set(key, value);
    if (key !== 'page') next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const stats = statsQuery.data;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statsQuery.isPending ? Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />) : statsQuery.isError ? <div className="sm:col-span-3"><ErrorState error={statsQuery.error} onRetry={() => void statsQuery.refetch()} compact /></div> : stats && (
          <>
            <div className="bg-surface rounded-xl border border-border p-4"><p className="text-xs text-muted flex items-center gap-1"><Activity size={12} /> Promotions actives</p><p className="text-2xl font-bold text-text mt-1">{stats.active}</p></div>
            <div className="bg-surface rounded-xl border border-border p-4"><p className="text-xs text-muted flex items-center gap-1"><TrendingUp size={12} /> Revenus promotions</p><p className="text-2xl font-bold text-primary mt-1">{formatPrice(stats.revenue)}</p></div>
            <div className="bg-surface rounded-xl border border-border p-4"><p className="text-xs text-muted flex items-center gap-1"><Wallet size={12} /> En attente de paiement</p><p className="text-2xl font-bold text-text mt-1">{stats.byStatus.pending_payment ?? 0}</p></div>
          </>
        )}
      </div>

      <DataTable<ApiPromotion>
        data={listQuery.data?.items ?? []}
        data-testid="admin-promotions-table"
        isLoading={listQuery.isPending}
        isFetching={listQuery.isFetching}
        error={listQuery.isError ? listQuery.error : null}
        onRetry={() => void listQuery.refetch()}
        emptyIcon={Megaphone}
        emptyTitle="Aucune promotion"
        emptyDescription="Les promotions achetées par les vendeurs apparaîtront ici."
        toolbar={
          <div className="flex flex-wrap gap-2">
            <select value={status} onChange={(e) => setParam('status', e.target.value || null)} className="px-3 py-2 rounded-lg border border-input-border bg-input-bg text-sm text-text" aria-label="Statut">
              <option value="">Tous les statuts</option>
              {(Object.keys(PROMOTION_STATUS_LABELS) as PromotionStatus[]).map((s) => <option key={s} value={s}>{PROMOTION_STATUS_LABELS[s]}</option>)}
            </select>
            <select value={type} onChange={(e) => setParam('type', e.target.value || null)} className="px-3 py-2 rounded-lg border border-input-border bg-input-bg text-sm text-text" aria-label="Type">
              <option value="">Tous les types</option>
              {(Object.keys(PROMOTION_TYPE_LABELS) as PromotionType[]).map((t) => <option key={t} value={t}>{PROMOTION_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
        }
        columns={[
          { header: 'Produit', primary: true, cell: (p) => <div className="min-w-0"><Link to={p.product ? `/produits/${p.product.slug}` : '#'} className="font-medium text-text hover:text-primary block truncate">{p.product?.name ?? '—'}</Link><p className="text-xs text-muted">Vendeur {p.sellerId.slice(0, 8)}…</p></div> },
          { header: 'Offre', cell: (p) => <span>{p.typeLabel} · {p.durationDays} j</span> },
          { header: 'Montant', cell: (p) => <span className="font-medium">{formatPrice(p.amount)}</span> },
          { header: 'Période', cell: (p) => <span className="text-xs text-muted">{p.startsAt ? `${formatDate(p.startsAt)} → ${formatDate(p.endsAt)}` : `Créée le ${formatDate(p.createdAt)}`}</span> },
          { header: 'Statut', mobile: true, cell: (p) => <div><StatusBadge status={p.status} kind="generic" label={PROMOTION_STATUS_LABELS[p.status]} />{p.stopReason && <p className="text-[11px] text-muted mt-1">{p.stopReason}</p>}</div> },
        ]}
        actions={(p) => p.status === 'active' ? <Button size="sm" variant="danger" icon={StopCircle} onClick={() => { setStopping(p); setReason(''); }}>Arrêter</Button> : null}
        pagination={listQuery.data?.meta ? { page, totalPages: listQuery.data.meta.totalPages, total: listQuery.data.meta.total, onPageChange: (p) => setParam('page', String(p)) } : undefined}
      />

      <ConfirmDialog
        open={!!stopping}
        variant="destructive"
        title="Arrêter cette promotion ?"
        description="La promotion sera interrompue immédiatement et le vendeur notifié. Indiquez le motif (visible par le vendeur)."
        confirmLabel="Arrêter la promotion"
        loadingLabel="Arrêt..."
        loading={stop.isPending}
        onConfirm={() => { if (stopping) stop.mutate({ id: stopping.id, reason: reason.trim() || undefined }, { onSettled: () => setStopping(null) }); }}
        onCancel={() => setStopping(null)}
      >
        <FormField as="textarea" label="Motif" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Produit non conforme, contenu trompeur…" />
      </ConfirmDialog>
    </div>
  );
}

function SubscriptionsTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const status = (searchParams.get('status') ?? '') as SubscriptionStatus | '';
  const plan = (searchParams.get('plan') ?? '') as SubscriptionPlan | '';
  const listQuery = useAdminSubscriptions({ status: status || undefined, plan: plan || undefined, page, limit: PAGE_SIZE });

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'subscriptions');
    if (!value) next.delete(key); else next.set(key, value);
    if (key !== 'page') next.delete('page');
    setSearchParams(next, { replace: true });
  };

  return (
    <DataTable<ApiSubscription>
      data={listQuery.data?.items ?? []}
      data-testid="admin-subscriptions-table"
      isLoading={listQuery.isPending}
      isFetching={listQuery.isFetching}
      error={listQuery.isError ? listQuery.error : null}
      onRetry={() => void listQuery.refetch()}
      emptyIcon={Crown}
      emptyTitle="Aucun abonnement"
      emptyDescription="Les abonnements Gold / Premium souscrits par les vendeurs apparaîtront ici."
      toolbar={
        <div className="flex flex-wrap gap-2">
          <select value={status} onChange={(e) => setParam('status', e.target.value || null)} className="px-3 py-2 rounded-lg border border-input-border bg-input-bg text-sm text-text" aria-label="Statut">
            <option value="">Tous les statuts</option>
            {(Object.keys(SUBSCRIPTION_STATUS_LABELS) as SubscriptionStatus[]).map((s) => <option key={s} value={s}>{SUBSCRIPTION_STATUS_LABELS[s]}</option>)}
          </select>
          <select value={plan} onChange={(e) => setParam('plan', e.target.value || null)} className="px-3 py-2 rounded-lg border border-input-border bg-input-bg text-sm text-text" aria-label="Offre">
            <option value="">Toutes les offres</option>
            <option value="gold">Gold</option>
            <option value="premium">Premium</option>
          </select>
        </div>
      }
      columns={[
        { header: 'Boutique / vendeur', primary: true, cell: (s) => <div className="min-w-0">{s.shop ? <Link to={`/boutiques/${s.shop.slug}`} className="font-medium text-text hover:text-primary block truncate">{s.shop.name}</Link> : <span className="font-medium text-text">—</span>}<p className="text-xs text-muted truncate">{s.seller ? fullName({ firstName: s.seller.firstName, lastName: s.seller.lastName ?? undefined, email: s.seller.email ?? '' }) : s.sellerId}{s.seller?.email ? ` · ${s.seller.email}` : ''}</p></div> },
        { header: 'Offre', cell: (s) => <span className="inline-flex items-center gap-2"><ShopLevelBadge level={s.plan} /> <span className="text-xs text-muted">{s.period === 'yearly' ? 'Annuel' : 'Mensuel'}</span></span> },
        { header: 'Montant', cell: (s) => <span className="font-medium">{formatPrice(s.amount)}</span> },
        { header: 'Période', cell: (s) => <span className="text-xs text-muted">{s.startsAt ? `${formatDate(s.startsAt)} → ${formatDate(s.endsAt)}` : `Créé le ${formatDate(s.createdAt)}`}</span> },
        { header: 'Paiement', cell: (s) => <span className="text-xs text-muted">{s.paidAt ? `${s.paymentMethod ?? ''} · ${formatDate(s.paidAt)}` : '—'}</span> },
        { header: 'Statut', mobile: true, cell: (s) => <StatusBadge status={s.status} kind="generic" label={SUBSCRIPTION_STATUS_LABELS[s.status]} /> },
      ]}
      pagination={listQuery.data?.meta ? { page, totalPages: listQuery.data.meta.totalPages, total: listQuery.data.meta.total, onPageChange: (p) => setParam('page', String(p)) } : undefined}
    />
  );
}

export default function AdminPromotionsPage() {
  useTitle('Promotions & abonnements | Administration');
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab = searchParams.get('tab') === 'subscriptions' ? 'subscriptions' : 'promotions';
  return (
    <div className="max-w-6xl">
      <PageHeader title="Promotions & abonnements" subtitle="Suivi des promotions payantes, des revenus associés et des abonnements Gold / Premium" />
      <div className="flex gap-1 border-b border-border mb-5" role="tablist">
        {([['promotions', 'Promotions', Megaphone], ['subscriptions', 'Abonnements vendeur', Crown]] as const).map(([id, label, Icon]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setSearchParams({ tab: id }, { replace: true })} className={clsx('inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors', tab === id ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text')}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>
      {tab === 'promotions' ? <PromotionsTab /> : <SubscriptionsTab />}
    </div>
  );
}

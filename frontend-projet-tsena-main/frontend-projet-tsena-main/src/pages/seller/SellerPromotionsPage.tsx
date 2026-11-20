import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Megaphone, Rocket, Sparkles, Star, Wallet, XCircle, Info, Package } from 'lucide-react';
import clsx from 'clsx';
import { useTitle } from '../../hooks';
import { useAuth } from '../../context/AuthContext';
import { useMyPromotionOffers, useMyPromotions } from '../../hooks/queries/usePromotions';
import { useProducts } from '../../hooks/queries/useProducts';
import { useCancelPromotion, useCreatePromotion, usePayPromotion } from '../../hooks/mutations/usePromotionMutations';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import { Button, ConfirmDialog, DataTable, EmptyState, ErrorState, LoadingState } from '../../components/common';
import PaymentMethodPicker from '../../components/common/PaymentMethodPicker';
import { ShopLevelBadge } from '../../components/shops';
import StatusBadge from '../../shared/components/StatusBadge';
import PageHeader from '../../shared/components/PageHeader';
import { formatDate, formatPrice, PAYMENT_METHOD_LABELS } from '../../lib/format';
import { PROMOTION_STATUS_LABELS, type ApiPromotion, type PromotionOffer, type PromotionStatus, type PromotionType } from '../../types/api';

const TYPE_META: Record<PromotionType, { icon: typeof Rocket; description: string }> = {
  boost: { icon: Rocket, description: 'Remonte votre produit en tête des résultats de recherche et de sa catégorie.' },
  highlight: { icon: Sparkles, description: 'Encadré « Mise en avant » sur les listes et la page catégorie.' },
  featured: { icon: Star, description: 'Votre produit apparaît dans la sélection « À la une » de la page d’accueil.' },
};

const PAGE_SIZE = 10;
const STATUS_OPTIONS: Array<{ value: PromotionStatus | ''; label: string }> = [
  { value: '', label: 'Tous les statuts' },
  ...(Object.keys(PROMOTION_STATUS_LABELS) as PromotionStatus[]).map((s) => ({ value: s, label: PROMOTION_STATUS_LABELS[s] })),
];

export default function SellerPromotionsPage() {
  useTitle('Promotions | Vendeur');
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const statusFilter = (searchParams.get('status') ?? '') as PromotionStatus | '';

  const offersQuery = useMyPromotionOffers();
  const promotionsQuery = useMyPromotions({ status: statusFilter || undefined, page, limit: PAGE_SIZE });
  const productsQuery = useProducts({ sellerId: user?.id, limit: 50, sortBy: 'createdAt', order: 'DESC' }, { enabled: !!user });
  const create = useCreatePromotion();
  const pay = usePayPromotion();
  const cancel = useCancelPromotion();
  const cancelConfirm = useConfirmAction<ApiPromotion>();

  const [selectedOffer, setSelectedOffer] = useState<PromotionOffer | null>(null);
  const [productId, setProductId] = useState('');
  const [method, setMethod] = useState('mvola');
  const [payingId, setPayingId] = useState<string | null>(null);

  const eligibleProducts = useMemo(
    () => (productsQuery.data?.items ?? []).filter((p) => (p.status === 'active' || p.status === 'published') && p.stockQuantity > 0),
    [productsQuery.data?.items],
  );
  const promotions = promotionsQuery.data?.items ?? [];
  const meta = promotionsQuery.data?.meta;
  const offers = offersQuery.data;
  const grouped = useMemo(() => {
    const map = new Map<PromotionType, PromotionOffer[]>();
    for (const offer of offers?.offers ?? []) map.set(offer.type, [...(map.get(offer.type) ?? []), offer]);
    return [...map.entries()];
  }, [offers?.offers]);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (!value) next.delete(key); else next.set(key, value);
    if (key !== 'page') next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const handleCreate = () => {
    if (!selectedOffer || !productId || create.isPending) return;
    create.mutate({ productId, type: selectedOffer.type, durationDays: selectedOffer.durationDays }, {
      onSuccess: (promotion) => { setSelectedOffer(null); setProductId(''); setPayingId(promotion.id); },
    });
  };

  const paying = promotions.find((p) => p.id === payingId && p.status === 'pending_payment') ?? promotions.find((p) => p.status === 'pending_payment') ?? null;

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader title="Promotions" subtitle="Boostez la visibilité de vos produits publiés et disponibles — les produits sponsorisés sont signalés aux acheteurs" />

      <section aria-labelledby="offers-heading">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 id="offers-heading" className="font-semibold text-text text-lg flex items-center gap-2"><Megaphone size={18} className="text-primary" /> Offres disponibles</h2>
          {offers?.shopLevel && <span className="text-xs text-muted inline-flex items-center gap-1.5">Tarifs appliqués à votre niveau <ShopLevelBadge level={offers.shopLevel} /></span>}
        </div>
        {offersQuery.isPending ? (
          <LoadingState variant="cards" count={3} />
        ) : offersQuery.isError ? (
          <ErrorState error={offersQuery.error} onRetry={() => void offersQuery.refetch()} retrying={offersQuery.isFetching} />
        ) : grouped.length === 0 ? (
          <EmptyState icon={Megaphone} compact title="Aucune offre disponible" description="Les offres de promotion ne sont pas encore configurées par l'administration." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="promotion-offers">
            {grouped.map(([type, typeOffers]) => {
              const meta = TYPE_META[type];
              const Icon = meta.icon;
              return (
                <article key={type} className="bg-surface rounded-2xl border border-border p-5 flex flex-col">
                  <div className="flex items-center gap-2 mb-1"><span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Icon size={18} /></span><h3 className="font-bold text-text">{typeOffers[0]?.typeLabel}</h3></div>
                  <p className="text-xs text-muted mb-4">{meta.description}</p>
                  <ul className="space-y-2 mt-auto">
                    {typeOffers.map((offer) => {
                      const active = selectedOffer?.type === offer.type && selectedOffer.durationDays === offer.durationDays;
                      return (
                        <li key={`${offer.type}-${offer.durationDays}`}>
                          <button type="button" onClick={() => setSelectedOffer(active ? null : offer)} className={clsx('w-full flex items-center justify-between gap-2 p-3 rounded-xl border-2 text-sm transition-all', active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40')} aria-pressed={active} data-testid={`offer-${offer.type}-${offer.durationDays}`}>
                            <span className="font-medium text-text">{offer.durationDays} jours</span>
                            <span className="text-right">
                              <span className="font-bold text-primary">{formatPrice(offer.finalPrice)}</span>
                              {offer.discountPercent > 0 && <span className="block text-[11px] text-muted line-through">{formatPrice(offer.price)} · −{offer.discountPercent} %</span>}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </article>
              );
            })}
          </div>
        )}

        {selectedOffer && (
          <div className="mt-4 bg-surface rounded-xl border-2 border-primary/40 p-5 space-y-3" data-testid="promotion-create">
            <p className="font-semibold text-text">Promouvoir un produit — {selectedOffer.typeLabel} · {selectedOffer.durationDays} jours · {formatPrice(selectedOffer.finalPrice)}</p>
            {productsQuery.isPending ? (
              <LoadingState variant="inline" label="Chargement de vos produits..." />
            ) : productsQuery.isError ? (
              <ErrorState error={productsQuery.error} onRetry={() => void productsQuery.refetch()} compact />
            ) : eligibleProducts.length === 0 ? (
              <p className="text-sm text-muted flex items-center gap-2"><Package size={14} /> Aucun produit éligible : seuls les produits publiés et en stock peuvent être promus. <Link to="/dashboard/vendeur/produits" className="text-primary hover:underline">Gérer mes produits</Link></p>
            ) : (
              <div>
                <label htmlFor="promo-product" className="block text-sm font-medium text-text mb-1">Produit à promouvoir</label>
                <select id="promo-product" value={productId} onChange={(e) => setProductId(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-sm text-text" data-testid="promotion-product">
                  <option value="">— Choisir un produit —</option>
                  {eligibleProducts.map((p) => <option key={p.id} value={p.id}>{p.name} — {formatPrice(p.price)}</option>)}
                </select>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSelectedOffer(null)}>Annuler</Button>
              <Button icon={Megaphone} disabled={!productId} loading={create.isPending} loadingLabel="Création..." onClick={handleCreate} data-testid="promotion-submit">Créer la promotion</Button>
            </div>
          </div>
        )}
      </section>

      {paying && (
        <section className="bg-surface rounded-xl border-2 border-primary/40 p-5" aria-labelledby="pay-heading" data-testid="promotion-pending">
          <h2 id="pay-heading" className="font-semibold text-text flex items-center gap-2 mb-1"><Wallet size={18} className="text-primary" /> Paiement en attente</h2>
          <p className="text-sm text-muted mb-3">{paying.typeLabel} · {paying.durationDays} jours · <strong className="text-text">{paying.product?.name ?? 'Produit'}</strong> — <strong className="text-text">{formatPrice(paying.amount)}</strong>. La promotion démarre dès la confirmation du paiement.</p>
          <PaymentMethodPicker value={method} onChange={setMethod} disabled={pay.isPending} />
          <div className="flex flex-wrap justify-end gap-2 mt-3">
            <Button variant="ghost" onClick={() => cancelConfirm.request(paying)} disabled={pay.isPending}>Annuler</Button>
            <Button icon={Wallet} loading={pay.isPending} loadingLabel="Paiement..." onClick={() => pay.mutate({ id: paying.id, method }, { onSuccess: () => setPayingId(null) })} data-testid="promotion-pay">Payer {formatPrice(paying.amount)} via {PAYMENT_METHOD_LABELS[method] ?? method}</Button>
          </div>
        </section>
      )}

      <section aria-labelledby="list-heading">
        <h2 id="list-heading" className="font-semibold text-text text-lg mb-3">Mes promotions</h2>
        <DataTable<ApiPromotion>
          data={promotions}
          data-testid="promotions-table"
          isLoading={promotionsQuery.isPending}
          isFetching={promotionsQuery.isFetching}
          error={promotionsQuery.isError ? promotionsQuery.error : null}
          onRetry={() => void promotionsQuery.refetch()}
          emptyIcon={Megaphone}
          emptyTitle="Aucune promotion"
          emptyDescription="Choisissez une offre ci-dessus pour mettre en avant un produit."
          toolbar={
            <select value={statusFilter} onChange={(e) => setParam('status', e.target.value || null)} className="px-3 py-2 rounded-lg border border-input-border bg-input-bg text-sm text-text" aria-label="Filtrer par statut">
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          }
          columns={[
            { header: 'Produit', primary: true, cell: (p) => <Link to={p.product ? `/produits/${p.product.slug}` : '#'} className="font-medium text-text hover:text-primary">{p.product?.name ?? '—'}</Link> },
            { header: 'Offre', cell: (p) => <span>{p.typeLabel} · {p.durationDays} j</span> },
            { header: 'Montant', cell: (p) => <span>{formatPrice(p.amount)}{Number(p.listPrice) > Number(p.amount) ? <span className="block text-[11px] text-muted line-through">{formatPrice(p.listPrice)}</span> : null}</span> },
            { header: 'Période', mobile: true, cell: (p) => <span className="text-xs text-muted">{p.startsAt ? `${formatDate(p.startsAt)} → ${formatDate(p.endsAt)}` : `Créée le ${formatDate(p.createdAt)}`}</span> },
            { header: 'Statut', cell: (p) => <StatusBadge status={p.status} kind="generic" label={PROMOTION_STATUS_LABELS[p.status]} /> },
          ]}
          actions={(p) => (p.status === 'pending_payment' || p.status === 'active') ? (
            <div className="flex justify-end gap-1">
              {p.status === 'pending_payment' && <Button size="sm" variant="outline" icon={Wallet} onClick={() => setPayingId(p.id)}>Payer</Button>}
              <Button size="sm" variant="ghost" icon={XCircle} onClick={() => cancelConfirm.request(p)}>{p.status === 'active' ? 'Arrêter' : 'Annuler'}</Button>
            </div>
          ) : null}
          pagination={meta ? { page, totalPages: meta.totalPages, total: meta.total, onPageChange: (p) => setParam('page', String(p)) } : undefined}
        />
        <p className="text-xs text-muted mt-3 flex items-start gap-1.5"><Info size={13} className="shrink-0 mt-0.5" /> Une promotion active ne peut être remboursée. L'administration peut interrompre une promotion non conforme ; vous en serez notifié.</p>
      </section>

      <ConfirmDialog
        open={cancelConfirm.isOpen}
        variant="destructive"
        title={cancelConfirm.target?.status === 'active' ? 'Arrêter cette promotion ?' : 'Annuler cette promotion ?'}
        description={cancelConfirm.target?.status === 'active' ? 'La promotion prendra fin immédiatement, sans remboursement de la période restante.' : 'La demande en attente de paiement sera annulée.'}
        confirmLabel={cancelConfirm.target?.status === 'active' ? 'Arrêter' : 'Annuler la promotion'}
        loadingLabel="Traitement..."
        loading={cancel.isPending}
        onConfirm={() => void cancelConfirm.run((p) => cancel.mutateAsync(p.id))}
        onCancel={cancelConfirm.cancel}
      />
    </div>
  );
}

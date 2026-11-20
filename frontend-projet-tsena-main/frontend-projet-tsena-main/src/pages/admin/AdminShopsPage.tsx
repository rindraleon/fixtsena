import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Store, BadgeCheck, ShieldOff, CheckCircle2, PauseCircle, Crown, ExternalLink, Users } from 'lucide-react';
import { useTitle } from '../../hooks';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useAdminShopStats, useShops } from '../../hooks/queries/useShops';
import { useAdminUpdateShop } from '../../hooks/mutations/useShopMutations';
import { Button, ConfirmDialog, DataTable, ErrorState, StatCardSkeleton } from '../../components/common';
import MediaImage from '../../components/common/MediaImage';
import { FormField } from '../../components/form';
import { ShopLevelBadge } from '../../components/shops';
import StatusBadge from '../../shared/components/StatusBadge';
import PageHeader from '../../shared/components/PageHeader';
import SearchInput from '../../shared/components/SearchInput';
import { formatDate, fullName } from '../../lib/format';
import { SHOP_LEVEL_LABELS, SHOP_STATUS_LABELS, type ApiShop, type ShopLevel, type ShopStatus } from '../../types/api';

const PAGE_SIZE = 15;

type PendingAction =
  | { kind: 'status'; shop: ApiShop; status: ShopStatus; title: string; description: string; confirmLabel: string; destructive?: boolean; needsReason?: boolean }
  | { kind: 'identity'; shop: ApiShop; verified: boolean; title: string; description: string; confirmLabel: string; destructive?: boolean; needsReason?: boolean }
  | { kind: 'level'; shop: ApiShop; level: ShopLevel; title: string; description: string; confirmLabel: string; destructive?: boolean; needsReason?: boolean };

export default function AdminShopsPage() {
  useTitle('Boutiques | Administration');
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const debouncedSearch = useDebouncedValue(search);
  const status = (searchParams.get('status') ?? '') as ShopStatus | '';
  const level = (searchParams.get('level') ?? '') as ShopLevel | '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const setParam = (key: string, value: string | null, resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (resetPage) next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const statsQuery = useAdminShopStats();
  const shopsQuery = useShops({ search: debouncedSearch || undefined, status: status || undefined, level: level || undefined, page, limit: PAGE_SIZE, sortBy: 'recent' });
  const update = useAdminUpdateShop();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState('');
  const [levelPick, setLevelPick] = useState<ShopLevel>('founder');

  const ask = (action: PendingAction) => { setPending(action); setReason(''); };
  const confirm = () => {
    if (!pending) return;
    const r = reason.trim() || undefined;
    const base = { shopId: pending.shop.id, reason: r };
    const input = pending.kind === 'status' ? { ...base, action: 'status' as const, status: pending.status }
      : pending.kind === 'identity' ? { ...base, action: 'identity' as const, verified: pending.verified }
      : { ...base, action: 'level' as const, level: pending.level };
    update.mutate(input, { onSettled: () => setPending(null) });
  };

  const stats = statsQuery.data;

  return (
    <div className="max-w-7xl">
      <PageHeader title="Boutiques" subtitle="Vérification, activation, suspension, identité vérifiée et attribution du niveau Fondateur" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statsQuery.isPending ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />) : statsQuery.isError ? <div className="col-span-full"><ErrorState error={statsQuery.error} onRetry={() => void statsQuery.refetch()} compact /></div> : stats && (
          <>
            <button type="button" onClick={() => setParam('status', null)} className="text-left bg-surface rounded-xl border border-border p-4 hover:border-primary/40"><p className="text-xs text-muted">Total</p><p className="text-2xl font-bold text-text mt-1">{stats.total}</p></button>
            <button type="button" onClick={() => setParam('status', 'pending_verification')} className="text-left bg-surface rounded-xl border border-amber-200 dark:border-amber-500/30 p-4 hover:border-amber-400" data-testid="shops-pending-stat"><p className="text-xs text-muted">À vérifier</p><p className="text-2xl font-bold text-amber-600 mt-1">{stats.byStatus.pending_verification ?? 0}</p></button>
            <button type="button" onClick={() => setParam('status', 'active')} className="text-left bg-surface rounded-xl border border-border p-4 hover:border-primary/40"><p className="text-xs text-muted">Actives</p><p className="text-2xl font-bold text-emerald-600 mt-1">{stats.byStatus.active ?? 0}</p></button>
            <button type="button" onClick={() => setParam('status', 'suspended')} className="text-left bg-surface rounded-xl border border-border p-4 hover:border-primary/40"><p className="text-xs text-muted">Suspendues</p><p className="text-2xl font-bold text-red-600 mt-1">{stats.byStatus.suspended ?? 0}</p></button>
          </>
        )}
      </div>

      <DataTable<ApiShop>
        data={shopsQuery.data?.items ?? []}
        data-testid="admin-shops-table"
        isLoading={shopsQuery.isPending}
        isFetching={shopsQuery.isFetching}
        error={shopsQuery.isError ? shopsQuery.error : null}
        onRetry={() => void shopsQuery.refetch()}
        emptyIcon={Store}
        emptyTitle="Aucune boutique"
        emptyDescription="Aucune boutique ne correspond aux filtres."
        toolbar={
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <div className="flex-1"><SearchInput value={search} onChange={(v) => { setSearch(v); setParam('search', v); }} placeholder="Nom de boutique..." /></div>
            <select value={status} onChange={(e) => setParam('status', e.target.value || null)} className="px-3 py-2 rounded-lg border border-input-border bg-input-bg text-sm text-text" aria-label="Statut">
              <option value="">Tous les statuts</option>
              {(Object.keys(SHOP_STATUS_LABELS) as ShopStatus[]).map((s) => <option key={s} value={s}>{SHOP_STATUS_LABELS[s]}</option>)}
            </select>
            <select value={level} onChange={(e) => setParam('level', e.target.value || null)} className="px-3 py-2 rounded-lg border border-input-border bg-input-bg text-sm text-text" aria-label="Niveau">
              <option value="">Tous les niveaux</option>
              {(Object.keys(SHOP_LEVEL_LABELS) as ShopLevel[]).map((l) => <option key={l} value={l}>{SHOP_LEVEL_LABELS[l]}</option>)}
            </select>
          </div>
        }
        columns={[
          {
            header: 'Boutique', primary: true, cell: (shop) => (
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-surface-secondary overflow-hidden shrink-0 flex items-center justify-center text-muted">
                  {shop.logoUrl ? <MediaImage src={shop.logoUrl} alt="" className="w-full h-full object-cover" fallback={<Store size={16} />} /> : <Store size={16} />}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-text truncate flex items-center gap-1.5">{shop.name}{shop.identityVerified && <BadgeCheck size={14} className="text-emerald-600" aria-label="Identité vérifiée" />}</p>
                  <p className="text-xs text-muted truncate">{shop.owner ? fullName({ firstName: shop.owner.firstName, lastName: shop.owner.lastName ?? undefined, email: '' }) : shop.ownerId} · créée le {formatDate(shop.createdAt)}</p>
                </div>
              </div>
            ),
          },
          { header: 'Niveau', cell: (shop) => <ShopLevelBadge level={shop.level} label={shop.levelLabel} /> },
          { header: 'Statut', mobile: true, cell: (shop) => <div><StatusBadge status={shop.status} kind="generic" label={shop.statusLabel} />{shop.statusReason && shop.status !== 'active' && <p className="text-[11px] text-muted mt-1 max-w-[180px] truncate" title={shop.statusReason}>{shop.statusReason}</p>}</div> },
          { header: 'Activité', cell: (shop) => <span className="text-xs text-muted inline-flex items-center gap-2">{shop.productsCount} prod. · <Users size={11} /> {shop.followersCount} · ★ {shop.reviewsCount > 0 ? shop.averageRating.toFixed(1) : '—'}</span> },
          { header: 'Soumise le', cell: (shop) => <span className="text-xs text-muted">{shop.submittedAt ? formatDate(shop.submittedAt) : '—'}</span> },
        ]}
        actions={(shop) => (
          <div className="flex flex-wrap justify-end gap-1">
            {shop.status === 'active' && <Link to={`/boutiques/${shop.slug}`} className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-surface-secondary" aria-label="Voir la boutique publique" title="Voir la boutique publique"><ExternalLink size={15} /></Link>}
            {(shop.status === 'pending_verification' || shop.status === 'suspended' || shop.status === 'draft') && (
              <Button size="sm" icon={CheckCircle2} onClick={() => ask({ kind: 'status', shop, status: 'active', title: `Activer « ${shop.name} » ?`, description: 'La boutique devient visible publiquement et peut recevoir des commandes. Le vendeur sera notifié.', confirmLabel: 'Activer' })} data-testid="shop-activate">Activer</Button>
            )}
            {shop.status === 'active' && (
              <Button size="sm" variant="danger" icon={PauseCircle} onClick={() => ask({ kind: 'status', shop, status: 'suspended', title: `Suspendre « ${shop.name} » ?`, description: 'Les produits de la boutique ne seront plus visibles, l’abonnement aux nouveautés et la messagerie seront bloqués. Indiquez le motif (communiqué au vendeur).', confirmLabel: 'Suspendre', destructive: true, needsReason: true })} data-testid="shop-suspend">Suspendre</Button>
            )}
            {shop.identityVerified ? (
              <Button size="sm" variant="ghost" icon={ShieldOff} onClick={() => ask({ kind: 'identity', shop, verified: false, title: 'Retirer la vérification d’identité ?', description: 'Le niveau de la boutique sera recalculé (la vérification est requise à partir du niveau Vérifié).', confirmLabel: 'Retirer', destructive: true, needsReason: true })}>Identité</Button>
            ) : (
              <Button size="sm" variant="outline" icon={BadgeCheck} onClick={() => ask({ kind: 'identity', shop, verified: true, title: 'Marquer l’identité comme vérifiée ?', description: 'Vous attestez avoir contrôlé les pièces d’identité du vendeur. Cette action est journalisée.', confirmLabel: 'Identité vérifiée' })} data-testid="shop-verify-identity">Vérifier l’identité</Button>
            )}
            <Button size="sm" variant="ghost" icon={Crown} onClick={() => { setLevelPick(shop.level === 'founder' ? 'new' : 'founder'); ask({ kind: 'level', shop, level: 'founder', title: `Niveau de « ${shop.name} »`, description: 'Le niveau Fondateur est attribué manuellement et audité. Choisir un autre niveau retire le statut Fondateur ; le niveau effectif sera ensuite recalculé selon l’abonnement et l’éligibilité.', confirmLabel: 'Appliquer', needsReason: true }); }} data-testid="shop-level">Niveau</Button>
          </div>
        )}
        pagination={shopsQuery.data?.meta ? { page, totalPages: shopsQuery.data.meta.totalPages, total: shopsQuery.data.meta.total, onPageChange: (p) => setParam('page', String(p), false) } : undefined}
      />

      <ConfirmDialog
        open={!!pending}
        variant={pending?.destructive ? 'destructive' : 'default'}
        title={pending?.title ?? ''}
        description={pending?.description ?? ''}
        confirmLabel={pending?.confirmLabel ?? 'Confirmer'}
        loadingLabel="Application..."
        loading={update.isPending}
        onConfirm={() => {
          if (pending?.kind === 'level') { setPending({ ...pending, level: levelPick }); update.mutate({ shopId: pending.shop.id, action: 'level', level: levelPick, reason: reason.trim() || undefined }, { onSettled: () => setPending(null) }); return; }
          confirm();
        }}
        onCancel={() => setPending(null)}
      >
        {pending?.kind === 'level' && (
          <FormField as="select" label="Niveau" value={levelPick} onChange={(e) => setLevelPick(e.target.value as ShopLevel)}>
            {(Object.keys(SHOP_LEVEL_LABELS) as ShopLevel[]).map((l) => <option key={l} value={l}>{SHOP_LEVEL_LABELS[l]}</option>)}
          </FormField>
        )}
        {pending?.needsReason && <FormField as="textarea" label="Motif (journalisé)" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />}
      </ConfirmDialog>
    </div>
  );
}

import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Store } from 'lucide-react';
import { useTitle } from '../../hooks';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useShops } from '../../hooks/queries/useShops';
import SearchInput from '../../shared/components/SearchInput';
import { ShopCard } from '../../components/shops';
import { EmptyState, ErrorState, LoadingState, Pagination } from '../../components/common';
import { SHOP_LEVEL_LABELS, type ShopFilters, type ShopLevel } from '../../types/api';

const PAGE_SIZE = 12;
const SORTS: Array<{ value: NonNullable<ShopFilters['sortBy']>; label: string }> = [
  { value: 'followers', label: 'Les plus suivies' },
  { value: 'rating', label: 'Les mieux notées' },
  { value: 'recent', label: 'Les plus récentes' },
  { value: 'name', label: 'Nom (A → Z)' },
];

export default function ShopsPage() {
  useTitle('Boutiques', { description: 'Découvrez les boutiques vérifiées de la marketplace Tsena : niveaux Vérifié, Gold, Premium et Fondateur.' });
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('search') ?? '';
  const level = searchParams.get('level') ?? '';
  const sortBy = (searchParams.get('sort') as ShopFilters['sortBy']) ?? 'followers';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const debouncedSearch = useDebouncedValue(search, 350);

  const setParam = (key: string, value: string | null, resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    if (!value) next.delete(key); else next.set(key, value);
    if (resetPage) next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const filters = useMemo<ShopFilters>(() => ({
    search: debouncedSearch || undefined,
    level: (level || undefined) as ShopLevel | undefined,
    sortBy,
    page,
    limit: PAGE_SIZE,
  }), [debouncedSearch, level, sortBy, page]);

  const shopsQuery = useShops(filters);
  const shops = shopsQuery.data?.items ?? [];
  const meta = shopsQuery.data?.meta;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-text">Boutiques</h1>
        <p className="text-muted mt-1">Suivez vos boutiques préférées pour être informé de leurs nouveautés et promotions.</p>
      </header>

      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="flex-1"><SearchInput value={search} onChange={(v) => setParam('search', v)} placeholder="Rechercher une boutique..." /></div>
        <select value={level} onChange={(e) => setParam('level', e.target.value || null)} className="px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-sm text-text" aria-label="Filtrer par niveau">
          <option value="">Tous les niveaux</option>
          {(Object.keys(SHOP_LEVEL_LABELS) as ShopLevel[]).map((l) => <option key={l} value={l}>{SHOP_LEVEL_LABELS[l]}</option>)}
        </select>
        <select value={sortBy} onChange={(e) => setParam('sort', e.target.value)} className="px-3 py-2.5 rounded-lg border border-input-border bg-input-bg text-sm text-text" aria-label="Trier">
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {shopsQuery.isPending ? (
        <LoadingState variant="cards" count={6} />
      ) : shopsQuery.isError ? (
        <ErrorState error={shopsQuery.error} onRetry={() => void shopsQuery.refetch()} retrying={shopsQuery.isFetching} />
      ) : shops.length === 0 ? (
        <EmptyState icon={Store} title="Aucune boutique trouvée" description="Essayez un autre mot-clé ou un autre niveau." />
      ) : (
        <>
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${shopsQuery.isFetching ? 'opacity-70' : ''}`}>
            {shops.map((shop) => <ShopCard key={shop.id} shop={shop} />)}
          </div>
          {meta && meta.totalPages > 1 && <Pagination currentPage={page} totalPages={meta.totalPages} onPageChange={(p) => setParam('page', String(p), false)} />}
        </>
      )}
    </div>
  );
}

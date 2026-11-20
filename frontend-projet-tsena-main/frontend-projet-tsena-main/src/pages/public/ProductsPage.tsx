import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, PackageSearch, X, MapPin, Store } from 'lucide-react';
import { useTitle } from '../../hooks';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useProducts, useProductLocations } from '../../hooks/queries/useProducts';
import { useCategories } from '../../hooks/queries/useCategories';
import ProductCard from '../../components/product/ProductCard';
import SearchInput from '../../shared/components/SearchInput';
import { LoadingState, ErrorState, EmptyState, Pagination } from '../../components/common';
import type { ProductFilters, ProductSortBy } from '../../types/api';

type SortKey = 'relevance' | 'price-asc' | 'price-desc' | 'newest' | 'popular' | 'rating' | 'name';

const SORT_OPTIONS: Record<SortKey, { label: string; sortBy?: ProductSortBy; order?: 'ASC' | 'DESC' }> = {
  relevance: { label: 'Pertinence' },
  newest: { label: 'Nouveautés', sortBy: 'createdAt', order: 'DESC' },
  popular: { label: 'Meilleures ventes', sortBy: 'salesCount', order: 'DESC' },
  rating: { label: 'Mieux notés', sortBy: 'averageRating', order: 'DESC' },
  'price-asc': { label: 'Prix croissant', sortBy: 'price', order: 'ASC' },
  'price-desc': { label: 'Prix décroissant', sortBy: 'price', order: 'DESC' },
  name: { label: 'Nom (A → Z)', sortBy: 'name', order: 'ASC' },
};

const PAGE_SIZE = 12;

function isSortKey(value: string | null): value is SortKey {
  return !!value && value in SORT_OPTIONS;
}

export default function ProductsPage() {
  useTitle('Tous nos produits', { description: 'Parcourez le catalogue Tsena : filtrez par catégorie, prix, disponibilité, localisation et vendeur. Vendeurs vérifiés et paiement protégé jusqu’à la réception.' });
  const [searchParams, setSearchParams] = useSearchParams();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const search = searchParams.get('search') ?? '';
  const categoryId = searchParams.get('categoryId') ?? '';
  const minPrice = searchParams.get('minPrice') ?? '';
  const maxPrice = searchParams.get('maxPrice') ?? '';
  const inStock = searchParams.get('inStock') === '1';
  const tags = searchParams.get('tags') ?? '';
  const city = searchParams.get('city') ?? '';
  const sellerId = searchParams.get('sellerId') ?? '';
  const sortParam = searchParams.get('sort');
  const sort: SortKey = isSortKey(sortParam) ? sortParam : 'relevance';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const updateParams = (patch: Record<string, string | null>, resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }
    if (resetPage) next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const debouncedSearch = useDebouncedValue(search, 350);
  const debouncedMin = useDebouncedValue(minPrice, 500);
  const debouncedMax = useDebouncedValue(maxPrice, 500);

  const filters = useMemo<ProductFilters>(
    () => ({
      search: debouncedSearch || undefined,
      categoryId: categoryId || undefined,
      minPrice: debouncedMin ? Number(debouncedMin) : undefined,
      maxPrice: debouncedMax ? Number(debouncedMax) : undefined,
      inStock: inStock || undefined,
      tags: tags || undefined,
      city: city || undefined,
      sellerId: sellerId || undefined,
      sortBy: SORT_OPTIONS[sort].sortBy,
      order: SORT_OPTIONS[sort].order,
      page,
      limit: PAGE_SIZE,
    }),
    [debouncedSearch, categoryId, debouncedMin, debouncedMax, inStock, tags, city, sellerId, sort, page],
  );

  const productsQuery = useProducts(filters);
  const categoriesQuery = useCategories({ limit: 100 });
  const locationsQuery = useProductLocations();

  const products = productsQuery.data?.items ?? [];
  const meta = productsQuery.data?.meta;
  const total = meta?.total ?? 0;
  const totalPages = meta?.totalPages ?? 1;
  const categories = categoriesQuery.data?.items ?? [];
  const locations = useMemo(() => {
    const list = locationsQuery.data ?? [];
    return city && !list.some((l) => l.city.toLowerCase() === city.toLowerCase()) ? [...list, { city, count: 0 }] : list;
  }, [locationsQuery.data, city]);
  const sellerLabel = sellerId ? products.find((p) => p.sellerId === sellerId)?.shop?.name ?? null : null;

  const hasActiveFilters = !!(search || categoryId || minPrice || maxPrice || inStock || tags || city || sellerId || sort !== 'relevance');
  const resetAll = () => setSearchParams(new URLSearchParams(), { replace: true });

  const filtersPanel = (
    <div className="space-y-5">
      <div>
        <label htmlFor="filter-search" className="block text-sm font-medium text-text mb-1">Recherche</label>
        <SearchInput value={search} onChange={(value) => updateParams({ search: value })} placeholder="Nom du produit..." />
      </div>

      <div>
        <label htmlFor="filter-category" className="block text-sm font-medium text-text mb-1">Catégorie</label>
        <select
          id="filter-category"
          value={categoryId}
          onChange={(e) => updateParams({ categoryId: e.target.value })}
          className="w-full px-3 py-2 border border-input-border bg-input-bg rounded-lg text-sm text-text focus:outline-none focus:border-primary"
        >
          <option value="">Toutes les catégories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {categoriesQuery.isError && <p className="text-xs text-danger mt-1">Catégories indisponibles pour le moment.</p>}
      </div>

      <div>
        <span className="block text-sm font-medium text-text mb-1">Prix (Ar)</span>
        <div className="flex gap-2">
          <input type="number" min={0} inputMode="numeric" value={minPrice} onChange={(e) => updateParams({ minPrice: e.target.value })} placeholder="Min" aria-label="Prix minimum" className="w-full px-3 py-2 border border-input-border bg-input-bg rounded-lg text-sm text-text focus:outline-none focus:border-primary" />
          <input type="number" min={0} inputMode="numeric" value={maxPrice} onChange={(e) => updateParams({ maxPrice: e.target.value })} placeholder="Max" aria-label="Prix maximum" className="w-full px-3 py-2 border border-input-border bg-input-bg rounded-lg text-sm text-text focus:outline-none focus:border-primary" />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer text-text">
        <input type="checkbox" checked={inStock} onChange={(e) => updateParams({ inStock: e.target.checked ? '1' : null })} className="rounded border-border accent-primary" />
        En stock uniquement
      </label>

      <div>
        <label htmlFor="filter-city" className="block text-sm font-medium text-text mb-1">
          <span className="inline-flex items-center gap-1"><MapPin size={14} aria-hidden="true" /> Localisation</span>
        </label>
        <select
          id="filter-city"
          value={city}
          onChange={(e) => updateParams({ city: e.target.value })}
          disabled={locationsQuery.isPending && locations.length === 0}
          className="w-full px-3 py-2 border border-input-border bg-input-bg rounded-lg text-sm text-text focus:outline-none focus:border-primary disabled:opacity-60"
        >
          <option value="">Toute l’île</option>
          {locations.map((l) => (
            <option key={l.city} value={l.city}>{l.count > 0 ? `${l.city} (${l.count})` : l.city}</option>
          ))}
        </select>
        <p className="text-xs text-muted mt-1">Ville de la boutique du vendeur.</p>
        {locationsQuery.isError && <p className="text-xs text-danger mt-1">Localisations indisponibles pour le moment.</p>}
      </div>

      {sellerId && (
        <button type="button" onClick={() => updateParams({ sellerId: null })} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary" aria-label="Retirer le filtre vendeur">
          <Store size={12} aria-hidden="true" /> {sellerLabel ? `Boutique : ${sellerLabel}` : 'Vendeur sélectionné'} <X size={12} />
        </button>
      )}

      {tags && (
        <button type="button" onClick={() => updateParams({ tags: null })} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary">
          #{tags} <X size={12} />
        </button>
      )}

      {hasActiveFilters && (
        <button type="button" onClick={resetAll} className="w-full text-sm text-primary font-medium hover:underline">
          Réinitialiser les filtres
        </button>
      )}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-fade-in-up">
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary mb-1">Tous nos produits</h1>
          <p className="text-muted text-sm" aria-live="polite">
            {productsQuery.isPending ? 'Recherche en cours…' : `${total} produit${total > 1 ? 's' : ''} trouvé${total > 1 ? 's' : ''}`}
            {productsQuery.isFetching && !productsQuery.isPending && <span className="ml-2 text-xs text-primary">Mise à jour…</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMobileFiltersOpen((open) => !open)}
          className="lg:hidden inline-flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg border border-border bg-surface"
          aria-expanded={mobileFiltersOpen}
        >
          <SlidersHorizontal size={16} /> Filtres
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className={`lg:w-[260px] shrink-0 ${mobileFiltersOpen ? 'block' : 'hidden lg:block'}`}>
          <div className="bg-surface rounded-2xl border border-border p-5 sticky top-24">
            <h2 className="font-semibold text-text flex items-center gap-2 mb-4"><SlidersHorizontal size={16} /> Filtres</h2>
            {filtersPanel}
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4 bg-surface rounded-xl border border-border px-4 py-3">
            <label htmlFor="sort" className="text-sm text-muted">Trier par :</label>
            <select
              id="sort"
              value={sort}
              onChange={(e) => updateParams({ sort: e.target.value === 'relevance' ? null : e.target.value })}
              className="text-sm font-medium text-text bg-transparent focus:outline-none cursor-pointer"
            >
              {(Object.keys(SORT_OPTIONS) as SortKey[]).map((key) => (
                <option key={key} value={key}>{SORT_OPTIONS[key].label}</option>
              ))}
            </select>
          </div>

          {productsQuery.isPending ? (
            <LoadingState variant="cards" count={8} />
          ) : productsQuery.isError ? (
            <ErrorState error={productsQuery.error} onRetry={() => void productsQuery.refetch()} retrying={productsQuery.isFetching} />
          ) : products.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title={hasActiveFilters ? 'Aucun résultat' : 'Aucun produit'}
              description={hasActiveFilters ? 'Aucun produit ne correspond à vos critères. Essayez d’élargir votre recherche.' : 'Le catalogue est vide pour le moment. Revenez bientôt !'}
              action={hasActiveFilters ? { label: 'Réinitialiser les filtres', onClick: resetAll } : { label: "Retour à l'accueil", to: '/' }}
            />
          ) : (
            <>
              <div className={`grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 transition-opacity ${productsQuery.isFetching ? 'opacity-70' : ''}`}>
                {products.map((product, index) => (
                  <ProductCard key={product.id} product={product} index={index} />
                ))}
              </div>
              <Pagination currentPage={page} totalPages={totalPages} onPageChange={(p) => updateParams({ page: String(p) }, false)} className="pt-8" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

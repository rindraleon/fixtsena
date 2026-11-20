import { useEffect, useMemo, useState } from 'react';
import { Heart, Trash2, ArrowRight } from 'lucide-react';
import { useTitle } from '../../hooks';
import { useFavorites } from '../../context/FavoritesContext';
import { useFavoriteProducts } from '../../hooks/queries/useFavoriteProducts';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import ProductCard from '../../components/product/ProductCard';
import SearchInput from '../../shared/components/SearchInput';
import { Button, ConfirmDialog, EmptyState, ErrorState, LoadingState } from '../../components/common';
import { toast } from '../../lib/toast';

export default function FavoritesPage() {
  useTitle('Mes favoris', { noindex: true });
  const { count, clearFavorites, removeFavorite } = useFavorites();
  const { products, unavailableIds, error, isPending, isFetching, refetch } = useFavoriteProducts();
  const [search, setSearch] = useState('');
  const confirmClear = useConfirmAction<true>();

  useEffect(() => {
    if (unavailableIds.length === 0) return;
    unavailableIds.forEach(removeFavorite);
    toast.info(
      unavailableIds.length > 1 ? `${unavailableIds.length} favoris ne sont plus disponibles et ont été retirés.` : 'Un favori n’est plus disponible et a été retiré.',
      { id: 'favorites-unavailable' },
    );
  }, [unavailableIds, removeFavorite]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) => p.name.toLowerCase().includes(term) || p.category?.name.toLowerCase().includes(term));
  }, [products, search]);

  if (count === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 animate-fade-in-up">
        <EmptyState titleAs="h1"
          icon={Heart}
          title="Aucun favori pour le moment"
          description="Cliquez sur le cœur d'un produit pour le retrouver ici. Vos favoris sont conservés sur cet appareil."
          action={{ label: 'Découvrir les produits', to: '/produits', icon: ArrowRight }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2"><Heart size={24} className="text-red-500" fill="currentColor" /> Mes favoris</h1>
          <p className="text-sm text-muted">{count} produit{count > 1 ? 's' : ''} enregistré{count > 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Rechercher dans mes favoris..." className="w-full sm:w-64" />
          <Button variant="ghost" size="sm" icon={Trash2} onClick={() => confirmClear.request(true)} className="text-danger hover:bg-red-50 dark:hover:bg-red-500/10 shrink-0">
            Tout retirer
          </Button>
        </div>
      </div>

      {isPending && products.length === 0 ? (
        <LoadingState variant="cards" count={Math.min(count, 8)} />
      ) : error && products.length === 0 ? (
        <ErrorState error={error} onRetry={() => void refetch()} retrying={isFetching} />
      ) : filtered.length === 0 ? (
        <EmptyState title="Aucun résultat" description="Aucun favori ne correspond à votre recherche." action={{ label: 'Effacer la recherche', onClick: () => setSearch('') }} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((product, index) => (
            <ProductCard key={product.id} product={product} index={index} />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmClear.isOpen}
        variant="destructive"
        title="Retirer tous les favoris ?"
        description={`Vos ${count} favori(s) seront retirés de cette liste. Cette action est irréversible.`}
        confirmLabel="Tout retirer"
        loadingLabel="Suppression..."
        onConfirm={() =>
          void confirmClear.run(() => {
            clearFavorites();
            toast.success('Favoris retirés', { id: 'favorites-cleared' });
          })
        }
        onCancel={confirmClear.cancel}
      />
    </div>
  );
}

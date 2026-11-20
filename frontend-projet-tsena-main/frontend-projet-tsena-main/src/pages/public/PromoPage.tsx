import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tag, Sparkles, Flame, Percent } from 'lucide-react';
import { useTitle } from '../../hooks';
import { useFeaturedProducts, useProducts } from '../../hooks/queries/useProducts';
import ProductCard from '../../components/product/ProductCard';
import { LoadingState, ErrorState, EmptyState } from '../../components/common';
import { discountPercent } from '../../lib/format';
import type { ApiProduct } from '../../types/api';

type TabKey = 'deals' | 'featured' | 'new';

const TABS: { key: TabKey; label: string; icon: typeof Tag; title: string; description: string }[] = [
  { key: 'deals', label: 'Bons plans', icon: Percent, title: 'Produits en promotion', description: 'Articles récents affichant un prix barré (remise appliquée par le vendeur).' },
  { key: 'featured', label: 'Sélection TSENA', icon: Sparkles, title: 'Sélection de la rédaction', description: 'Produits mis en avant par la plateforme.' },
  { key: 'new', label: 'Nouveautés', icon: Flame, title: 'Derniers arrivages', description: 'Les produits publiés le plus récemment.' },
];

export default function PromoPage() {
  useTitle('Promotions', { description: 'Bons plans, sélection Tsena et nouveautés : les produits en promotion et les derniers arrivages de nos vendeurs vérifiés.' });
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('onglet');
  const activeTab: TabKey = TABS.some((t) => t.key === rawTab) ? (rawTab as TabKey) : 'deals';
  const tab = TABS.find((t) => t.key === activeTab) ?? TABS[0];

  const recentQuery = useProducts({ sortBy: 'createdAt', order: 'DESC', limit: 100 }, { enabled: activeTab !== 'featured' });
  const featuredQuery = useFeaturedProducts(20);

  const deals = useMemo(() => (recentQuery.data?.items ?? []).filter((p) => discountPercent(p) > 0), [recentQuery.data]);
  const newest = useMemo(() => (recentQuery.data?.items ?? []).slice(0, 20), [recentQuery.data]);

  const query = activeTab === 'featured' ? featuredQuery : recentQuery;
  const products: ApiProduct[] = activeTab === 'deals' ? deals : activeTab === 'featured' ? (featuredQuery.data ?? []) : newest;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-gradient-to-r from-primary to-primary-dark rounded-2xl p-6 sm:p-10 text-white mb-8">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide bg-white/15 px-3 py-1 rounded-full mb-3"><Tag size={14} /> Offres du moment</p>
        <h1 className="text-2xl sm:text-4xl font-bold mb-2">Promotions & sélections</h1>
        <p className="text-white/85 max-w-2xl">Retrouvez les remises appliquées par nos vendeurs, la sélection TSENA et les dernières nouveautés — le tout protégé par le paiement sous séquestre.</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label="Catégories de promotions">
        {TABS.map((t) => {
          const Icon = t.icon;
          const selected = t.key === activeTab;
          return (
            <button key={t.key} type="button" role="tab" aria-selected={selected} onClick={() => setSearchParams(t.key === 'deals' ? {} : { onglet: t.key }, { replace: true })} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors ${selected ? 'bg-primary text-white shadow-sm' : 'bg-surface border border-border text-text hover:bg-surface-hover'}`}>
              <Icon size={16} /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="mb-4">
        <h2 className="text-lg font-bold text-text">{tab.title}</h2>
        <p className="text-sm text-muted">{tab.description}</p>
      </div>

      {query.isPending ? (
        <LoadingState variant="cards" count={8} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />
      ) : products.length === 0 ? (
        <EmptyState icon={tab.icon} title={activeTab === 'deals' ? 'Aucune promotion en cours' : activeTab === 'featured' ? 'Aucun produit mis en avant' : 'Aucun produit'} description={activeTab === 'deals' ? 'Aucun vendeur ne propose de remise parmi les produits récents. Revenez bientôt !' : 'Revenez bientôt pour découvrir de nouvelles offres.'} action={{ label: 'Parcourir le catalogue', to: '/produits' }} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4" aria-live="polite">
          {products.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}
        </div>
      )}
    </div>
  );
}

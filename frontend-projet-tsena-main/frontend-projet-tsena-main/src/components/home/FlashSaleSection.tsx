import { Link } from 'react-router-dom';
import { Zap, ArrowRight } from 'lucide-react';
import ProductCard from '../product/ProductCard';
import Reveal from '../common/Reveal';
import { LoadingState, ErrorState, EmptyState } from '../common';
import { useFeaturedProducts } from '../../hooks/queries/useProducts';

export default function FlashSaleSection() {
  const featuredQuery = useFeaturedProducts(6);
  const products = featuredQuery.data ?? [];

  let productsContent;
  if (featuredQuery.isPending) {
    productsContent = <LoadingState variant="cards" count={6} />;
  } else if (featuredQuery.isError) {
    productsContent = (
      <ErrorState
        compact
        error={featuredQuery.error}
        onRetry={() => void featuredQuery.refetch()}
        retrying={featuredQuery.isFetching}
      />
    );
  } else if (products.length === 0) {
    productsContent = (
      <EmptyState
        compact
        title="Aucun produit en vedette"
        description="Revenez bientôt pour découvrir nos offres."
        action={{ label: 'Voir tous les produits', to: '/produits' }}
      />
    );
  } else {
    productsContent = (
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {products.map((product, idx) => (
          <ProductCard key={product.id} product={product} index={idx} />
        ))}
      </div>
    );
  }

  return (
    <section className="py-8 md:py-12" aria-labelledby="flash-sale-heading">
      <div className="max-w-7xl mx-auto px-4">
        <Reveal direction="up">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
            <div>
              <h2
                id="flash-sale-heading"
                className="flex items-center gap-2 text-xl md:text-2xl font-bold text-primary"
              >
                <Zap className="text-accent" size={24} aria-hidden="true" />
                Sélection du moment
              </h2>
              <p className="text-muted text-sm mt-1">Les produits mis en avant par nos vendeurs</p>
            </div>
            <Link
              to="/promotions"
              className="text-sm font-semibold text-primary hover:text-primary-light transition-colors flex items-center gap-1 group"
            >
              Voir toutes les offres
              <ArrowRight
                size={14}
                className="transition-transform group-hover:translate-x-1"
                aria-hidden="true"
              />
            </Link>
          </div>
        </Reveal>

        {productsContent}
      </div>
    </section>
  );
}

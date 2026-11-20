import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import ProductDetail from '../components/product/ProductDetail';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import EmptyState from '../components/common/EmptyState';
import { useTitle } from '../hooks';
import { useProduct, useProducts } from '../hooks/queries/useProducts';
import { isNotFoundError } from '../lib/api-error';
import { primaryImageUrl, formatPrice } from '../lib/format';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const productQuery = useProduct(id);
  const product = productQuery.data;

  useTitle(product ? product.name : 'Produit', {
    description: product
      ? `${product.name} à ${formatPrice(product.price)}${product.seller ? ` chez ${[product.seller.firstName, product.seller.lastName].filter(Boolean).join(' ')}` : ''} — ${(product.shortDescription || product.description || '').replace(/\s+/g, ' ').slice(0, 120)}`
      : undefined,
    image: primaryImageUrl(product),
    type: 'product',
    noindex: productQuery.isError ? true : undefined,
  });

  const relatedQuery = useProducts(
    { categoryId: product?.categoryId, limit: 6, sortBy: 'createdAt', order: 'DESC' },
    { enabled: !!product?.categoryId },
  );
  const related = (relatedQuery.data?.items ?? []).filter((p) => p.id !== product?.id).slice(0, 5);

  if (productQuery.isPending) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <LoadingState variant="detail" label="Chargement du produit..." />
      </div>
    );
  }

  if (productQuery.isError) {
    if (isNotFoundError(productQuery.error)) {
      return (
        <div className="max-w-3xl mx-auto px-4 py-16">
          <EmptyState
            title="Produit introuvable"
            description="Le produit demandé n'existe pas ou a été retiré de la vente."
            action={{ label: 'Retour à la boutique', to: '/produits', icon: ArrowLeft }}
          />
        </div>
      );
    }
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <ErrorState error={productQuery.error} onRetry={() => void productQuery.refetch()} retrying={productQuery.isFetching} />
        <Link to="/produits" className="inline-flex items-center gap-2 text-sm text-primary font-medium mt-6 hover:underline">
          <ArrowLeft size={16} /> Retour à la boutique
        </Link>
      </div>
    );
  }

  if (!product) return null;

  return <ProductDetail product={product} relatedProducts={related} />;
}

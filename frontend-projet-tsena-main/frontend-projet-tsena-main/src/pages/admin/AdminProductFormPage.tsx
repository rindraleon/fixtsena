import { useNavigate, useParams } from 'react-router-dom';
import { useTitle } from '../../hooks';
import { useProduct } from '../../hooks/queries/useProducts';
import ProductForm from '../../components/product/ProductForm';
import { EmptyState, ErrorState, LoadingState } from '../../components/common';
import PageHeader from '../../shared/components/PageHeader';
import { isNotFoundError } from '../../lib/api-error';
import type { ProductStatus } from '../../types/api';

const BACK = '/dashboard/admin/produits';
const ADMIN_STATUSES: ProductStatus[] = ['draft', 'pending_review', 'active', 'unavailable', 'sold_out', 'suspended', 'archived', 'rejected'];

export default function AdminProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  useTitle(isEdit ? 'Modifier le produit | Administration' : 'Nouveau produit | Administration');
  const navigate = useNavigate();
  const productQuery = useProduct(id);

  if (isEdit && productQuery.isPending) return <LoadingState variant="detail" label="Chargement du produit..." />;
  if (isEdit && productQuery.isError) {
    return isNotFoundError(productQuery.error)
      ? <EmptyState title="Produit introuvable" description="Ce produit n'existe pas ou a été supprimé." action={{ label: 'Retour aux produits', to: BACK }} />
      : <ErrorState error={productQuery.error} onRetry={() => void productQuery.refetch()} retrying={productQuery.isFetching} />;
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title={isEdit ? 'Modifier le produit' : 'Ajouter un produit'}
        subtitle={isEdit ? productQuery.data?.name : "Le produit sera rattaché à votre compte administrateur"}
        breadcrumb={[{ label: 'Produits', href: BACK }, { label: isEdit ? 'Modifier' : 'Nouveau' }]}
      />
      <ProductForm key={productQuery.data?.id ?? 'new'} product={productQuery.data} backHref={BACK} allowedStatuses={ADMIN_STATUSES} onSaved={() => navigate(BACK)} />
    </div>
  );
}

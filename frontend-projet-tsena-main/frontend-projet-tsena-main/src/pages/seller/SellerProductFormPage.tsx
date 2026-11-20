import { useNavigate, useParams } from 'react-router-dom';
import { useTitle } from '../../hooks';
import { useAuth } from '../../context/AuthContext';
import { useProduct } from '../../hooks/queries/useProducts';
import ProductForm from '../../components/product/ProductForm';
import { EmptyState, ErrorState, LoadingState } from '../../components/common';
import PageHeader from '../../shared/components/PageHeader';
import { isNotFoundError } from '../../lib/api-error';

const BACK = '/dashboard/vendeur/produits';

export default function SellerProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  useTitle(isEdit ? 'Modifier le produit | Vendeur' : 'Nouveau produit | Vendeur');
  const navigate = useNavigate();
  const { user } = useAuth();
  const productQuery = useProduct(id);

  if (isEdit && productQuery.isPending) return <LoadingState variant="detail" label="Chargement du produit..." />;

  if (isEdit && productQuery.isError) {
    return isNotFoundError(productQuery.error) ? (
      <EmptyState title="Produit introuvable" description="Ce produit n'existe pas ou a été supprimé." action={{ label: 'Retour aux produits', to: BACK }} />
    ) : (
      <ErrorState error={productQuery.error} onRetry={() => void productQuery.refetch()} retrying={productQuery.isFetching} />
    );
  }

  if (isEdit && productQuery.data && user && productQuery.data.sellerId !== user.id && user.role !== 'admin') {
    return <EmptyState title="Accès refusé" description="Vous ne pouvez modifier que vos propres produits." action={{ label: 'Retour aux produits', to: BACK }} />;
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title={isEdit ? 'Modifier le produit' : 'Ajouter un nouveau produit'}
        subtitle={isEdit ? productQuery.data?.name : 'Renseignez les informations de votre produit'}
        breadcrumb={[{ label: 'Mes produits', href: BACK }, { label: isEdit ? 'Modifier' : 'Nouveau' }]}
      />
      <ProductForm key={productQuery.data?.id ?? 'new'} product={productQuery.data} backHref={BACK} onSaved={() => navigate(BACK)} />
    </div>
  );
}

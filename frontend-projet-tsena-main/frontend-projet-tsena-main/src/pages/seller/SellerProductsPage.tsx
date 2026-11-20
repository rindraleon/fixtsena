import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Eye, Package, AlertTriangle } from 'lucide-react';
import { useTitle } from '../../hooks';
import { useAuth } from '../../context/AuthContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useProducts } from '../../hooks/queries/useProducts';
import { useDeleteProduct } from '../../hooks/mutations/useProductMutations';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import DataTable, { type DataTableColumn } from '../../components/common/DataTable';
import { Button, ConfirmDialog } from '../../components/common';
import PageHeader from '../../shared/components/PageHeader';
import SearchInput from '../../shared/components/SearchInput';
import StatusBadge from '../../shared/components/StatusBadge';
import { formatPrice, primaryImageUrl, PRODUCT_STATUS_LABELS } from '../../lib/format';
import type { ApiProduct, ProductStatus } from '../../types/api';

const PAGE_SIZE = 10;
const STATUS_FILTERS: ProductStatus[] = ['draft', 'pending_review', 'active', 'unavailable', 'sold_out', 'archived', 'rejected'];

export default function SellerProductsPage() {
  useTitle('Mes produits | Vendeur');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const debouncedSearch = useDebouncedValue(search);
  const status = (searchParams.get('status') ?? '') as ProductStatus | '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const setParam = (key: string, value: string | null, resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (resetPage) next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const productsQuery = useProducts(
    { sellerId: user?.id, search: debouncedSearch || undefined, status: status || undefined, page, limit: PAGE_SIZE, sortBy: 'updatedAt', order: 'DESC' },
    { enabled: !!user },
  );
  const deleteProduct = useDeleteProduct();
  const confirmDelete = useConfirmAction<ApiProduct>();

  const columns: DataTableColumn<ApiProduct>[] = [
    {
      header: 'Produit',
      primary: true,
      cell: (product) => {
        const image = primaryImageUrl(product);
        return (
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-surface-secondary overflow-hidden shrink-0">
              {image ? <img src={image} alt="" className="w-full h-full object-cover" width={40} height={40} /> : <Package size={18} className="m-auto mt-2.5 text-muted" />}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-text truncate">{product.name}</p>
              <p className="text-xs text-muted truncate">{product.category?.name ?? '—'}{product.sku ? ` · ${product.sku}` : ''}</p>
            </div>
          </div>
        );
      },
    },
    { header: 'Prix', cell: (product) => <span className="font-semibold">{formatPrice(product.price)}</span>, mobile: true },
    {
      header: 'Stock',
      mobile: true,
      cell: (product) => {
        const low = product.stockQuantity > 0 && product.stockQuantity <= (product.lowStockThreshold || 5);
        return (
          <span className={product.stockQuantity === 0 ? 'text-danger font-medium inline-flex items-center gap-1' : low ? 'text-amber-600 dark:text-amber-400 font-medium inline-flex items-center gap-1' : ''}>
            {(product.stockQuantity === 0 || low) && <AlertTriangle size={12} />} {product.stockQuantity} unité{product.stockQuantity > 1 ? 's' : ''}
          </span>
        );
      },
    },
    { header: 'Ventes', cell: (product) => <span className="text-muted">{product.salesCount}</span> },
    { header: 'Statut', cell: (product) => <StatusBadge status={product.status} kind="product" />, mobile: true },
  ];

  return (
    <div>
      <PageHeader
        title="Mes produits"
        subtitle={productsQuery.data ? `${productsQuery.data.meta.total} produit${productsQuery.data.meta.total > 1 ? 's' : ''} dans votre catalogue` : 'Gérez votre catalogue'}
        actions={<Button icon={Plus} onClick={() => navigate('/dashboard/vendeur/produits/nouveau')}>Ajouter un produit</Button>}
      />

      <DataTable
        data={productsQuery.data?.items ?? []}
        columns={columns}
        isLoading={productsQuery.isPending}
        isFetching={productsQuery.isFetching}
        error={productsQuery.error}
        onRetry={() => void productsQuery.refetch()}
        toolbar={
          <>
            <SearchInput value={search} onChange={(value) => { setSearch(value); setParam('search', value || null); }} placeholder="Rechercher un produit..." className="flex-1" />
            <select value={status} onChange={(e) => setParam('status', e.target.value || null)} className="px-3 py-2 border border-input-border bg-input-bg rounded-lg text-sm text-text focus:outline-none focus:border-primary" aria-label="Filtrer par statut">
              <option value="">Tous les statuts</option>
              {STATUS_FILTERS.map((s) => <option key={s} value={s}>{PRODUCT_STATUS_LABELS[s]}</option>)}
            </select>
          </>
        }
        pagination={productsQuery.data ? { page, totalPages: productsQuery.data.meta.totalPages, total: productsQuery.data.meta.total, onPageChange: (p) => setParam('page', String(p), false) } : undefined}
        emptyIcon={Package}
        emptyTitle={debouncedSearch || status ? 'Aucun résultat' : 'Aucun produit'}
        emptyDescription={debouncedSearch || status ? 'Aucun produit ne correspond à vos filtres.' : 'Commencez par ajouter votre premier produit à votre boutique.'}
        emptyAction={debouncedSearch || status ? { label: 'Réinitialiser', onClick: () => { setSearch(''); setSearchParams(new URLSearchParams(), { replace: true }); } } : { label: 'Créer un produit', to: '/dashboard/vendeur/produits/nouveau', icon: Plus }}
        actions={(product) => (
          <>
            <Link to={`/produits/${product.slug || product.id}`} className="p-1.5 rounded-lg hover:bg-surface-tertiary text-muted hover:text-primary" aria-label={`Voir ${product.name}`} title="Voir la fiche"><Eye size={16} /></Link>
            <Link to={`/dashboard/vendeur/produits/${product.id}/modifier`} className="p-1.5 rounded-lg hover:bg-surface-tertiary text-muted hover:text-primary" aria-label={`Modifier ${product.name}`} title="Modifier"><Pencil size={16} /></Link>
            <button type="button" onClick={() => confirmDelete.request(product)} disabled={deleteProduct.isPending} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-muted hover:text-danger disabled:opacity-50" aria-label={`Supprimer ${product.name}`} title="Supprimer"><Trash2 size={16} /></button>
          </>
        )}
        data-testid="seller-products-table"
      />

      <ConfirmDialog
        open={confirmDelete.isOpen}
        variant="destructive"
        title="Supprimer ce produit ?"
        description={confirmDelete.target ? `« ${confirmDelete.target.name} » sera définitivement supprimé de votre catalogue. Cette action est irréversible.` : undefined}
        confirmLabel="Supprimer"
        loadingLabel="Suppression..."
        loading={deleteProduct.isPending}
        onConfirm={() => void confirmDelete.run((product) => deleteProduct.mutateAsync(product.id))}
        onCancel={confirmDelete.cancel}
      />
    </div>
  );
}

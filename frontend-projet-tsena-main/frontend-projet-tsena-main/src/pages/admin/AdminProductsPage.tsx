import { useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Eye, Package, CheckCircle2, XCircle, X, Ban } from 'lucide-react';
import { useTitle } from '../../hooks';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useProducts } from '../../hooks/queries/useProducts';
import { useDeleteProduct } from '../../hooks/mutations/useProductMutations';
import { useApproveProduct, useRejectProduct, useSuspendProduct } from '../../hooks/mutations/useUserMutations';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import DataTable, { type DataTableColumn } from '../../components/common/DataTable';
import { Button, ConfirmDialog } from '../../components/common';
import { FormError, FormField } from '../../components/form';
import PageHeader from '../../shared/components/PageHeader';
import SearchInput from '../../shared/components/SearchInput';
import StatusBadge from '../../shared/components/StatusBadge';
import { formatPrice, partyName, primaryImageUrl, PRODUCT_STATUS_LABELS } from '../../lib/format';
import { getFieldErrors } from '../../lib/api-error';
import type { ApiProduct, ProductStatus } from '../../types/api';

const PAGE_SIZE = 15;
const STATUS_FILTERS: ProductStatus[] = ['pending_review', 'active', 'draft', 'unavailable', 'sold_out', 'suspended', 'archived', 'rejected'];
type ProductAction = { kind: 'delete' | 'approve'; product: ApiProduct };

type ModerationMode = 'reject' | 'suspend';

function RejectDialog({ product, mode = 'reject', onClose }: { product: ApiProduct | null; mode?: ModerationMode; onClose: () => void }) {
  const reject = useRejectProduct();
  const suspend = useSuspendProduct();
  const rejectProduct = mode === 'suspend' ? suspend : reject;
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  if (!product) return null;
  const isSuspend = mode === 'suspend';
  const clientError = reason.trim().length < 10 ? 'Indiquez un motif d’au moins 10 caractères (il sera transmis au vendeur).' : undefined;
  const error = getFieldErrors(rejectProduct.error).reason ?? (submitted ? clientError : undefined);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (clientError || rejectProduct.isPending) return;
    rejectProduct.mutate({ id: product.id, reason: reason.trim() }, { onSuccess: onClose });
  };
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="reject-title">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => !rejectProduct.isPending && onClose()} aria-hidden="true" />
      <form onSubmit={submit} noValidate className="relative w-full sm:max-w-md bg-surface rounded-t-2xl sm:rounded-2xl shadow-2xl border border-border animate-scale-in" aria-busy={rejectProduct.isPending}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 id="reject-title" className="font-semibold text-text flex items-center gap-2">{isSuspend ? <Ban size={18} className="text-orange-500" /> : <XCircle size={18} className="text-danger" />} {isSuspend ? 'Suspendre le produit' : 'Rejeter le produit'}</h2>
          <button type="button" onClick={onClose} disabled={rejectProduct.isPending} className="p-2 rounded-lg hover:bg-surface-tertiary text-muted" aria-label="Fermer"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-muted">« <span className="font-medium text-text">{product.name}</span> » sera marqué comme rejeté et le vendeur en sera informé.</p>
          {rejectProduct.isError && <FormError error={rejectProduct.error} handledFields={['reason']} />}
          <FormField as="textarea" label={isSuspend ? 'Motif de la suspension' : 'Motif du rejet'} value={reason} onChange={(e) => setReason(e.target.value)} rows={4} maxLength={500} error={error} placeholder="Ex. photos non conformes, description insuffisante, produit interdit…" required />
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border bg-surface-secondary/40 rounded-b-2xl">
          <Button type="button" variant="ghost" onClick={onClose} disabled={rejectProduct.isPending}>Annuler</Button>
          <Button type="submit" variant="danger" loading={rejectProduct.isPending} loadingLabel={isSuspend ? 'Suspension...' : 'Rejet...'}>{isSuspend ? 'Suspendre le produit' : 'Rejeter le produit'}</Button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

export default function AdminProductsPage() {
  useTitle('Produits | Administration');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const debouncedSearch = useDebouncedValue(search);
  const status = (searchParams.get('status') ?? '') as ProductStatus | '';
  const sellerId = searchParams.get('sellerId') ?? '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const setParam = (key: string, value: string | null, resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (resetPage) next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const productsQuery = useProducts({ search: debouncedSearch || undefined, status: status || undefined, sellerId: sellerId || undefined, page, limit: PAGE_SIZE, sortBy: 'updatedAt', order: 'DESC' });
  const deleteProduct = useDeleteProduct();
  const approveProduct = useApproveProduct();
  const confirm = useConfirmAction<ProductAction>();
  const [rejecting, setRejecting] = useState<ApiProduct | null>(null);
  const [suspending, setSuspending] = useState<ApiProduct | null>(null);
  const pending = deleteProduct.isPending || approveProduct.isPending;
  const hasFilters = !!(debouncedSearch || status || sellerId);

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
              <p className="text-xs text-muted truncate">{product.category?.name ?? '—'}</p>
            </div>
          </div>
        );
      },
    },
    { header: 'Vendeur', cell: (product) => <span className="text-muted truncate">{partyName(product.seller ?? null, '—')}</span> },
    { header: 'Prix', mobile: true, cell: (product) => <span className="font-semibold">{formatPrice(product.price)}</span> },
    { header: 'Stock', cell: (product) => <span className={product.stockQuantity === 0 ? 'text-danger font-medium' : ''}>{product.stockQuantity}</span> },
    { header: 'Statut', mobile: true, cell: (product) => <StatusBadge status={product.status} kind="product" /> },
  ];

  const dialogCopy = confirm.target?.kind === 'delete'
    ? { variant: 'destructive' as const, title: 'Supprimer ce produit ?', description: `« ${confirm.target.product.name} » sera définitivement supprimé de la plateforme.`, confirmLabel: 'Supprimer', loadingLabel: 'Suppression...' }
    : confirm.target?.kind === 'approve'
      ? { variant: 'default' as const, title: 'Approuver ce produit ?', description: `« ${confirm.target.product.name} » sera publié et visible par tous les acheteurs.`, confirmLabel: 'Approuver', loadingLabel: 'Approbation...' }
      : null;

  return (
    <div>
      <PageHeader
        title="Produits"
        subtitle={productsQuery.data ? `${productsQuery.data.meta.total} produit${productsQuery.data.meta.total > 1 ? 's' : ''}` : 'Supervision et modération du catalogue'}
        actions={<Button icon={Plus} onClick={() => navigate('/dashboard/admin/produits/nouveau')}>Ajouter un produit</Button>}
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
            {sellerId && <Button variant="ghost" size="sm" onClick={() => setParam('sellerId', null)}>Retirer le filtre vendeur ✕</Button>}
          </>
        }
        pagination={productsQuery.data ? { page, totalPages: productsQuery.data.meta.totalPages, total: productsQuery.data.meta.total, onPageChange: (p) => setParam('page', String(p), false) } : undefined}
        emptyIcon={Package}
        emptyTitle={hasFilters ? 'Aucun résultat' : 'Aucun produit'}
        emptyDescription={hasFilters ? 'Aucun produit ne correspond à vos filtres.' : 'Le catalogue est vide pour le moment.'}
        emptyAction={hasFilters ? { label: 'Réinitialiser', onClick: () => { setSearch(''); setSearchParams(new URLSearchParams(), { replace: true }); } } : { label: 'Créer un produit', to: '/dashboard/admin/produits/nouveau', icon: Plus }}
        actions={(product) => (
          <>
            {product.status === 'pending_review' && (
              <>
                <button type="button" onClick={() => confirm.request({ kind: 'approve', product })} disabled={pending} className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-muted hover:text-emerald-600 disabled:opacity-50" aria-label={`Approuver ${product.name}`} title="Approuver"><CheckCircle2 size={16} /></button>
                <button type="button" onClick={() => setRejecting(product)} disabled={pending} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-muted hover:text-danger disabled:opacity-50" aria-label={`Rejeter ${product.name}`} title="Rejeter"><XCircle size={16} /></button>
              </>
            )}
            {(product.status === 'active' || product.status === 'published' || product.status === 'unavailable' || product.status === 'sold_out') && (
              <button type="button" onClick={() => setSuspending(product)} disabled={pending} className="p-1.5 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-500/10 text-muted hover:text-orange-600 disabled:opacity-50" aria-label={`Suspendre ${product.name}`} title="Suspendre (modération)" data-testid={`product-suspend-${product.id}`}><Ban size={16} /></button>
            )}
            <Link to={`/produits/${product.slug || product.id}`} className="p-1.5 rounded-lg hover:bg-surface-tertiary text-muted hover:text-primary" aria-label={`Voir ${product.name}`} title="Voir la fiche"><Eye size={16} /></Link>
            <Link to={`/dashboard/admin/produits/${product.id}/modifier`} className="p-1.5 rounded-lg hover:bg-surface-tertiary text-muted hover:text-primary" aria-label={`Modifier ${product.name}`} title="Modifier"><Pencil size={16} /></Link>
            <button type="button" onClick={() => confirm.request({ kind: 'delete', product })} disabled={pending} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-muted hover:text-danger disabled:opacity-50" aria-label={`Supprimer ${product.name}`} title="Supprimer"><Trash2 size={16} /></button>
          </>
        )}
        data-testid="admin-products-table"
      />

      <ConfirmDialog
        open={confirm.isOpen}
        variant={dialogCopy?.variant ?? 'destructive'}
        title={dialogCopy?.title ?? ''}
        description={dialogCopy?.description}
        confirmLabel={dialogCopy?.confirmLabel}
        loadingLabel={dialogCopy?.loadingLabel}
        loading={pending}
        onConfirm={() => void confirm.run((action) => action.kind === 'delete' ? deleteProduct.mutateAsync(action.product.id) : approveProduct.mutateAsync(action.product.id))}
        onCancel={confirm.cancel}
      />
      <RejectDialog product={rejecting} onClose={() => setRejecting(null)} />
      <RejectDialog product={suspending} mode="suspend" onClose={() => setSuspending(null)} />
    </div>
  );
}

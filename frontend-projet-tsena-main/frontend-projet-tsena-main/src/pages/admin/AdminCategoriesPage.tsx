import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, FolderTree, Folder } from 'lucide-react';
import { useTitle } from '../../hooks';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useCategories } from '../../hooks/queries/useCategories';
import { useDeleteCategory } from '../../hooks/mutations/useCategoryMutations';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import DataTable, { type DataTableColumn } from '../../components/common/DataTable';
import { Button, ConfirmDialog } from '../../components/common';
import PageHeader from '../../shared/components/PageHeader';
import SearchInput from '../../shared/components/SearchInput';
import { formatDate } from '../../lib/format';
import type { ApiCategory } from '../../types/api';
import { resolveMediaUrl } from '../../lib/media';

const PAGE_SIZE = 15;

export default function AdminCategoriesPage() {
  useTitle('Catégories | Administration');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const debouncedSearch = useDebouncedValue(search);
  const showInactive = searchParams.get('inactive') === '1';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const setParam = (key: string, value: string | null, resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (resetPage) next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const categoriesQuery = useCategories({ search: debouncedSearch || undefined, includeInactive: showInactive || undefined, page, limit: PAGE_SIZE });
  const deleteCategory = useDeleteCategory();
  const confirmDelete = useConfirmAction<ApiCategory>();

  const columns: DataTableColumn<ApiCategory>[] = [
    {
      header: 'Catégorie',
      primary: true,
      cell: (category) => (
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-surface-secondary overflow-hidden shrink-0 flex items-center justify-center text-muted">
            {category.imageUrl ? <img src={resolveMediaUrl(category.imageUrl)} alt="" className="w-full h-full object-cover" /> : <Folder size={18} />}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-text truncate">{category.name}</p>
            <p className="text-xs text-muted truncate font-mono">/{category.slug}</p>
          </div>
        </div>
      ),
    },
    { header: 'Parent', cell: (category) => <span className="text-muted">{category.parent?.name ?? '—'}</span> },
    { header: 'Produits', mobile: true, cell: (category) => <span className="font-medium">{category.productCount}</span> },
    { header: 'Ordre', cell: (category) => <span className="text-muted">{category.sortOrder}</span> },
    { header: 'Statut', mobile: true, cell: (category) => <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${category.isActive ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-500/15 dark:text-gray-300'}`}>{category.isActive ? 'Active' : 'Inactive'}</span> },
    { header: 'Créée le', cell: (category) => <span className="text-muted">{formatDate(category.createdAt)}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Catégories"
        subtitle={categoriesQuery.data ? `${categoriesQuery.data.meta.total} catégorie${categoriesQuery.data.meta.total > 1 ? 's' : ''}` : 'Organisation du catalogue'}
        actions={<Button icon={Plus} onClick={() => navigate('/dashboard/admin/categories/nouveau')}>Nouvelle catégorie</Button>}
      />
      <DataTable
        data={categoriesQuery.data?.items ?? []}
        columns={columns}
        isLoading={categoriesQuery.isPending}
        isFetching={categoriesQuery.isFetching}
        error={categoriesQuery.error}
        onRetry={() => void categoriesQuery.refetch()}
        toolbar={
          <>
            <SearchInput value={search} onChange={(value) => { setSearch(value); setParam('search', value || null); }} placeholder="Rechercher une catégorie..." className="flex-1" />
            <label className="inline-flex items-center gap-2 text-sm text-muted cursor-pointer select-none">
              <input type="checkbox" checked={showInactive} onChange={(e) => setParam('inactive', e.target.checked ? '1' : null)} className="accent-primary" /> Afficher les inactives
            </label>
          </>
        }
        pagination={categoriesQuery.data ? { page, totalPages: categoriesQuery.data.meta.totalPages, total: categoriesQuery.data.meta.total, onPageChange: (p) => setParam('page', String(p), false) } : undefined}
        emptyIcon={FolderTree}
        emptyTitle={debouncedSearch ? 'Aucun résultat' : 'Aucune catégorie'}
        emptyDescription={debouncedSearch ? 'Aucune catégorie ne correspond à votre recherche.' : 'Créez votre première catégorie pour organiser le catalogue.'}
        emptyAction={debouncedSearch ? { label: 'Réinitialiser', onClick: () => { setSearch(''); setSearchParams(new URLSearchParams(), { replace: true }); } } : { label: 'Créer une catégorie', to: '/dashboard/admin/categories/nouveau', icon: Plus }}
        actions={(category) => (
          <>
            <Link to={`/dashboard/admin/categories/${category.id}/modifier`} className="p-1.5 rounded-lg hover:bg-surface-tertiary text-muted hover:text-primary" aria-label={`Modifier ${category.name}`} title="Modifier"><Pencil size={16} /></Link>
            <button type="button" onClick={() => confirmDelete.request(category)} disabled={deleteCategory.isPending} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-muted hover:text-danger disabled:opacity-50" aria-label={`Supprimer ${category.name}`} title="Supprimer"><Trash2 size={16} /></button>
          </>
        )}
        data-testid="admin-categories-table"
      />

      <ConfirmDialog
        open={confirmDelete.isOpen}
        variant="destructive"
        title="Supprimer cette catégorie ?"
        description={confirmDelete.target ? (confirmDelete.target.productCount > 0 ? `« ${confirmDelete.target.name} » contient ${confirmDelete.target.productCount} produit(s) : le backend refusera la suppression tant qu'ils n'auront pas été déplacés.` : `« ${confirmDelete.target.name} » sera définitivement supprimée.`) : undefined}
        confirmLabel="Supprimer"
        loadingLabel="Suppression..."
        loading={deleteCategory.isPending}
        onConfirm={() => void confirmDelete.run((category) => deleteCategory.mutateAsync(category.id))}
        onCancel={confirmDelete.cancel}
      />
    </div>
  );
}

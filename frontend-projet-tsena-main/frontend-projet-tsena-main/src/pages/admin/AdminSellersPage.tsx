import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { Store, UserCheck, Eye, Clock, Mail } from 'lucide-react';
import { useTitle } from '../../hooks';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useUsers } from '../../hooks/queries/useUsers';
import { useApproveSeller } from '../../hooks/mutations/useUserMutations';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import DataTable, { type DataTableColumn } from '../../components/common/DataTable';
import { Button, ConfirmDialog } from '../../components/common';
import PageHeader from '../../shared/components/PageHeader';
import SearchInput from '../../shared/components/SearchInput';
import StatusBadge from '../../shared/components/StatusBadge';
import { formatDate, formatRelativeDate } from '../../lib/format';
import type { ApiUser } from '../../types/api';
import { resolveMediaUrl } from '../../lib/media';

const PAGE_SIZE = 15;
type Tab = 'requests' | 'sellers';

export default function AdminSellersPage() {
  useTitle('Vendeurs | Administration');
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get('tab') === 'sellers' ? 'sellers' : 'requests') as Tab;
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const debouncedSearch = useDebouncedValue(search);
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const setParam = (key: string, value: string | null, resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (resetPage) next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const requestsQuery = useUsers({ sellerRequested: true, search: tab === 'requests' && debouncedSearch ? debouncedSearch : undefined, page: tab === 'requests' ? page : 1, limit: PAGE_SIZE });
  const sellersQuery = useUsers({ role: 'seller', search: tab === 'sellers' && debouncedSearch ? debouncedSearch : undefined, page: tab === 'sellers' ? page : 1, limit: PAGE_SIZE });
  const approveSeller = useApproveSeller();
  const confirmApprove = useConfirmAction<ApiUser>();
  const active = tab === 'requests' ? requestsQuery : sellersQuery;

  const identityColumn: DataTableColumn<ApiUser> = {
    header: 'Utilisateur',
    primary: true,
    cell: (user) => (
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
          {user.avatarUrl ? <img src={resolveMediaUrl(user.avatarUrl)} alt="" className="w-full h-full object-cover" /> : `${user.firstName[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-text truncate">{user.firstName} {user.lastName ?? ''}</p>
          <p className="text-xs text-muted truncate flex items-center gap-1"><Mail size={11} /> {user.email}</p>
        </div>
      </div>
    ),
  };

  const requestColumns: DataTableColumn<ApiUser>[] = [
    identityColumn,
    { header: 'Demande', mobile: true, cell: (user) => <span className="text-muted inline-flex items-center gap-1"><Clock size={12} /> {user.sellerRequestedAt ? formatRelativeDate(user.sellerRequestedAt) : '—'}</span> },
    { header: 'E-mail vérifié', cell: (user) => <span className={user.emailVerified ? 'text-emerald-600' : 'text-amber-600'}>{user.emailVerified ? 'Oui' : 'Non'}</span> },
    { header: 'Statut', mobile: true, cell: (user) => <StatusBadge status={user.status} kind="account" /> },
  ];

  const sellerColumns: DataTableColumn<ApiUser>[] = [
    identityColumn,
    { header: 'Réputation', cell: (user) => <span className="text-muted">{Number(user.reputationScore ?? 0).toFixed(1)} / 5</span> },
    { header: 'Statut', mobile: true, cell: (user) => <StatusBadge status={user.status} kind="account" /> },
    { header: 'Inscrit le', cell: (user) => <span className="text-muted">{formatDate(user.createdAt)}</span> },
  ];

  return (
    <div>
      <PageHeader title="Vendeurs" subtitle="Validez les demandes d'ouverture de boutique et supervisez les vendeurs actifs" />

      <div className="flex gap-2 mb-4 border-b border-border" role="tablist">
        {([['requests', 'Demandes', requestsQuery.data?.meta.total], ['sellers', 'Vendeurs', sellersQuery.data?.meta.total]] as const).map(([key, label, count]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => { setSearch(''); setSearchParams({ tab: key }, { replace: true }); }} className={clsx('px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors inline-flex items-center gap-2', tab === key ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text')}>
            {label}
            {count !== undefined && <span className={clsx('px-1.5 py-0.5 rounded-full text-[11px] font-semibold', tab === key ? 'bg-primary/10 text-primary' : 'bg-surface-tertiary text-muted')}>{count}</span>}
          </button>
        ))}
      </div>

      <DataTable
        key={tab}
        data={active.data?.items ?? []}
        columns={tab === 'requests' ? requestColumns : sellerColumns}
        isLoading={active.isPending}
        isFetching={active.isFetching}
        error={active.error}
        onRetry={() => void active.refetch()}
        toolbar={<SearchInput value={search} onChange={(value) => { setSearch(value); setParam('search', value || null); }} placeholder="Rechercher un utilisateur..." className="flex-1" />}
        pagination={active.data ? { page, totalPages: active.data.meta.totalPages, total: active.data.meta.total, onPageChange: (p) => setParam('page', String(p), false) } : undefined}
        emptyIcon={tab === 'requests' ? UserCheck : Store}
        emptyTitle={debouncedSearch ? 'Aucun résultat' : tab === 'requests' ? 'Aucune demande en attente' : 'Aucun vendeur'}
        emptyDescription={debouncedSearch ? 'Aucun utilisateur ne correspond à votre recherche.' : tab === 'requests' ? 'Toutes les demandes de compte vendeur ont été traitées.' : 'Aucun vendeur actif pour le moment.'}
        actions={(user) => (
          <>
            <Link to={`/dashboard/admin/vendeurs/${user.id}`} className="p-1.5 rounded-lg hover:bg-surface-tertiary text-muted hover:text-primary" aria-label={`Voir ${user.firstName}`} title="Voir le profil"><Eye size={16} /></Link>
            {tab === 'requests' && (
              <Button size="sm" icon={UserCheck} onClick={() => confirmApprove.request(user)} disabled={approveSeller.isPending}>Approuver</Button>
            )}
          </>
        )}
        data-testid="admin-sellers-table"
      />

      <ConfirmDialog
        open={confirmApprove.isOpen}
        title="Approuver ce vendeur ?"
        description={confirmApprove.target ? `${confirmApprove.target.firstName} ${confirmApprove.target.lastName ?? ''} obtiendra le rôle vendeur et pourra publier des produits immédiatement.` : undefined}
        confirmLabel="Approuver"
        loadingLabel="Approbation..."
        loading={approveSeller.isPending}
        onConfirm={() => void confirmApprove.run((user) => approveSeller.mutateAsync(user.id))}
        onCancel={confirmApprove.cancel}
      />
    </div>
  );
}

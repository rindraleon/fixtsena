import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Users, Ban, CheckCircle2, Mail, Phone } from 'lucide-react';
import { useTitle } from '../../hooks';
import { useAuth } from '../../context/AuthContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useUsers } from '../../hooks/queries/useUsers';
import { useActivateUser, useDeleteUser, useSuspendUser } from '../../hooks/mutations/useUserMutations';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import DataTable, { type DataTableColumn } from '../../components/common/DataTable';
import { Button, ConfirmDialog } from '../../components/common';
import PageHeader from '../../shared/components/PageHeader';
import SearchInput from '../../shared/components/SearchInput';
import StatusBadge from '../../shared/components/StatusBadge';
import { ACCOUNT_STATUS_LABELS, formatDate, ROLE_LABELS, roleLabels } from '../../lib/format';
import type { AccountStatus, ApiUser, UserRole } from '../../types/api';
import { resolveMediaUrl } from '../../lib/media';

const PAGE_SIZE = 15;
const ROLE_FILTERS: UserRole[] = ['client', 'seller', 'admin'];
const STATUS_FILTERS: AccountStatus[] = ['active', 'suspended', 'pending_verification', 'disabled'];

type UserAction = { kind: 'delete' | 'suspend' | 'activate'; user: ApiUser };

export default function AdminUsersPage() {
  useTitle('Utilisateurs | Administration');
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const debouncedSearch = useDebouncedValue(search);
  const role = (searchParams.get('role') ?? '') as UserRole | '';
  const status = (searchParams.get('status') ?? '') as AccountStatus | '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const setParam = (key: string, value: string | null, resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (resetPage) next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const usersQuery = useUsers({ search: debouncedSearch || undefined, role: role || undefined, status: status || undefined, page, limit: PAGE_SIZE });
  const deleteUser = useDeleteUser();
  const suspendUser = useSuspendUser();
  const activateUser = useActivateUser();
  const confirm = useConfirmAction<UserAction>();
  const pending = deleteUser.isPending || suspendUser.isPending || activateUser.isPending;

  const columns: DataTableColumn<ApiUser>[] = [
    {
      header: 'Utilisateur',
      primary: true,
      cell: (user) => (
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
            {user.avatarUrl ? <img src={resolveMediaUrl(user.avatarUrl)} alt="" className="w-full h-full object-cover" /> : `${user.firstName[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-text truncate">{user.firstName} {user.lastName ?? ''}{user.id === me?.id && <span className="ml-1 text-[10px] uppercase text-muted">(vous)</span>}</p>
            <p className="text-xs text-muted truncate flex items-center gap-1"><Mail size={11} /> {user.email}</p>
          </div>
        </div>
      ),
    },
    { header: 'Téléphone', cell: (user) => user.phone ? <span className="text-muted inline-flex items-center gap-1"><Phone size={12} /> {user.phone}</span> : <span className="text-muted">—</span> },
    { header: 'Rôles', mobile: true, cell: (user) => <div className="flex flex-wrap gap-1">{roleLabels(user.roles).map((label) => <span key={label} className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary">{label}</span>)}</div> },
    { header: 'Statut', mobile: true, cell: (user) => <div className="flex items-center gap-1.5"><StatusBadge status={user.status} kind="account" />{!user.emailVerified && <span className="text-[10px] text-amber-600" title="E-mail non vérifié">non vérifié</span>}</div> },
    { header: 'Inscrit le', cell: (user) => <span className="text-muted">{formatDate(user.createdAt)}</span> },
  ];

  const dialogCopy = confirm.target ? {
    delete: { title: 'Supprimer cet utilisateur ?', description: `Le compte de ${confirm.target.user.firstName} ${confirm.target.user.lastName ?? ''} (${confirm.target.user.email}) sera supprimé. Cette action est irréversible.`, confirmLabel: 'Supprimer', loadingLabel: 'Suppression...', variant: 'destructive' as const },
    suspend: { title: 'Suspendre ce compte ?', description: `${confirm.target.user.firstName} ne pourra plus se connecter tant que le compte est suspendu.`, confirmLabel: 'Suspendre', loadingLabel: 'Suspension...', variant: 'destructive' as const },
    activate: { title: 'Réactiver ce compte ?', description: `${confirm.target.user.firstName} pourra de nouveau se connecter et utiliser la plateforme.`, confirmLabel: 'Réactiver', loadingLabel: 'Activation...', variant: 'default' as const },
  }[confirm.target.kind] : null;

  const runAction = (action: UserAction) => {
    if (action.kind === 'delete') return deleteUser.mutateAsync(action.user.id);
    if (action.kind === 'suspend') return suspendUser.mutateAsync({ id: action.user.id, reason: 'Suspension administrative' });
    return activateUser.mutateAsync(action.user.id);
  };

  return (
    <div>
      <PageHeader
        title="Utilisateurs"
        subtitle={usersQuery.data ? `${usersQuery.data.meta.total} compte${usersQuery.data.meta.total > 1 ? 's' : ''}` : 'Gestion des comptes et des rôles'}
        actions={<Button icon={Plus} onClick={() => navigate('/dashboard/admin/utilisateurs/nouveau')}>Nouvel utilisateur</Button>}
      />
      <DataTable
        data={usersQuery.data?.items ?? []}
        columns={columns}
        isLoading={usersQuery.isPending}
        isFetching={usersQuery.isFetching}
        error={usersQuery.error}
        onRetry={() => void usersQuery.refetch()}
        toolbar={
          <>
            <SearchInput value={search} onChange={(value) => { setSearch(value); setParam('search', value || null); }} placeholder="Nom, e-mail..." className="flex-1" />
            <select value={role} onChange={(e) => setParam('role', e.target.value || null)} className="px-3 py-2 border border-input-border bg-input-bg rounded-lg text-sm text-text focus:outline-none focus:border-primary" aria-label="Filtrer par rôle">
              <option value="">Tous les rôles</option>
              {ROLE_FILTERS.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            <select value={status} onChange={(e) => setParam('status', e.target.value || null)} className="px-3 py-2 border border-input-border bg-input-bg rounded-lg text-sm text-text focus:outline-none focus:border-primary" aria-label="Filtrer par statut">
              <option value="">Tous les statuts</option>
              {STATUS_FILTERS.map((s) => <option key={s} value={s}>{ACCOUNT_STATUS_LABELS[s]}</option>)}
            </select>
          </>
        }
        pagination={usersQuery.data ? { page, totalPages: usersQuery.data.meta.totalPages, total: usersQuery.data.meta.total, onPageChange: (p) => setParam('page', String(p), false) } : undefined}
        emptyIcon={Users}
        emptyTitle={debouncedSearch || role || status ? 'Aucun résultat' : 'Aucun utilisateur'}
        emptyDescription={debouncedSearch || role || status ? 'Aucun utilisateur ne correspond à vos filtres.' : 'Aucun compte enregistré pour le moment.'}
        emptyAction={debouncedSearch || role || status ? { label: 'Réinitialiser', onClick: () => { setSearch(''); setSearchParams(new URLSearchParams(), { replace: true }); } } : undefined}
        actions={(user) => {
          const isSelf = user.id === me?.id;
          return (
            <>
              <Link to={`/dashboard/admin/utilisateurs/${user.id}/modifier`} className="p-1.5 rounded-lg hover:bg-surface-tertiary text-muted hover:text-primary" aria-label={`Modifier ${user.firstName}`} title="Modifier"><Pencil size={16} /></Link>
              {user.status === 'suspended' ? (
                <button type="button" onClick={() => confirm.request({ kind: 'activate', user })} disabled={pending} className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-muted hover:text-emerald-600 disabled:opacity-50" aria-label={`Réactiver ${user.firstName}`} title="Réactiver"><CheckCircle2 size={16} /></button>
              ) : (
                <button type="button" onClick={() => confirm.request({ kind: 'suspend', user })} disabled={pending || isSelf} className="p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-500/10 text-muted hover:text-amber-600 disabled:opacity-30" aria-label={`Suspendre ${user.firstName}`} title={isSelf ? 'Vous ne pouvez pas suspendre votre propre compte' : 'Suspendre'}><Ban size={16} /></button>
              )}
              <button type="button" onClick={() => confirm.request({ kind: 'delete', user })} disabled={pending || isSelf} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-muted hover:text-danger disabled:opacity-30" aria-label={`Supprimer ${user.firstName}`} title={isSelf ? 'Vous ne pouvez pas supprimer votre propre compte' : 'Supprimer'}><Trash2 size={16} /></button>
            </>
          );
        }}
        data-testid="admin-users-table"
      />

      <ConfirmDialog
        open={confirm.isOpen}
        variant={dialogCopy?.variant ?? 'destructive'}
        title={dialogCopy?.title ?? ''}
        description={dialogCopy?.description}
        confirmLabel={dialogCopy?.confirmLabel}
        loadingLabel={dialogCopy?.loadingLabel}
        loading={pending}
        onConfirm={() => void confirm.run(runAction)}
        onCancel={confirm.cancel}
      />
    </div>
  );
}

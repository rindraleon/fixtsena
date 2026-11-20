import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { useDisputes } from '../../hooks/queries/useDisputes';
import DisputesTable from './DisputesTable';
import PageHeader from '../../shared/components/PageHeader';
import { DISPUTE_STATUS_LABELS } from '../../lib/format';
import type { AppRole } from '../../types/auth';
import type { ApiDispute, DisputeStatus } from '../../types/api';
import type { ReactNode } from 'react';

interface DisputesPageProps {
  readonly role: AppRole;
  readonly title: string;
  readonly subtitle: string;
  readonly orderHref: (dispute: ApiDispute) => string;
  readonly header?: ReactNode;
}

const PAGE_SIZE = 10;
const STATUS_GROUPS: { key: string; label: string; statuses: DisputeStatus[] }[] = [
  { key: '', label: 'Tous', statuses: [] },
  { key: 'reported', label: DISPUTE_STATUS_LABELS.reported, statuses: ['reported'] },
  { key: 'open', label: DISPUTE_STATUS_LABELS.open, statuses: ['open'] },
  { key: 'under_review', label: DISPUTE_STATUS_LABELS.under_review, statuses: ['under_review'] },
  { key: 'awaiting_evidence', label: DISPUTE_STATUS_LABELS.awaiting_evidence, statuses: ['awaiting_evidence'] },
  { key: 'resolved_buyer', label: DISPUTE_STATUS_LABELS.resolved_buyer, statuses: ['resolved_buyer'] },
  { key: 'resolved_seller', label: DISPUTE_STATUS_LABELS.resolved_seller, statuses: ['resolved_seller'] },
  { key: 'partial_resolution', label: DISPUTE_STATUS_LABELS.partial_resolution, statuses: ['partial_resolution'] },
  { key: 'closed', label: DISPUTE_STATUS_LABELS.closed, statuses: ['closed'] },
];

export default function DisputesPage({ role, title, subtitle, orderHref, header }: DisputesPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = (searchParams.get('status') ?? '') as DisputeStatus | '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const disputesQuery = useDisputes({ status: status || undefined, page, limit: PAGE_SIZE });

  const setParam = (key: string, value: string | null, resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (resetPage) next.delete('page');
    setSearchParams(next, { replace: true });
  };

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} />
      {header}
      <DisputesTable
        role={role}
        data={disputesQuery.data}
        isLoading={disputesQuery.isPending}
        isFetching={disputesQuery.isFetching}
        error={disputesQuery.error}
        onRetry={() => void disputesQuery.refetch()}
        page={page}
        onPageChange={(p) => setParam('page', String(p), false)}
        orderHref={orderHref}
        toolbar={
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide w-full" role="tablist" aria-label="Filtrer par statut">
            {STATUS_GROUPS.map((group) => (
              <button key={group.key || 'all'} type="button" role="tab" aria-selected={status === group.key} onClick={() => setParam('status', group.key || null)} className={clsx('shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors', status === group.key ? 'bg-primary text-white border-primary' : 'bg-surface text-muted border-border hover:border-primary/40 hover:text-primary')}>
                {group.label}
              </button>
            ))}
          </div>
        }
        emptyTitle={status ? 'Aucun résultat' : 'Aucun litige'}
        emptyDescription={status ? 'Aucun litige ne correspond à ce filtre.' : role === 'admin' ? 'Aucun litige n’a été signalé sur la plateforme.' : 'Vous n’avez signalé aucun problème et aucun litige ne vous concerne.'}
      />
    </div>
  );
}

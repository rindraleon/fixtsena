import { useState, type ReactNode } from 'react';
import { Scale } from 'lucide-react';
import DataTable, { type DataTableColumn } from '../common/DataTable';
import StatusBadge from '../../shared/components/StatusBadge';
import DisputeDetailDialog from './DisputeDetailDialog';
import { formatDate, formatPrice, partyName } from '../../lib/format';
import type { AppRole } from '../../types/auth';
import type { ApiDispute, Paginated } from '../../types/api';

interface DisputesTableProps {
  readonly role: AppRole;
  readonly data: Paginated<ApiDispute> | undefined;
  readonly isLoading: boolean;
  readonly isFetching?: boolean;
  readonly error: unknown;
  readonly onRetry: () => void;
  readonly page: number;
  readonly onPageChange: (page: number) => void;
  readonly toolbar?: ReactNode;
  readonly emptyTitle?: string;
  readonly emptyDescription?: string;
  readonly orderHref?: (dispute: ApiDispute) => string;
}

export default function DisputesTable({ role, data, isLoading, isFetching, error, onRetry, page, onPageChange, toolbar, emptyTitle = 'Aucun litige', emptyDescription, orderHref }: DisputesTableProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const columns: DataTableColumn<ApiDispute>[] = [
    {
      header: 'Commande',
      primary: true,
      cell: (dispute) => (
        <div className="min-w-0">
          <p className="font-semibold text-text font-mono text-xs sm:text-sm">{dispute.orderNumber ?? '—'}</p>
          <p className="text-xs text-muted truncate max-w-[16rem]">{dispute.reason}</p>
        </div>
      ),
    },
    { header: 'Signalé par', cell: (dispute) => <span className="text-text">{partyName(dispute.reporter)}</span> },
    ...(role === 'admin' ? [
      { header: 'Acheteur', cell: (dispute: ApiDispute) => <span className="text-muted">{partyName(dispute.buyer)}</span> },
      { header: 'Vendeur', cell: (dispute: ApiDispute) => <span className="text-muted">{partyName(dispute.seller)}</span> },
    ] : []),
    { header: 'Montant', cell: (dispute) => <span className="font-semibold">{dispute.orderTotal !== null ? formatPrice(dispute.orderTotal) : '—'}</span>, mobile: true },
    { header: 'Date', cell: (dispute) => <span className="text-muted">{formatDate(dispute.createdAt)}</span>, mobile: true },
    { header: 'Statut', cell: (dispute) => <StatusBadge status={dispute.status} kind="dispute" />, mobile: true },
  ];

  return (
    <>
      <DataTable
        data={data?.items ?? []}
        columns={columns}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={onRetry}
        toolbar={toolbar}
        onRowClick={(dispute) => setSelectedId(dispute.id)}
        pagination={data ? { page, totalPages: data.meta.totalPages, total: data.meta.total, onPageChange } : undefined}
        emptyIcon={Scale}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        data-testid="disputes-table"
      />
      <DisputeDetailDialog disputeId={selectedId} role={role} onClose={() => setSelectedId(null)} orderHref={orderHref} />
    </>
  );
}

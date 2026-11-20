import { useState } from 'react';
import { Eye, ClipboardList } from 'lucide-react';
import DataTable, { type DataTableColumn } from '../common/DataTable';
import StatusBadge from '../../shared/components/StatusBadge';
import OrderStatusActions from './OrderStatusActions';
import OrderDetailDialog from './OrderDetailDialog';
import { formatDate, formatPrice, partyName } from '../../lib/format';
import type { AppRole } from '../../types/auth';
import type { OrderPartySummary, ApiOrder, Paginated } from '../../types/api';
import type { ReactNode } from 'react';

interface OrdersTableProps {
  readonly role: AppRole;
  readonly data: Paginated<ApiOrder> | undefined;
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly error: unknown;
  readonly onRetry: () => void;
  readonly page: number;
  readonly onPageChange: (page: number) => void;
  readonly toolbar?: ReactNode;
  readonly emptyTitle?: string;
  readonly emptyDescription?: string;
  readonly emptyAction?: { label: string; to: string };
  readonly extraColumns?: readonly DataTableColumn<ApiOrder>[];
}

function PartyCell({ party }: { party: OrderPartySummary | null }) {
  return (
    <div className="min-w-0">
      <p className="text-text truncate">{partyName(party)}</p>
      {party?.email && <p className="text-xs text-muted truncate">{party.email}</p>}
    </div>
  );
}

export default function OrdersTable({ role, data, isLoading, isFetching, error, onRetry, page, onPageChange, toolbar, emptyTitle = 'Aucune commande', emptyDescription, emptyAction, extraColumns = [] }: OrdersTableProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const columns: DataTableColumn<ApiOrder>[] = [
    {
      header: 'Commande',
      primary: true,
      cell: (order) => (
        <div>
          <p className="font-semibold text-text font-mono text-xs sm:text-sm">{order.orderNumber}</p>
          <p className="text-xs text-muted">{order.lines?.length ?? 0} article{(order.lines?.length ?? 0) > 1 ? 's' : ''}</p>
        </div>
      ),
    },
    ...(role !== 'client' ? [{ header: 'Client', cell: (order: ApiOrder) => <PartyCell party={order.buyer} /> }] : []),
    ...(role !== 'seller' ? [{ header: 'Vendeur', cell: (order: ApiOrder) => <PartyCell party={order.seller} /> }] : []),
    ...extraColumns,
    { header: 'Date', cell: (order) => <span className="text-muted">{formatDate(order.createdAt)}</span>, mobile: true },
    { header: 'Montant', cell: (order) => <span className="font-semibold">{formatPrice(order.totalAmount)}</span>, mobile: true },
    { header: 'Statut', cell: (order) => <StatusBadge status={order.status} kind="order" />, mobile: true },
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
        onRowClick={(order) => setSelectedId(order.id)}
        pagination={data ? { page, totalPages: data.meta.totalPages, total: data.meta.total, onPageChange } : undefined}
        emptyIcon={ClipboardList}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        emptyAction={emptyAction}
        actions={(order) => (
          <>
            <button type="button" onClick={() => setSelectedId(order.id)} className="p-1.5 rounded-lg hover:bg-surface-tertiary text-muted hover:text-primary" aria-label={`Voir la commande ${order.orderNumber}`}>
              <Eye size={16} />
            </button>
            <div className="hidden lg:block"><OrderStatusActions order={order} role={role} /></div>
          </>
        )}
        data-testid="orders-table"
      />
      <OrderDetailDialog orderId={selectedId} role={role} onClose={() => setSelectedId(null)} />
    </>
  );
}

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTitle } from '../../hooks';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useOrders, useSellerOrderStats } from '../../hooks/queries/useOrders';
import { useAuth } from '../../context/AuthContext';
import { OrdersTable, OrderStatusFilter } from '../../components/orders';
import PageHeader from '../../shared/components/PageHeader';
import SearchInput from '../../shared/components/SearchInput';
import type { OrderStatus } from '../../types/api';

const PAGE_SIZE = 10;

export default function SellerOrdersPage() {
  useTitle('Commandes | Vendeur');
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const debouncedSearch = useDebouncedValue(search);
  const status = (searchParams.get('status') ?? '') as OrderStatus | '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const setParam = (key: string, value: string | null, resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (resetPage) next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const ordersQuery = useOrders({ sellerId: user?.id, status: status || undefined, search: debouncedSearch || undefined, page, limit: PAGE_SIZE }, { enabled: !!user });
  const statsQuery = useSellerOrderStats();
  const stats = statsQuery.data;

  return (
    <div>
      <PageHeader
        title="Commandes reçues"
        subtitle={stats ? `${stats.pendingOrders} commande${stats.pendingOrders > 1 ? 's' : ''} en attente de confirmation` : 'Suivez et traitez les commandes de vos clients'}
      />

      <OrdersTable
        role="seller"
        data={ordersQuery.data}
        isLoading={ordersQuery.isPending}
        isFetching={ordersQuery.isFetching}
        error={ordersQuery.error}
        onRetry={() => void ordersQuery.refetch()}
        page={page}
        onPageChange={(p) => setParam('page', String(p), false)}
        toolbar={
          <div className="flex flex-col gap-3 w-full">
            <SearchInput value={search} onChange={(value) => { setSearch(value); setParam('search', value || null); }} placeholder="Rechercher par numéro de commande..." className="w-full sm:max-w-sm" />
            <OrderStatusFilter
              value={status}
              onChange={(value) => setParam('status', value || null)}
              counts={stats ? { all: stats.totalOrders, pending: stats.pendingOrders, processing: stats.processingOrders, shipped: stats.shippedOrders, delivered: stats.deliveredOrders, cancelled: stats.cancelledOrders } : undefined}
            />
          </div>
        }
        emptyTitle={status || debouncedSearch ? 'Aucun résultat' : 'Aucune commande'}
        emptyDescription={status || debouncedSearch ? 'Aucune commande ne correspond à vos filtres.' : 'Vous n’avez pas encore reçu de commande. Elles apparaîtront ici dès qu’un client achètera vos produits.'}
      />
    </div>
  );
}

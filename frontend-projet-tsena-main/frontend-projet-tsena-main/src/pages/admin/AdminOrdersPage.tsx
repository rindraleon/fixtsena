import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTitle } from '../../hooks';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useOrders } from '../../hooks/queries/useOrders';
import { OrdersTable, OrderStatusFilter } from '../../components/orders';
import PageHeader from '../../shared/components/PageHeader';
import SearchInput from '../../shared/components/SearchInput';
import type { OrderStatus } from '../../types/api';

const PAGE_SIZE = 15;

export default function AdminOrdersPage() {
  useTitle('Commandes | Administration');
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

  const ordersQuery = useOrders({ status: status || undefined, search: debouncedSearch || undefined, page, limit: PAGE_SIZE });

  return (
    <div>
      <PageHeader title="Commandes" subtitle={ordersQuery.data ? `${ordersQuery.data.meta.total} commande${ordersQuery.data.meta.total > 1 ? 's' : ''} sur la plateforme` : 'Supervision de toutes les commandes'} />
      <OrdersTable
        role="admin"
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
            <OrderStatusFilter value={status} onChange={(value) => setParam('status', value || null)} />
          </div>
        }
        emptyTitle={status || debouncedSearch ? 'Aucun résultat' : 'Aucune commande'}
        emptyDescription={status || debouncedSearch ? 'Aucune commande ne correspond à vos filtres.' : 'Aucune commande n’a encore été passée sur la plateforme.'}
      />
    </div>
  );
}

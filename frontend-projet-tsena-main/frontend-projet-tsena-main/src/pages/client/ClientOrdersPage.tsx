import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTitle } from '../../hooks';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useOrders } from '../../hooks/queries/useOrders';
import { useAuth } from '../../context/AuthContext';
import { OrdersTable, OrderStatusFilter } from '../../components/orders';
import PageHeader from '../../shared/components/PageHeader';
import SearchInput from '../../shared/components/SearchInput';
import type { OrderStatus } from '../../types/api';

const PAGE_SIZE = 10;
const CLIENT_STATUSES: readonly OrderStatus[] = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'in_dispute', 'refunded', 'cancelled'];

export default function ClientOrdersPage() {
  useTitle('Mes commandes');
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

  const ordersQuery = useOrders({ buyerId: user?.id, status: status || undefined, search: debouncedSearch || undefined, page, limit: PAGE_SIZE }, { enabled: !!user });

  return (
    <div>
      <PageHeader title="Mes commandes" subtitle="Suivez l'état de vos commandes et consultez leur détail" />
      <OrdersTable
        role="client"
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
            <OrderStatusFilter value={status} onChange={(value) => setParam('status', value || null)} statuses={CLIENT_STATUSES} />
          </div>
        }
        emptyTitle={status || debouncedSearch ? 'Aucun résultat' : 'Aucune commande'}
        emptyDescription={status || debouncedSearch ? 'Aucune commande ne correspond à vos filtres.' : "Vous n'avez pas encore passé de commande."}
        emptyAction={status || debouncedSearch ? undefined : { label: 'Retour à la boutique', to: '/produits' }}
      />
    </div>
  );
}

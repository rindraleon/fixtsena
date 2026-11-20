import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Wallet, ShoppingBag, ShieldCheck, Truck } from 'lucide-react';
import { useTitle } from '../../hooks';
import { useOrders, useSellerOrderStats } from '../../hooks/queries/useOrders';
import { ChartCard } from '../../components/dashboard';
import { OrdersTable } from '../../components/orders';
import { ErrorState, LoadingState } from '../../components/common';
import PageHeader from '../../shared/components/PageHeader';
import StatCard from '../../shared/components/StatCard';
import { dailySeries } from '../../lib/analytics';
import { formatPrice } from '../../lib/format';

const PAGE_SIZE = 10;

export default function SellerEarningsPage() {
  useTitle('Revenus');
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const stats = useSellerOrderStats();
  const trendOrders = useOrders({ limit: 100 });
  const deliveredOrders = useOrders({ status: 'delivered', page, limit: PAGE_SIZE });

  const orderItems = trendOrders.data?.items;
  const series = useMemo(() => dailySeries(orderItems ?? [], 30), [orderItems]);
  const hasRevenue = series.some((p) => p.revenue > 0);
  const averageBasket = stats.data && stats.data.deliveredOrders > 0 ? stats.data.totalRevenue / stats.data.deliveredOrders : 0;

  return (
    <div>
      <PageHeader title="Revenus" subtitle="Chiffre d'affaires des commandes livrées et fonds libérés du séquestre" />

      {stats.isPending ? (
        <LoadingState variant="stats" count={4} className="mb-6" />
      ) : stats.isError ? (
        <ErrorState error={stats.error} onRetry={() => void stats.refetch()} compact className="mb-6" />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard title="Chiffre d'affaires" value={formatPrice(stats.data?.totalRevenue ?? 0)} icon={Wallet} color="success" index={0} />
          <StatCard title="Commandes livrées" value={stats.data?.deliveredOrders ?? 0} icon={ShieldCheck} color="primary" index={1} />
          <StatCard title="En cours d'expédition" value={stats.data?.shippedOrders ?? 0} icon={Truck} color="info" index={2} />
          <StatCard title="Panier moyen" value={formatPrice(averageBasket)} icon={ShoppingBag} color="warning" index={3} />
        </div>
      )}

      <div className="mb-6">
        <ChartCard title="Tendance des ventes (30 jours)" subtitle="Commandes confirmées, en cours ou livrées" isLoading={trendOrders.isPending} error={trendOrders.error} onRetry={() => void trendOrders.refetch()} isEmpty={!hasRevenue} emptyLabel="Aucune vente sur la période.">
          <AreaChart data={series}>
            <defs>
              <linearGradient id="sellerEarnings" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--color-muted)" interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted)" width={70} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
            <Tooltip formatter={(value) => [formatPrice(Number(value)), 'Ventes']} contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }} />
            <Area type="monotone" dataKey="revenue" stroke="var(--color-primary)" fill="url(#sellerEarnings)" strokeWidth={2} />
          </AreaChart>
        </ChartCard>
      </div>

      <section aria-labelledby="delivered-heading">
        <h3 id="delivered-heading" className="font-semibold text-text mb-3">Commandes livrées</h3>
        <OrdersTable
          role="seller"
          data={deliveredOrders.data}
          isLoading={deliveredOrders.isPending}
          isFetching={deliveredOrders.isFetching}
          error={deliveredOrders.error}
          onRetry={() => void deliveredOrders.refetch()}
          page={page}
          onPageChange={(next) => setSearchParams({ page: String(next) }, { replace: true })}
          emptyTitle="Aucune commande livrée"
          emptyDescription="Vos revenus apparaîtront ici dès qu'une commande aura été livrée et confirmée par l'acheteur."
        />
      </section>
    </div>
  );
}

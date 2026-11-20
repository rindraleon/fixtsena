import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Package, ShoppingBag, AlertCircle, Wallet, Clock, Plus, ArrowRight, Store } from 'lucide-react';
import clsx from 'clsx';
import { AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid } from 'recharts';
import { useTitle } from '../../hooks';
import { useAuth } from '../../context/AuthContext';
import { useSellerProductStats } from '../../hooks/queries/useProducts';
import { useMyShop } from '../../hooks/queries/useShops';
import { useOrders, useSellerOrderStats } from '../../hooks/queries/useOrders';
import StatCard from '../../shared/components/StatCard';
import StatusBadge from '../../shared/components/StatusBadge';
import { ChartCard } from '../../components/dashboard';
import { LoadingState, ErrorState, EmptyState, Button } from '../../components/common';
import { dailySeries, statusBreakdown } from '../../lib/analytics';
import { formatPrice, formatRelativeDate, ORDER_STATUS_LABELS } from '../../lib/format';
import { SHOP_STATUS_LABELS } from '../../types/api';

const SHOP_STATUS_TONE: Record<keyof typeof SHOP_STATUS_LABELS, string> = {
  draft: 'bg-surface-secondary text-text',
  pending_verification: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200',
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200',
  suspended: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  disabled: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  archived: 'bg-surface-secondary text-muted',
};

export default function SellerDashboardPage() {
  useTitle('Tableau de bord | Vendeur');
  const { user } = useAuth();
  const shopQuery = useMyShop();
  const shop = shopQuery.data ?? null;
  const productStats = useSellerProductStats();
  const orderStats = useSellerOrderStats();
  const recentOrders = useOrders({ sellerId: user?.id, limit: 50 }, { enabled: !!user });

  const orderItems = recentOrders.data?.items;
  const orders = orderItems ?? [];
  const series = useMemo(() => dailySeries(orderItems ?? [], 14), [orderItems]);
  const breakdown = useMemo(() => statusBreakdown(orderItems ?? [], ORDER_STATUS_LABELS), [orderItems]);
  const hasRevenue = series.some((p) => p.revenue > 0);
  const statsError = productStats.error ?? orderStats.error;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-primary">Bonjour {user?.firstName} 👋</h1>

          {shop ? (
            <p className="text-muted text-sm mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="inline-flex items-center gap-1.5 text-text font-medium"><Store size={14} aria-hidden="true" /> {shop.name}</span>
              <span className={clsx('text-[11px] font-semibold px-1.5 py-0.5 rounded-full', SHOP_STATUS_TONE[shop.status])}>{SHOP_STATUS_LABELS[shop.status]}</span>
              <Link to="/dashboard/vendeur/boutique" className="text-primary hover:underline">Gérer ma boutique</Link>
            </p>
          ) : (
            <p className="text-muted text-sm mt-1">Vue d'ensemble de votre boutique</p>
          )}
        </div>
        <Link to="/dashboard/vendeur/produits/nouveau"><Button icon={Plus} tabIndex={-1}>Ajouter un produit</Button></Link>
      </div>

      {productStats.isPending || orderStats.isPending ? (
        <LoadingState variant="stats" count={4} className="mb-8" />
      ) : statsError ? (
        <ErrorState error={statsError} onRetry={() => { void productStats.refetch(); void orderStats.refetch(); }} className="mb-8" compact />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard title="Produits" value={productStats.data?.totalProducts ?? 0} icon={Package} color="primary" index={0} />
            <StatCard title="Commandes" value={orderStats.data?.totalOrders ?? 0} icon={ShoppingBag} color="info" index={1} />
            <StatCard title="Chiffre d'affaires" value={formatPrice(orderStats.data?.totalRevenue ?? 0)} icon={Wallet} color="success" index={2} />
            <StatCard title="À confirmer" value={orderStats.data?.pendingOrders ?? 0} icon={Clock} color="warning" index={3} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <StatCard title="Produits actifs" value={productStats.data?.activeProducts ?? 0} icon={Package} color="success" index={4} />
            <StatCard title="Rupture de stock" value={productStats.data?.outOfStock ?? 0} icon={AlertCircle} color="danger" index={5} />
            <StatCard title="Stock faible" value={productStats.data?.lowStock ?? 0} icon={AlertCircle} color="warning" index={6} />
          </div>
        </>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <ChartCard title="Ventes des 14 derniers jours" subtitle="Commandes confirmées, en cours ou livrées" isLoading={recentOrders.isPending} error={recentOrders.error} onRetry={() => void recentOrders.refetch()} isEmpty={!hasRevenue} emptyLabel="Aucune vente sur la période.">
          <AreaChart data={series}>
            <defs>
              <linearGradient id="sellerRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--color-muted)" interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted)" width={70} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
            <Tooltip formatter={(value) => [formatPrice(Number(value)), 'Ventes']} contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }} />
            <Area type="monotone" dataKey="revenue" stroke="var(--color-primary)" fill="url(#sellerRevenue)" strokeWidth={2} />
          </AreaChart>
        </ChartCard>

        <ChartCard title="Commandes par statut" subtitle="Sur vos 50 dernières commandes" isLoading={recentOrders.isPending} error={recentOrders.error} onRetry={() => void recentOrders.refetch()} isEmpty={breakdown.length === 0} emptyLabel="Aucune commande pour le moment.">
          <BarChart data={breakdown}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--color-muted)" />
            <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted)" allowDecimals={false} width={30} />
            <Tooltip formatter={(value) => [value, 'Commandes']} contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }} />
            <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>
      </div>

      <section className="bg-surface rounded-xl border border-border" aria-labelledby="recent-orders-heading">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 id="recent-orders-heading" className="font-semibold text-text">Commandes récentes</h3>
          <Link to="/dashboard/vendeur/commandes" className="text-sm text-primary font-medium hover:underline inline-flex items-center gap-1">Voir tout <ArrowRight size={14} /></Link>
        </div>
        {recentOrders.isPending ? (
          <div className="p-5"><LoadingState variant="table" count={4} /></div>
        ) : recentOrders.isError ? (
          <div className="p-5"><ErrorState error={recentOrders.error} onRetry={() => void recentOrders.refetch()} compact /></div>
        ) : orders.length === 0 ? (
          <EmptyState compact icon={ShoppingBag} title="Aucune commande" description="Vos prochaines commandes apparaîtront ici." />
        ) : (
          <ul className="divide-y divide-border">
            {orders.slice(0, 5).map((order) => (
              <li key={order.id}>
                <Link to={`/dashboard/vendeur/commandes?search=${encodeURIComponent(order.orderNumber)}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-surface-secondary/60 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text font-mono">{order.orderNumber}</p>
                    <p className="text-xs text-muted">{order.lines.length} article{order.lines.length > 1 ? 's' : ''} · {formatRelativeDate(order.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-semibold text-text">{formatPrice(order.totalAmount)}</span>
                    <StatusBadge status={order.status} kind="order" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

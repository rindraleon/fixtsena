import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Users, UserCheck, Package, ShoppingBag, Wallet, Clock, ShieldCheck, Scale, ArrowRight, AlertTriangle, Percent, CreditCard, Truck, RotateCcw, Star, Trophy } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid } from 'recharts';
import { useTitle } from '../../hooks';
import { useAdminDashboard, useUsers } from '../../hooks/queries/useUsers';
import { useOrders } from '../../hooks/queries/useOrders';
import { useProducts } from '../../hooks/queries/useProducts';
import StatCard from '../../shared/components/StatCard';
import StatusBadge from '../../shared/components/StatusBadge';
import { ChartCard } from '../../components/dashboard';
import { LoadingState, ErrorState, EmptyState } from '../../components/common';
import { dailySeries, statusBreakdown } from '../../lib/analytics';
import { formatPrice, formatRelativeDate, ORDER_STATUS_LABELS, partyName } from '../../lib/format';

export default function AdminDashboardPage() {
  useTitle('Tableau de bord | Administration');
  const dashboard = useAdminDashboard();
  const recentOrders = useOrders({ limit: 100 });
  const sellerRequests = useUsers({ sellerRequested: true, limit: 1 });
  const pendingProducts = useProducts({ status: 'pending_review', limit: 1 });

  const orderItems = recentOrders.data?.items;
  const orders = orderItems ?? [];
  const series = useMemo(() => dailySeries(orderItems ?? [], 14), [orderItems]);
  const breakdown = useMemo(() => statusBreakdown(orderItems ?? [], ORDER_STATUS_LABELS), [orderItems]);
  const hasRevenue = series.some((p) => p.revenue > 0);
  const stats = dashboard.data;
  const todo = [
    { count: sellerRequests.data?.meta.total ?? 0, label: 'demande(s) de compte vendeur à traiter', to: '/dashboard/admin/vendeurs' },
    { count: pendingProducts.data?.meta.total ?? 0, label: 'produit(s) en attente de validation', to: '/dashboard/admin/produits?status=pending_review' },
    { count: stats?.disputes.open ?? 0, label: 'litige(s) ouvert(s) à arbitrer', to: '/dashboard/admin/litiges' },
  ].filter((item) => item.count > 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-primary">Tableau de bord admin</h1>
        <p className="text-muted text-sm mt-1">Vue d'ensemble de la marketplace</p>
      </div>

      {todo.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4">
          <p className="text-sm font-semibold text-text flex items-center gap-2 mb-2"><AlertTriangle size={16} className="text-amber-600" /> Actions en attente</p>
          <ul className="space-y-1">
            {todo.map((item) => (
              <li key={item.to}><Link to={item.to} className="text-sm text-text hover:text-primary inline-flex items-center gap-1"><span className="font-bold">{item.count}</span> {item.label} <ArrowRight size={13} /></Link></li>
            ))}
          </ul>
        </div>
      )}

      {dashboard.isPending ? (
        <LoadingState variant="stats" count={4} className="mb-8" />
      ) : dashboard.isError ? (
        <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} compact className="mb-8" />
      ) : stats ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard title="Utilisateurs" value={stats.users.total} icon={Users} color="primary" index={0} trend={{ value: `${stats.users.active} actifs`, positive: true }} />
            <StatCard title="Vendeurs" value={stats.users.sellers} icon={UserCheck} color="info" index={1} />
            <StatCard title="Produits" value={stats.products.total} icon={Package} color="success" index={2} trend={{ value: `${stats.products.active} en ligne`, positive: true }} />
            <StatCard title="Commandes" value={stats.orders.total} icon={ShoppingBag} color="warning" index={3} trend={{ value: `${stats.orders.last7Days} sur 7 jours`, positive: true }} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard title="Chiffre d'affaires" value={formatPrice(stats.revenue.total)} icon={Wallet} color="success" index={4} trend={{ value: `${formatPrice(stats.revenue.last7Days)} / 7 j`, positive: true }} />
            <StatCard title="Commandes en attente" value={stats.orders.pending} icon={Clock} color="warning" index={5} />
            <StatCard title="Fonds en séquestre" value={formatPrice(stats.escrow.heldAmount)} icon={ShieldCheck} color="info" index={6} />
            <StatCard title="Litiges ouverts" value={stats.disputes.open} icon={Scale} color={stats.disputes.open > 0 ? 'danger' : 'primary'} index={7} trend={stats.disputes.averageResolutionHours != null ? { value: `${stats.disputes.resolved ?? 0} résolus · ${Math.round(stats.disputes.averageResolutionHours)} h en moyenne`, positive: true } : undefined} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8" data-testid="admin-kpi-secondary">
            <StatCard title="Commissions perçues" value={formatPrice(stats.revenue.commission ?? 0)} icon={Percent} color="success" index={8} trend={{ value: `${stats.users.activeSellersLast30Days ?? 0} vendeur(s) actif(s) sur 30 j`, positive: true }} />
            <StatCard title="Taux de paiement réussi" value={stats.payments?.successRate != null ? `${Math.round(stats.payments.successRate)} %` : '—'} icon={CreditCard} color="info" index={9} trend={stats.payments ? { value: `${stats.payments.successful} / ${stats.payments.total} paiements`, positive: true } : undefined} />
            <StatCard title="Livraisons réussies" value={stats.orders.deliverySuccessRate != null ? `${Math.round(stats.orders.deliverySuccessRate)} %` : '—'} icon={Truck} color="primary" index={10} trend={{ value: `${stats.orders.inProgress ?? 0} commande(s) en cours`, positive: true }} />
            <StatCard title="Remboursements" value={formatPrice(stats.refunds?.amount ?? 0)} icon={RotateCcw} color={(stats.refunds?.count ?? 0) > 0 ? 'warning' : 'primary'} index={11} trend={{ value: `${stats.refunds?.count ?? 0} remboursement(s)`, positive: (stats.refunds?.count ?? 0) === 0 }} />
          </div>

          {stats.top && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8" data-testid="admin-top-lists">
              {[
                { title: 'Meilleurs vendeurs', icon: Trophy, items: stats.top.sellers.map((s) => ({ id: s.id, name: s.name, detail: `${s.orders} commande(s)`, value: formatPrice(s.revenue) })) },
                { title: 'Produits les plus vendus', icon: Package, items: stats.top.products.map((p) => ({ id: p.id, name: p.name, detail: `${p.quantity} unité(s)`, value: formatPrice(p.revenue) })) },
                { title: 'Catégories les plus actives', icon: ShoppingBag, items: stats.top.categories.map((c) => ({ id: c.id, name: c.name, detail: `${c.orders} commande(s)`, value: formatPrice(c.revenue) })) },
              ].map((block) => {
                const Icon = block.icon;
                return (
                  <section key={block.title} className="bg-surface rounded-xl border border-border p-4" aria-label={block.title}>
                    <h3 className="text-sm font-semibold text-text flex items-center gap-2 mb-3"><Icon size={15} className="text-primary" /> {block.title}</h3>
                    {block.items.length === 0 ? <p className="text-xs text-muted">Pas encore de données.</p> : (
                      <ol className="space-y-2">
                        {block.items.slice(0, 5).map((item, i) => (
                          <li key={item.id} className="flex items-center gap-3 text-sm">
                            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                            <span className="flex-1 min-w-0"><span className="block truncate text-text font-medium">{item.name}</span><span className="block text-[11px] text-muted">{item.detail}</span></span>
                            <span className="text-xs font-semibold text-text shrink-0">{item.value}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>
                );
              })}
              {stats.satisfaction && (
                <p className="lg:col-span-3 text-xs text-muted flex items-center gap-1.5"><Star size={12} className="text-amber-400" fill="currentColor" /> Satisfaction globale : {stats.satisfaction.averageRating != null ? `${stats.satisfaction.averageRating.toFixed(2)} / 5` : '—'} sur {stats.satisfaction.reviews} avis publiés.</p>
              )}
            </div>
          )}
        </>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <ChartCard title="Ventes des 14 derniers jours" subtitle="Commandes confirmées, en cours ou livrées (100 dernières commandes)" isLoading={recentOrders.isPending} error={recentOrders.error} onRetry={() => void recentOrders.refetch()} isEmpty={!hasRevenue} emptyLabel="Aucune vente sur la période.">
          <AreaChart data={series}>
            <defs>
              <linearGradient id="adminRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--color-muted)" interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted)" width={70} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
            <Tooltip formatter={(value) => [formatPrice(Number(value)), 'Ventes']} contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }} />
            <Area type="monotone" dataKey="revenue" stroke="var(--color-primary)" fill="url(#adminRevenue)" strokeWidth={2} />
          </AreaChart>
        </ChartCard>
        <ChartCard title="Commandes par statut" subtitle="Sur les 100 dernières commandes" isLoading={recentOrders.isPending} error={recentOrders.error} onRetry={() => void recentOrders.refetch()} isEmpty={breakdown.length === 0} emptyLabel="Aucune commande pour le moment.">
          <BarChart data={breakdown}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--color-muted)" />
            <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted)" allowDecimals={false} width={30} />
            <Tooltip formatter={(value) => [value, 'Commandes']} contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }} />
            <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>
      </div>

      <section className="bg-surface rounded-xl border border-border" aria-labelledby="admin-recent-orders">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 id="admin-recent-orders" className="font-semibold text-text">Commandes récentes</h3>
          <Link to="/dashboard/admin/commandes" className="text-sm text-primary font-medium hover:underline inline-flex items-center gap-1">Voir tout <ArrowRight size={14} /></Link>
        </div>
        {recentOrders.isPending ? (
          <div className="p-5"><LoadingState variant="table" count={5} /></div>
        ) : recentOrders.isError ? (
          <div className="p-5"><ErrorState error={recentOrders.error} onRetry={() => void recentOrders.refetch()} compact /></div>
        ) : orders.length === 0 ? (
          <EmptyState compact icon={ShoppingBag} title="Aucune commande" description="Les commandes de la plateforme apparaîtront ici." />
        ) : (
          <ul className="divide-y divide-border">
            {orders.slice(0, 6).map((order) => (
              <li key={order.id}>
                <Link to={`/dashboard/admin/commandes?search=${encodeURIComponent(order.orderNumber)}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-surface-secondary/60 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text font-mono">{order.orderNumber}</p>
                    <p className="text-xs text-muted truncate">{partyName(order.buyer)} → {partyName(order.seller)} · {formatRelativeDate(order.createdAt)}</p>
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

import { Link } from 'react-router-dom';
import { ShoppingBag, Clock, CheckCircle, Wallet, Heart, ArrowRight, Store, MailWarning } from 'lucide-react';
import { useTitle } from '../../hooks';
import { useAuth } from '../../context/AuthContext';
import { hasAppRole } from '../../shared/data/permissions';
import { useFavorites } from '../../context/FavoritesContext';
import { useBuyerOrderStats, useOrders } from '../../hooks/queries/useOrders';
import StatCard from '../../shared/components/StatCard';
import StatusBadge from '../../shared/components/StatusBadge';
import { Button, EmptyState, ErrorState, LoadingState } from '../../components/common';
import { formatPrice, formatRelativeDate } from '../../lib/format';

export default function ClientDashboardPage() {
  useTitle('Tableau de bord | Client');
  const { user } = useAuth();
  const { favorites } = useFavorites();
  const stats = useBuyerOrderStats();
  const recentOrders = useOrders({ buyerId: user?.id, limit: 5 }, { enabled: !!user });
  const orders = recentOrders.data?.items ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-primary">Bon retour, {user?.firstName} !</h1>
        <p className="text-muted text-sm mt-1">Voici un résumé de votre compte aujourd'hui.</p>
      </div>

      {user && !user.emailVerified && (
        <div className="mb-6 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <MailWarning size={20} className="text-amber-600 shrink-0" />
          <p className="text-sm text-text flex-1">Votre adresse e-mail n'est pas encore vérifiée. Confirmez-la pour sécuriser votre compte.</p>
          <Link to="/dashboard/client/profil"><Button size="sm" variant="outline" tabIndex={-1}>Gérer</Button></Link>
        </div>
      )}

      {stats.isPending ? (
        <LoadingState variant="stats" count={4} className="mb-8" />
      ) : stats.isError ? (
        <ErrorState error={stats.error} onRetry={() => void stats.refetch()} compact className="mb-8" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard title="Total commandes" value={stats.data.totalOrders} icon={ShoppingBag} color="primary" index={0} />
          <StatCard title="En cours" value={stats.data.activeOrders} icon={Clock} color="warning" index={1} />
          <StatCard title="Livrées" value={stats.data.deliveredOrders} icon={CheckCircle} color="success" index={2} />
          <StatCard title="Total dépensé" value={formatPrice(stats.data.totalSpent)} icon={Wallet} color="info" index={3} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 bg-surface rounded-xl border border-border" aria-labelledby="recent-orders">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h3 id="recent-orders" className="font-semibold text-text">Commandes récentes</h3>
            <Link to="/dashboard/client/mes-commandes" className="text-sm text-primary font-medium hover:underline inline-flex items-center gap-1">Voir tout <ArrowRight size={14} /></Link>
          </div>
          {recentOrders.isPending ? (
            <div className="p-5"><LoadingState variant="table" count={4} /></div>
          ) : recentOrders.isError ? (
            <div className="p-5"><ErrorState error={recentOrders.error} onRetry={() => void recentOrders.refetch()} compact /></div>
          ) : orders.length === 0 ? (
            <EmptyState compact icon={ShoppingBag} title="Aucune commande" description="Vous n'avez pas encore passé de commande." action={{ label: 'Découvrir la boutique', to: '/produits' }} />
          ) : (
            <ul className="divide-y divide-border">
              {orders.map((order) => (
                <li key={order.id}>
                  <Link to={`/dashboard/client/mes-commandes?search=${encodeURIComponent(order.orderNumber)}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-surface-secondary/60 transition-colors">
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

        <div className="space-y-4">
          <section className="bg-surface rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-text flex items-center gap-2"><Heart size={16} className="text-primary" /> Mes favoris</h3>
              <span className="text-2xl font-bold text-primary">{favorites.length}</span>
            </div>
            <p className="text-xs text-muted mb-3">{favorites.length === 0 ? 'Ajoutez des produits à vos favoris pour les retrouver facilement.' : 'Retrouvez les produits que vous avez aimés.'}</p>
            <Link to="/dashboard/client/mes-favoris" className="text-sm text-primary font-medium hover:underline inline-flex items-center gap-1">Voir mes favoris <ArrowRight size={14} /></Link>
          </section>

          {user && !hasAppRole(user.roles, 'seller') && !hasAppRole(user.roles, 'admin') && (
            <section className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/10 p-5">
              <h3 className="font-semibold text-text flex items-center gap-2"><Store size={16} className="text-primary" /> Vendre sur Tsena</h3>
              <p className="text-xs text-muted mt-1 mb-3">
                {user.sellerRequestedAt ? 'Votre demande de boutique est en cours de validation.' : 'Ouvrez votre boutique et vendez vos produits à des milliers de clients.'}
              </p>
              {!user.sellerRequestedAt && (
                <Link to="/dashboard/client/profil"><Button size="sm" variant="secondary" tabIndex={-1}>Devenir vendeur</Button></Link>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

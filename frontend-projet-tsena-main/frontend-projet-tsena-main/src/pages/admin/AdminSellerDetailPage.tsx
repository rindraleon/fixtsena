import { Link, useParams } from 'react-router-dom';
import { Mail, Phone, Package, ShoppingBag, Star, Ban, CheckCircle2, UserCheck, Calendar, ArrowRight } from 'lucide-react';
import { useTitle } from '../../hooks';
import { useUser } from '../../hooks/queries/useUsers';
import { useProducts } from '../../hooks/queries/useProducts';
import { useOrders } from '../../hooks/queries/useOrders';
import { useReviews, useUserReviewAverage } from '../../hooks/queries/useReviews';
import { useActivateUser, useApproveSeller, useSuspendUser } from '../../hooks/mutations/useUserMutations';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import { Button, ConfirmDialog, EmptyState, ErrorState, LoadingState } from '../../components/common';
import { ReviewCard, StarRating } from '../../components/reviews';
import PageHeader from '../../shared/components/PageHeader';
import StatCard from '../../shared/components/StatCard';
import StatusBadge from '../../shared/components/StatusBadge';
import { formatDate, formatPrice, primaryImageUrl, roleLabels } from '../../lib/format';
import { isNotFoundError } from '../../lib/api-error';
import { resolveMediaUrl } from '../../lib/media';

const BACK = '/dashboard/admin/vendeurs';
type SellerAction = 'suspend' | 'activate' | 'approve';

export default function AdminSellerDetailPage() {
  const { id } = useParams<{ id: string }>();
  useTitle('Profil vendeur | Administration');
  const userQuery = useUser(id);
  const user = userQuery.data;
  const isSeller = !!user?.roles.includes('seller');
  const productsQuery = useProducts({ sellerId: id, limit: 6, sortBy: 'updatedAt', order: 'DESC' }, { enabled: !!id && isSeller });
  const ordersQuery = useOrders({ sellerId: id, limit: 5 }, { enabled: !!id && isSeller });
  const reviewsQuery = useReviews({ reviewedId: id, limit: 5 }, { enabled: !!id && isSeller });
  const averageQuery = useUserReviewAverage(isSeller ? id : undefined);
  const suspendUser = useSuspendUser();
  const activateUser = useActivateUser();
  const approveSeller = useApproveSeller();
  const confirm = useConfirmAction<SellerAction>();
  const pending = suspendUser.isPending || activateUser.isPending || approveSeller.isPending;

  if (userQuery.isPending) return <LoadingState variant="detail" label="Chargement du profil..." />;
  if (userQuery.isError) {
    return isNotFoundError(userQuery.error)
      ? <EmptyState title="Utilisateur introuvable" description="Ce compte n'existe pas ou a été supprimé." action={{ label: 'Retour aux vendeurs', to: BACK }} />
      : <ErrorState error={userQuery.error} onRetry={() => void userQuery.refetch()} retrying={userQuery.isFetching} />;
  }
  if (!user) return null;

  const dialog: Record<SellerAction, { title: string; description: string; confirmLabel: string; loadingLabel: string; variant: 'default' | 'destructive' }> = {
    suspend: { title: 'Suspendre ce compte ?', description: `${user.firstName} ne pourra plus se connecter ni vendre tant que le compte est suspendu.`, confirmLabel: 'Suspendre', loadingLabel: 'Suspension...', variant: 'destructive' },
    activate: { title: 'Réactiver ce compte ?', description: `${user.firstName} pourra de nouveau se connecter et vendre.`, confirmLabel: 'Réactiver', loadingLabel: 'Activation...', variant: 'default' },
    approve: { title: 'Approuver ce vendeur ?', description: `${user.firstName} obtiendra le rôle vendeur et pourra publier des produits.`, confirmLabel: 'Approuver', loadingLabel: 'Approbation...', variant: 'default' },
  };
  const runAction = (action: SellerAction) => action === 'suspend' ? suspendUser.mutateAsync({ id: user.id, reason: 'Suspension administrative' }) : action === 'activate' ? activateUser.mutateAsync(user.id) : approveSeller.mutateAsync(user.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${user.firstName} ${user.lastName ?? ''}`}
        subtitle={roleLabels(user.roles).join(' · ')}
        breadcrumb={[{ label: 'Vendeurs', href: BACK }, { label: 'Profil' }]}
        actions={
          <div className="flex gap-2">
            {!isSeller && user.sellerRequestedAt && <Button icon={UserCheck} onClick={() => confirm.request('approve')} disabled={pending}>Approuver comme vendeur</Button>}
            {user.status === 'suspended'
              ? <Button variant="outline" icon={CheckCircle2} onClick={() => confirm.request('activate')} disabled={pending}>Réactiver</Button>
              : <Button variant="danger" icon={Ban} onClick={() => confirm.request('suspend')} disabled={pending}>Suspendre</Button>}
          </div>
        }
      />

      <section className="bg-surface rounded-xl border border-border p-6 flex flex-col sm:flex-row gap-5">
        <div className="w-20 h-20 rounded-2xl bg-primary text-white flex items-center justify-center text-2xl font-bold shrink-0 overflow-hidden">
          {user.avatarUrl ? <img src={resolveMediaUrl(user.avatarUrl)} alt="" className="w-full h-full object-cover" /> : `${user.firstName[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()}
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm flex-1">
          <div className="flex items-center gap-2"><dt className="sr-only">Email</dt><Mail size={14} className="text-muted" /><dd className="text-text truncate">{user.email}</dd>{!user.emailVerified && <span className="text-[10px] text-amber-600">non vérifié</span>}</div>
          <div className="flex items-center gap-2"><dt className="sr-only">Téléphone</dt><Phone size={14} className="text-muted" /><dd className="text-text">{user.phone || '—'}</dd></div>
          <div className="flex items-center gap-2"><dt className="sr-only">Inscription</dt><Calendar size={14} className="text-muted" /><dd className="text-text">Inscrit le {formatDate(user.createdAt)}</dd></div>
          <div className="flex items-center gap-2"><dt className="text-muted">Statut :</dt><dd><StatusBadge status={user.status} kind="account" /></dd></div>
          {user.sellerRequestedAt && !isSeller && <div className="sm:col-span-2 text-amber-700 dark:text-amber-400">Demande de compte vendeur envoyée le {formatDate(user.sellerRequestedAt)} — en attente d'approbation.</div>}
        </dl>
      </section>

      {!isSeller ? (
        <EmptyState icon={Package} title="Pas encore vendeur" description="Ce compte n'a pas le rôle vendeur : aucune boutique, produit ou vente à afficher." />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard title="Produits" value={productsQuery.data?.meta.total ?? '—'} icon={Package} color="primary" index={0} />
            <StatCard title="Commandes reçues" value={ordersQuery.data?.meta.total ?? '—'} icon={ShoppingBag} color="info" index={1} />
            <StatCard title="Note moyenne" value={averageQuery.data && averageQuery.data.reviewCount > 0 ? `${averageQuery.data.averageRating.toFixed(1)} / 5` : '—'} icon={Star} color="warning" index={2} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="bg-surface rounded-xl border border-border" aria-labelledby="seller-products">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <h3 id="seller-products" className="font-semibold text-text">Derniers produits</h3>
                <Link to={`/dashboard/admin/produits?sellerId=${user.id}`} className="text-sm text-primary font-medium hover:underline inline-flex items-center gap-1">Tout voir <ArrowRight size={14} /></Link>
              </div>
              {productsQuery.isPending ? <div className="p-5"><LoadingState variant="table" count={3} /></div>
                : productsQuery.isError ? <div className="p-5"><ErrorState error={productsQuery.error} onRetry={() => void productsQuery.refetch()} compact /></div>
                : (productsQuery.data?.items.length ?? 0) === 0 ? <EmptyState compact icon={Package} title="Aucun produit" />
                : (
                  <ul className="divide-y divide-border">
                    {productsQuery.data?.items.map((product) => {
                      const image = primaryImageUrl(product);
                      return (
                        <li key={product.id}>
                          <Link to={`/dashboard/admin/produits/${product.id}/modifier`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-secondary/60 transition-colors">
                            <div className="w-10 h-10 rounded-lg bg-surface-secondary overflow-hidden shrink-0">{image && <img src={image} alt="" className="w-full h-full object-cover" />}</div>
                            <div className="min-w-0 flex-1"><p className="text-sm font-medium text-text truncate">{product.name}</p><p className="text-xs text-muted">{formatPrice(product.price)} · stock {product.stockQuantity}</p></div>
                            <StatusBadge status={product.status} kind="product" />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
            </section>

            <section className="bg-surface rounded-xl border border-border" aria-labelledby="seller-orders">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <h3 id="seller-orders" className="font-semibold text-text">Dernières commandes</h3>
                <Link to="/dashboard/admin/commandes" className="text-sm text-primary font-medium hover:underline inline-flex items-center gap-1">Tout voir <ArrowRight size={14} /></Link>
              </div>
              {ordersQuery.isPending ? <div className="p-5"><LoadingState variant="table" count={3} /></div>
                : ordersQuery.isError ? <div className="p-5"><ErrorState error={ordersQuery.error} onRetry={() => void ordersQuery.refetch()} compact /></div>
                : (ordersQuery.data?.items.length ?? 0) === 0 ? <EmptyState compact icon={ShoppingBag} title="Aucune commande" />
                : (
                  <ul className="divide-y divide-border">
                    {ordersQuery.data?.items.map((order) => (
                      <li key={order.id} className="flex items-center justify-between gap-3 px-5 py-3">
                        <div className="min-w-0"><p className="text-sm font-medium text-text font-mono">{order.orderNumber}</p><p className="text-xs text-muted">{formatDate(order.createdAt)}</p></div>
                        <div className="flex items-center gap-3"><span className="text-sm font-semibold">{formatPrice(order.totalAmount)}</span><StatusBadge status={order.status} kind="order" /></div>
                      </li>
                    ))}
                  </ul>
                )}
            </section>
          </div>

          <section aria-labelledby="seller-reviews">
            <div className="flex items-center justify-between mb-3">
              <h3 id="seller-reviews" className="font-semibold text-text flex items-center gap-2">Derniers avis reçus {averageQuery.data && averageQuery.data.reviewCount > 0 && <StarRating value={Math.round(averageQuery.data.averageRating)} size={14} />}</h3>
            </div>
            {reviewsQuery.isPending ? <LoadingState variant="list" count={2} />
              : reviewsQuery.isError ? <ErrorState error={reviewsQuery.error} onRetry={() => void reviewsQuery.refetch()} compact />
              : (reviewsQuery.data?.items.length ?? 0) === 0 ? <EmptyState compact icon={Star} title="Aucun avis" description="Ce vendeur n'a pas encore reçu d'avis." />
              : <div className="space-y-3">{reviewsQuery.data?.items.map((review) => <ReviewCard key={review.id} review={review} person={review.reviewer} personRole="Client" />)}</div>}
          </section>
        </>
      )}

      <ConfirmDialog
        open={confirm.isOpen}
        variant={confirm.target ? dialog[confirm.target].variant : 'default'}
        title={confirm.target ? dialog[confirm.target].title : ''}
        description={confirm.target ? dialog[confirm.target].description : undefined}
        confirmLabel={confirm.target ? dialog[confirm.target].confirmLabel : undefined}
        loadingLabel={confirm.target ? dialog[confirm.target].loadingLabel : undefined}
        loading={pending}
        onConfirm={() => void confirm.run(runAction)}
        onCancel={confirm.cancel}
      />
    </div>
  );
}

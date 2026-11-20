import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { BadgeCheck, CalendarDays, MapPin, Package, ShieldCheck, Star, Store, Truck, Users } from 'lucide-react';
import { useTitle } from '../../hooks';
import { useShop } from '../../hooks/queries/useShops';
import { useProducts } from '../../hooks/queries/useProducts';
import { useReviews } from '../../hooks/queries/useReviews';
import ProductCard from '../../components/product/ProductCard';
import MediaImage from '../../components/common/MediaImage';
import { ShopLevelBadge, FollowShopButton, ContactSellerButton } from '../../components/shops';
import { ReviewCard, StarRating } from '../../components/reviews';
import { EmptyState, ErrorState, LoadingState, Pagination } from '../../components/common';
import { formatDate } from '../../lib/format';
import { isNotFoundError } from '../../lib/api-error';
import type { ProductFilters } from '../../types/api';

const PAGE_SIZE = 12;

export default function ShopPage() {
  const { slug = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const shopQuery = useShop(slug);
  const shop = shopQuery.data;

  useTitle(shop ? `${shop.name} — Boutique` : 'Boutique', {
    description: shop?.description ?? 'Découvrez les produits de cette boutique sur Tsena.',
  });

  const productFilters = useMemo<ProductFilters>(
    () => ({ sellerId: shop?.ownerId, page, limit: PAGE_SIZE, sortBy: 'createdAt', order: 'DESC' }),
    [shop?.ownerId, page],
  );
  const productsQuery = useProducts(productFilters, { enabled: !!shop });
  const reviewsQuery = useReviews({ reviewedId: shop?.ownerId, limit: 3 }, { enabled: !!shop });

  if (shopQuery.isPending) return <LoadingState variant="page" label="Chargement de la boutique..." />;
  if (shopQuery.isError || !shop) {
    const notFound = isNotFoundError(shopQuery.error);
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        {notFound ? (
          <EmptyState icon={Store} titleAs="h1" title="Boutique introuvable" description="Cette boutique n'existe pas, n'est pas encore active ou a été suspendue." action={{ label: 'Voir toutes les boutiques', to: '/boutiques' }} />
        ) : (
          <ErrorState error={shopQuery.error} onRetry={() => void shopQuery.refetch()} retrying={shopQuery.isFetching} />
        )}
      </div>
    );
  }

  const products = productsQuery.data?.items ?? [];
  const meta = productsQuery.data?.meta;
  const featured = shop.featuredProductIds?.length ? products.filter((p) => shop.featuredProductIds?.includes(p.id)) : [];

  return (
    <div className="pb-16">
      <div className="relative h-44 sm:h-60 bg-gradient-to-r from-primary via-primary/90 to-primary-dark overflow-hidden">
        {shop.coverUrl && <MediaImage src={shop.coverUrl} alt="" className="w-full h-full object-cover" fallback={null} data-testid="shop-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" aria-hidden="true" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <section className="relative -mt-12 sm:-mt-16 bg-surface rounded-2xl border border-border shadow-lg p-5 sm:p-6" aria-labelledby="shop-title">
          <div className="flex flex-col md:flex-row md:items-start gap-5">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-surface border-4 border-surface shadow-md flex items-center justify-center overflow-hidden text-primary -mt-14 sm:-mt-16 shrink-0" data-testid="shop-logo">
              {shop.logoUrl ? <MediaImage src={shop.logoUrl} alt={`Logo ${shop.name}`} className="w-full h-full object-cover" fallback={<Store size={36} />} /> : <Store size={36} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 id="shop-title" className="text-2xl sm:text-3xl font-bold text-text">{shop.name}</h1>
                <ShopLevelBadge level={shop.level} label={shop.levelLabel} size="sm" />
                {shop.identityVerified && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300" title="Identité du vendeur vérifiée par Tsena"><BadgeCheck size={14} /> Identité vérifiée</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted">
                {shop.location && <span className="inline-flex items-center gap-1"><MapPin size={14} /> {shop.location}</span>}
                <span className="inline-flex items-center gap-1"><CalendarDays size={14} /> Depuis {formatDate(shop.createdAt, { month: 'long', year: 'numeric' })}</span>
              </div>
              {shop.description && <p className="text-sm text-text/90 mt-3 max-w-3xl whitespace-pre-line">{shop.description}</p>}
            </div>
            <div className="flex flex-col gap-2 md:items-end shrink-0">
              <FollowShopButton shop={shop} />
              <ContactSellerButton sellerId={shop.ownerId} shopId={shop.id} subjectHint={shop.name} size="sm" variant="ghost" />
            </div>
          </div>

          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            {[
              { icon: Package, label: 'Produits en ligne', value: String(shop.productsCount) },
              { icon: Users, label: 'Abonnés', value: String(shop.followersCount), testId: 'shop-followers-count' },
              { icon: Star, label: 'Note moyenne', value: shop.reviewsCount > 0 ? `${shop.averageRating.toFixed(1)} / 5` : '—' },
              { icon: ShieldCheck, label: 'Avis reçus', value: String(shop.reviewsCount) },
            ].map(({ icon: Icon, label, value, testId }) => (
              <div key={label} className="rounded-xl bg-surface-secondary/60 p-3">
                <dt className="text-[11px] uppercase tracking-wide text-muted flex items-center gap-1"><Icon size={12} /> {label}</dt>
                <dd className="text-lg font-bold text-text mt-0.5" data-testid={testId}>{value}</dd>
              </div>
            ))}
          </dl>

          {shop.deliveryConditions && (
            <div className="mt-4 flex items-start gap-2 text-sm text-muted bg-primary/5 border border-primary/10 rounded-xl p-3">
              <Truck size={16} className="text-primary shrink-0 mt-0.5" />
              <p><span className="font-medium text-text">Conditions de livraison :</span> {shop.deliveryConditions}</p>
            </div>
          )}
        </section>

        {featured.length > 0 && page === 1 && (
          <section className="mt-10" aria-labelledby="featured-heading">
            <h2 id="featured-heading" className="text-xl font-bold text-text mb-4">Sélection de la boutique</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {featured.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}
            </div>
          </section>
        )}

        <section className="mt-10" aria-labelledby="catalogue-heading">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 id="catalogue-heading" className="text-xl font-bold text-text">Tous les produits{meta ? ` (${meta.total})` : ''}</h2>
            <Link to={`/produits?sellerId=${shop.ownerId}`} className="text-sm text-primary hover:underline">Rechercher dans la boutique</Link>
          </div>
          {productsQuery.isPending ? (
            <LoadingState variant="cards" count={8} />
          ) : productsQuery.isError ? (
            <ErrorState error={productsQuery.error} onRetry={() => void productsQuery.refetch()} retrying={productsQuery.isFetching} />
          ) : products.length === 0 ? (
            <EmptyState icon={Package} title="Aucun produit en ligne" description="Cette boutique n'a pas encore publié de produit. Abonnez-vous pour être prévenu des nouveautés." compact />
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {products.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}
              </div>
              {meta && meta.totalPages > 1 && (
                <Pagination currentPage={page} totalPages={meta.totalPages} onPageChange={(p) => setSearchParams({ page: String(p) }, { replace: true })} />
              )}
            </>
          )}
        </section>

        <section className="mt-10" aria-labelledby="reviews-heading">
          <h2 id="reviews-heading" className="text-xl font-bold text-text mb-4 flex items-center gap-2">Derniers avis {shop.reviewsCount > 0 && <span className="inline-flex items-center gap-1 text-sm font-normal text-muted"><StarRating value={Math.round(shop.averageRating)} size={14} /> {shop.averageRating.toFixed(1)}</span>}</h2>
          {reviewsQuery.isPending ? (
            <LoadingState variant="list" count={2} />
          ) : reviewsQuery.isError ? (
            <ErrorState error={reviewsQuery.error} onRetry={() => void reviewsQuery.refetch()} retrying={reviewsQuery.isFetching} compact />
          ) : (reviewsQuery.data?.items.length ?? 0) === 0 ? (
            <p className="text-sm text-muted">Aucun avis publié pour le moment.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              {reviewsQuery.data?.items.map((review) => <ReviewCard key={review.id} review={review} person={review.reviewer} personRole="Acheteur" />)}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

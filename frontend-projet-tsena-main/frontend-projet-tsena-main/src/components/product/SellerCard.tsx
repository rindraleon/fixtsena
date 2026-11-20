import { Link } from 'react-router-dom';
import { Store, Award, Calendar, ArrowUpRight, Users, MapPin } from 'lucide-react';
import { useUserBadges } from '../../hooks/queries/useBadges';
import ProductRating from './ProductRating';
import { formatDate, partyName } from '../../lib/format';
import type { ApiProduct, ProductSellerSummary, ProductShopSummary } from '../../types/api';
import { resolveMediaUrl } from '../../lib/media';
import ShopLevelBadge from '../shops/ShopLevelBadge';
import FollowShopButton from '../shops/FollowShopButton';
import ContactSellerButton from '../shops/ContactSellerButton';
import MediaImage from '../common/MediaImage';

interface SellerCardProps {
  readonly seller: ProductSellerSummary;
  readonly shop?: ProductShopSummary | null;
  readonly product?: Pick<ApiProduct, 'id' | 'name'>;
}

export default function SellerCard({ seller, shop, product }: SellerCardProps) {
  const badges = useUserBadges(seller.id);
  const activeBadges = (badges.data ?? []).filter((ub) => ub.badge && ub.isActive);

  return (
    <section className="rounded-xl border border-border bg-surface-secondary/50 p-4" aria-label="Informations sur le vendeur" data-testid="seller-card">
      {shop && (
        <div className="flex items-center gap-3 pb-3 mb-3 border-b border-border/70">
          <Link to={`/boutiques/${shop.slug}`} className="w-11 h-11 rounded-lg bg-surface border border-border flex items-center justify-center shrink-0 overflow-hidden text-primary" aria-label={`Boutique ${shop.name}`}>
            {shop.logoUrl ? <MediaImage src={shop.logoUrl} alt="" className="w-full h-full object-cover" fallback={<Store size={18} />} /> : <Store size={18} />}
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wide text-muted">Boutique</p>
            <div className="flex flex-wrap items-center gap-2">
              <Link to={`/boutiques/${shop.slug}`} className="font-semibold text-text hover:text-primary transition-colors truncate inline-flex items-center gap-1" data-testid="product-shop-link">
                {shop.name} <ArrowUpRight size={13} className="text-muted" aria-hidden="true" />
              </Link>
              <ShopLevelBadge level={shop.level} label={shop.levelLabel} />
            </div>
            {shop.city && (
              <Link
                to={`/produits?city=${encodeURIComponent(shop.city)}`}
                className="inline-flex items-center gap-1 text-xs text-muted hover:text-primary transition-colors mt-0.5"
                title={`Voir tous les produits vendus depuis ${shop.city}`}
              >
                <MapPin size={11} aria-hidden="true" /> {shop.city}
              </Link>
            )}
          </div>
        </div>
      )}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 overflow-hidden">
          {seller.avatarUrl ? <img src={resolveMediaUrl(seller.avatarUrl)} alt="" className="w-full h-full object-cover" /> : <Store size={20} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-muted">Vendu par</p>
          <p className="font-semibold text-text truncate">{partyName(seller)}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5 text-xs text-muted">
            {seller.reviewCount > 0 ? (
              <span className="inline-flex items-center gap-1"><ProductRating rating={seller.reputationScore} size={12} /> {seller.reputationScore.toFixed(1)} ({seller.reviewCount} avis)</span>
            ) : (
              <span>Aucun avis pour le moment</span>
            )}
            <span className="inline-flex items-center gap-1"><Calendar size={11} /> Membre depuis {formatDate(seller.memberSince)}</span>
          </div>
        </div>
      </div>
      {activeBadges.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 mt-3" aria-label="Badges du vendeur">
          {activeBadges.map((ub) => (
            <li key={ub.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/20 text-primary text-[11px] font-medium" title={ub.badge?.description ?? undefined}>
              {ub.badge?.iconUrl ? <img src={resolveMediaUrl(ub.badge.iconUrl)} alt="" className="w-3 h-3" /> : <Award size={11} />} {ub.badge?.name}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col sm:flex-row gap-2 mt-4">
        {shop && shop.status === 'active' && (
          <FollowShopButton shop={{ id: shop.id, slug: shop.slug, status: shop.status, ownerId: seller.id }} size="sm" />
        )}
        <ContactSellerButton sellerId={seller.id} productId={product?.id} shopId={shop?.id} subjectHint={product?.name} size="sm" />
        {shop && shop.status !== 'active' && (
          <span className="text-xs text-muted inline-flex items-center gap-1 self-center"><Users size={12} /> Boutique temporairement indisponible</span>
        )}
      </div>
    </section>
  );
}

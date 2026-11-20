import { Link } from 'react-router-dom';
import { MapPin, Package, Star, Store, Users } from 'lucide-react';
import ShopLevelBadge from './ShopLevelBadge';
import MediaImage from '../common/MediaImage';
import type { ApiShop } from '../../types/api';

interface ShopCardProps {
  readonly shop: ApiShop;
}

export default function ShopCard({ shop }: ShopCardProps) {
  const href = `/boutiques/${shop.slug}`;
  return (
    <article className="bg-surface rounded-2xl border border-border overflow-hidden flex flex-col group hover:shadow-lg transition-shadow" data-testid="shop-card">
      <Link to={href} className="block h-24 bg-gradient-to-r from-primary/80 to-primary relative" aria-label={`Voir la boutique ${shop.name}`}>
        {shop.coverUrl && <MediaImage src={shop.coverUrl} alt="" className="w-full h-full object-cover" fallback={null} />}
        <div className="absolute -bottom-6 left-4 w-14 h-14 rounded-xl bg-surface border-2 border-surface shadow flex items-center justify-center overflow-hidden text-primary">
          {shop.logoUrl ? <MediaImage src={shop.logoUrl} alt="" className="w-full h-full object-cover" fallback={<Store size={22} />} /> : <Store size={22} />}
        </div>
      </Link>
      <div className="p-4 pt-8 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2">
          <Link to={href} className="font-semibold text-text group-hover:text-primary transition-colors line-clamp-1">{shop.name}</Link>
          <ShopLevelBadge level={shop.level} label={shop.levelLabel} />
        </div>
        {shop.location && <p className="text-xs text-muted flex items-center gap-1 mt-1"><MapPin size={11} /> {shop.location}</p>}
        {shop.description && <p className="text-sm text-muted line-clamp-2 mt-2">{shop.description}</p>}
        <dl className="grid grid-cols-3 gap-2 mt-auto pt-4 text-center">
          <div className="rounded-lg bg-surface-secondary/60 py-2">
            <dt className="sr-only">Produits</dt>
            <dd className="text-sm font-bold text-text flex items-center justify-center gap-1"><Package size={12} className="text-primary" /> {shop.productsCount}</dd>
          </div>
          <div className="rounded-lg bg-surface-secondary/60 py-2">
            <dt className="sr-only">Abonnés</dt>
            <dd className="text-sm font-bold text-text flex items-center justify-center gap-1"><Users size={12} className="text-primary" /> {shop.followersCount}</dd>
          </div>
          <div className="rounded-lg bg-surface-secondary/60 py-2">
            <dt className="sr-only">Note moyenne</dt>
            <dd className="text-sm font-bold text-text flex items-center justify-center gap-1"><Star size={12} className="text-amber-500" /> {shop.reviewsCount > 0 ? shop.averageRating.toFixed(1) : '—'}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
}

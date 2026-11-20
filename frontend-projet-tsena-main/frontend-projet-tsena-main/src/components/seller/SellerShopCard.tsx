import { Link } from 'react-router-dom';
import { ArrowRight, MapPin, Store } from 'lucide-react';
import { useMyShop } from '../../hooks/queries/useShops';
import { ShopLevelBadge } from '../shops';
import { ShopRequiredNotice } from '../../guards/SellerShopRoute';
import { SHOP_STATUS_LABELS, type ShopStatus } from '../../types/api';
import { resolveMediaUrl } from '../../lib/media';

const STATUS_TONE: Record<ShopStatus, string> = {
  draft: 'bg-surface-secondary text-text',
  pending_verification: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200',
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200',
  suspended: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  disabled: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  archived: 'bg-surface-secondary text-muted',
};

export default function SellerShopCard() {
  const shopQuery = useMyShop();
  if (shopQuery.isPending || shopQuery.isError) return null;

  const shop = shopQuery.data;
  if (!shop) return <ShopRequiredNotice compact />;

  return (
    <section className="bg-surface rounded-xl border border-border p-5" aria-labelledby="seller-shop-heading" data-testid="seller-shop-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 overflow-hidden" aria-hidden="true">
            {shop.logoUrl ? <img src={resolveMediaUrl(shop.logoUrl)} alt="" className="w-full h-full object-cover" /> : <Store size={20} />}
          </span>
          <div className="min-w-0">
            <h2 id="seller-shop-heading" className="font-semibold text-text truncate">{shop.name}</h2>
            <p className="text-xs text-muted truncate flex items-center gap-1.5">
              {shop.city && (
                <>
                  <MapPin size={11} aria-hidden="true" />
                  <span className="truncate">{shop.city}</span>
                  <span aria-hidden="true">·</span>
                </>
              )}
              <span className="truncate">/{shop.slug}</span>
            </p>
          </div>
        </div>
        <Link to="/dashboard/vendeur/boutique" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline shrink-0">
          Gérer <ArrowRight size={13} aria-hidden="true" />
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_TONE[shop.status]}`}>{SHOP_STATUS_LABELS[shop.status]}</span>
        <ShopLevelBadge level={shop.level} label={shop.levelLabel} />
        {typeof shop.productsCount === 'number' && (
          <span className="text-[11px] text-muted">{shop.productsCount} produit{shop.productsCount > 1 ? 's' : ''} en ligne</span>
        )}
      </div>
    </section>
  );
}

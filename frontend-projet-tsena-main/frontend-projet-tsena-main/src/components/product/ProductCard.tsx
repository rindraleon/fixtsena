import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ImageOff, Megaphone, Star, Store } from 'lucide-react';
import ProductPrice from './ProductPrice';
import ProductCardCartControl from './ProductCardCartControl';
import FavoriteButton from './FavoriteButton';
import MediaImage from '../common/MediaImage';
import { discountPercent, primaryImageUrl } from '../../lib/format';
import ShopLevelBadge from '../shops/ShopLevelBadge';
import type { ApiProduct } from '../../types/api';

interface ProductCardProps {
  readonly product: ApiProduct;
  readonly index?: number;
  readonly showSummary?: boolean;
}

export default function ProductCard({ product, index = 0, showSummary = false }: ProductCardProps) {
  const discount = discountPercent(product);
  const imageUrl = primaryImageUrl(product);
  const detailHref = `/produits/${product.slug || product.id}`;
  const lowStock =
    product.stockQuantity > 0 && product.stockQuantity <= (product.lowStockThreshold || 5);

  return (
    <motion.article
      className="bg-surface rounded-2xl border border-border overflow-hidden group flex flex-col h-full"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.04, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4, boxShadow: '0 18px 36px -14px rgba(0,0,0,0.18)' }}
      data-testid="product-card"
    >
      <div className="relative">
        {discount > 0 && (
          <span className="absolute top-3 left-3 bg-danger text-white text-xs font-bold px-2 py-1 rounded-md z-10 shadow-sm">
            -{discount}%
          </span>
        )}
        {product.isFeatured && discount === 0 && (
          <span className="absolute top-3 left-3 bg-accent text-primary text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md z-10 shadow-sm">
            Vedette
          </span>
        )}
        {/* Produit sponsorisé (promotion payante) : toujours signalé clairement — cahier des charges §10 */}
        {product.isSponsored && (
          <span
            className="absolute bottom-3 right-3 inline-flex items-center gap-1 bg-black/70 text-white text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-md z-10 backdrop-blur-sm"
            title={product.promotions?.map((p) => p.typeLabel).join(' · ') || 'Promotion payante'}
            data-testid="product-sponsored-badge"
          >
            <Megaphone size={10} aria-hidden="true" /> Sponsorisé
          </span>
        )}
        <FavoriteButton product={product} className="absolute top-3 right-3 z-10" />
        <Link
          to={detailHref}
          className="block aspect-video overflow-hidden bg-surface-secondary"
          aria-label={product.name}
        >
          <MediaImage
            src={imageUrl}
            alt={product.images?.find((i) => i.isPrimary)?.alt ?? product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            width={300}
            height={169}
            fallback={
              <>
                <ImageOff size={28} aria-hidden="true" />
                <span className="text-xs">Aucune image</span>
              </>
            }
          />
        </Link>
        {product.category?.name && (
          <span className="absolute bottom-3 left-3 max-w-[75%] truncate rounded-md bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
            {product.category.name}
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <Link
          to={detailHref}
          className="font-semibold text-sm text-text text-right line-clamp-2 min-h-[2.5rem] hover:text-primary transition-colors"
        >
          {product.name}
        </Link>
        {showSummary && product.description && (
          <p className="mt-1 text-xs leading-relaxed text-muted line-clamp-2">
            {product.description}
          </p>
        )}
        {product.shop && (
          <Link
            to={`/boutiques/${product.shop.slug}`}
            className="inline-flex items-center gap-1.5 mt-1 text-[11px] text-muted hover:text-primary transition-colors min-w-0"
            onClick={(e) => e.stopPropagation()}
          >
            <Store size={11} aria-hidden="true" />
            <span className="truncate">{product.shop.name}</span>
            {product.shop.level !== 'new' && (
              <ShopLevelBadge level={product.shop.level} label={product.shop.levelLabel} />
            )}
          </Link>
        )}
        <ProductPrice
          price={product.price}
          compareAtPrice={product.compareAtPrice}
          className="mt-2 mb-1 w-full justify-between"
        />
        {lowStock && (
          <span className="mb-2 text-[11px] font-medium text-amber-600 dark:text-amber-400">
            Plus que {product.stockQuantity}
          </span>
        )}
        <div className="mt-auto flex items-center gap-2">
          {/* Les avis portent sur le vendeur : afficher sa note réelle, jamais une note vide. */}
          {product.seller && product.seller.reviewCount > 0 ? (
            <span
              className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted"
              role="img"
              aria-label={`Note vendeur : ${Number(product.seller.reputationScore).toFixed(1)} sur 5, ${product.seller.reviewCount} avis`}
            >
              <Star size={13} className="text-accent" fill="currentColor" aria-hidden="true" />
              <span>{Number(product.seller.reputationScore).toFixed(1)}</span>
              <span className="hidden sm:inline">({product.seller.reviewCount})</span>
            </span>
          ) : (
            <span className="shrink-0 text-[10px] text-muted">Pas d’avis</span>
          )}
          <ProductCardCartControl product={product} className="min-w-0 flex-1" />
        </div>
      </div>
    </motion.article>
  );
}

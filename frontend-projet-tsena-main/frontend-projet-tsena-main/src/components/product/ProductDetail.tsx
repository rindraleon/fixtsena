import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, ShieldCheck, Truck, RotateCcw, ImageOff, Pencil, Tag, ChevronLeft, ChevronRight, X, Megaphone } from 'lucide-react';
import MediaImage from '../common/MediaImage';
import clsx from 'clsx';
import ProductRating from './ProductRating';
import ProductPrice from './ProductPrice';
import AddToCartButton from './AddToCartButton';
import FavoriteButton from './FavoriteButton';
import ProductCard from './ProductCard';
import Button from '../common/Button';
import { useAuth } from '../../context/AuthContext';
import { useCartQuantity } from '../../hooks/queries/useCart';
import { discountPercent, productStatusLabel, sortedProductImages } from '../../lib/format';
import { selectableMax, stockAllowance, stockLimitMessage } from '../../lib/cart-stock';
import { toast, TOAST_MESSAGES } from '../../lib/toast';
import SellerCard from './SellerCard';
import type { ApiProduct } from '../../types/api';

interface ProductDetailProps {
  readonly product: ApiProduct;
  readonly relatedProducts?: ApiProduct[];
}

export default function ProductDetail({ product, relatedProducts = [] }: ProductDetailProps) {
  const { user } = useAuth();
  const [quantity, setQuantity] = useState(1);

  const images = useMemo(() => sortedProductImages(product.images), [product.images]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const selectedIndex = Math.max(0, images.findIndex((img) => img.id === selectedImageId));
  const selectedImage = images[selectedIndex];
  const [zoomed, setZoomed] = useState(false);

  const showImageAt = (index: number) => {
    if (images.length === 0) return;
    const next = (index + images.length) % images.length;
    setSelectedImageId(images[next].id);
  };

  const discount = discountPercent(product);
  const isOutOfStock = product.stockQuantity <= 0;
  const inCart = useCartQuantity(product.id);
  const allowance = stockAllowance(product.stockQuantity, inCart);
  const maxQuantity = selectableMax(product.stockQuantity, inCart);
  const selectedQuantity = Math.min(quantity, maxQuantity);
  const incrementQuantity = () => {
    if (selectedQuantity >= maxQuantity) {
      toast.warning(TOAST_MESSAGES.cart.stockLimit, { id: `stock-limit-${product.id}`, description: stockLimitMessage(allowance) });
      return;
    }
    setQuantity(selectedQuantity + 1);
  };
  const canManage = user?.role === 'admin' || (user?.role === 'seller' && user.id === product.sellerId);
  const editHref = user?.role === 'admin' ? `/dashboard/admin/produits/${product.id}/modifier` : `/dashboard/vendeur/produits/${product.id}/modifier`;
  const isBuyer = !user || user.role === 'client';

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <nav className="flex items-center gap-1.5 text-xs text-muted mb-6 flex-wrap" aria-label="Fil d'Ariane">
        <Link to="/" className="hover:text-primary">Accueil</Link>
        <span aria-hidden="true">/</span>
        <Link to="/produits" className="hover:text-primary">Produits</Link>
        {product.category && (
          <>
            <span aria-hidden="true">/</span>
            <Link to={`/produits?categoryId=${product.category.id}`} className="hover:text-primary">
              {product.category.name}
            </Link>
          </>
        )}
        <span aria-hidden="true">/</span>
        <span className="text-text font-medium truncate max-w-[200px] sm:max-w-none">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        <div className="animate-fade-in">
          <div
            className="relative aspect-square rounded-2xl overflow-hidden bg-surface-secondary border border-border group/gallery"
            data-testid="product-gallery"
          >
            {discount > 0 && (
              <span className="absolute top-4 left-4 bg-danger text-white text-xs font-bold px-2.5 py-1 rounded-md z-10">-{discount}%</span>
            )}
            <FavoriteButton product={product} className="absolute top-4 right-4 z-10" size={20} />
            {selectedImage ? (
              <button
                type="button"
                onClick={() => setZoomed(true)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowRight') { event.preventDefault(); showImageAt(selectedIndex + 1); }
                  if (event.key === 'ArrowLeft') { event.preventDefault(); showImageAt(selectedIndex - 1); }
                  if (event.key === 'Escape') setZoomed(false);
                }}
                className="block w-full h-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                aria-label="Agrandir l'image"
                data-testid="product-gallery-main"
              >
                <MediaImage
                  src={selectedImage.url}
                  alt={selectedImage.alt ?? product.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover/gallery:scale-[1.02]"
                  loading="eager"
                  fetchPriority="high"
                  width={600}
                  height={600}
                  fallbackLabel="Image indisponible"
                />
              </button>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-muted gap-2">
                <ImageOff size={40} aria-hidden="true" />
                <span className="text-sm">Aucune image disponible</span>
              </div>
            )}
            {images.length > 1 && (
              <>
                <button type="button" onClick={() => showImageAt(selectedIndex - 1)} className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 text-text shadow flex items-center justify-center hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" aria-label="Image précédente" data-testid="product-gallery-prev">
                  <ChevronLeft size={18} />
                </button>
                <button type="button" onClick={() => showImageAt(selectedIndex + 1)} className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 text-text shadow flex items-center justify-center hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" aria-label="Image suivante" data-testid="product-gallery-next">
                  <ChevronRight size={18} />
                </button>
                <span className="absolute bottom-3 right-3 bg-black/60 text-white text-xs font-medium px-2 py-0.5 rounded-md" aria-live="polite">
                  {selectedIndex + 1} / {images.length}
                </span>
              </>
            )}
          </div>
          {images.length > 1 && (
            <ul className="grid grid-cols-5 sm:grid-cols-6 gap-2 mt-3" aria-label="Images de présentation du produit" data-testid="product-gallery-thumbs">
              {images.map((image, index) => (
                <li key={image.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedImageId(image.id)}
                    className={clsx(
                      'aspect-square w-full rounded-lg overflow-hidden border-2 transition-all',
                      selectedIndex === index ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50',
                    )}
                    aria-label={image.alt ?? (image.isPrimary ? 'Image de couverture' : `Vue ${index + 1}`)}
                    aria-pressed={selectedIndex === index}
                  >
                    <MediaImage src={image.url} alt="" className="w-full h-full object-cover" width={120} height={120} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {zoomed && selectedImage && (
            <dialog
              open
              className="fixed inset-0 z-50 m-0 h-screen w-screen max-h-none max-w-none border-0 bg-black/90 p-4 text-inherit flex items-center justify-center"
              aria-modal="true"
              aria-label={`Image ${selectedIndex + 1} sur ${images.length}`}
              onClick={(event) => {
                if (event.target === event.currentTarget) setZoomed(false);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setZoomed(false);
              }}
              data-testid="product-lightbox"
            >
              <button type="button" onClick={() => setZoomed(false)} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25" aria-label="Fermer" autoFocus>
                <X size={20} />
              </button>
              {images.length > 1 && (
                <>
                  <button type="button" onClick={(e) => { e.stopPropagation(); showImageAt(selectedIndex - 1); }} className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25" aria-label="Image précédente">
                    <ChevronLeft size={22} />
                  </button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); showImageAt(selectedIndex + 1); }} className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25" aria-label="Image suivante">
                    <ChevronRight size={22} />
                  </button>
                </>
              )}
              <MediaImage src={selectedImage.url} alt={selectedImage.alt ?? product.name} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" loading="eager" fallbackClassName="w-64 h-64 rounded-lg" fallbackLabel="Image indisponible" />
            </dialog>
          )}
        </div>

        <div className="animate-fade-in-up">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {product.category && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                <Tag size={12} /> {product.category.name}
              </span>
            )}
            {product.status !== 'active' && product.status !== 'published' && (
              <span className="text-xs font-medium text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-500/15 px-2.5 py-1 rounded-full">
                {productStatusLabel(product.status)}
              </span>
            )}
            {product.isSponsored && (
              <span
                className="inline-flex items-center gap-1 text-xs font-medium text-text bg-surface-secondary border border-border px-2.5 py-1 rounded-full"
                title="Ce produit bénéficie d'une promotion payante achetée par le vendeur"
                data-testid="product-sponsored-badge"
              >
                <Megaphone size={12} /> Sponsorisé{product.promotions?.length ? ` · ${product.promotions.map((p) => p.typeLabel).join(', ')}` : ''}
              </span>
            )}
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-primary mb-2 leading-tight">{product.name}</h1>
          {product.shortDescription && <p className="text-muted mb-3">{product.shortDescription}</p>}

          <div className="flex flex-wrap items-center gap-2 mb-4">
            {product.seller && product.seller.reviewCount > 0 ? (
              <>
                <ProductRating rating={product.seller.reputationScore} size={16} />
                <span className="text-sm text-muted">{product.seller.reputationScore.toFixed(1)} · {product.seller.reviewCount} avis sur le vendeur</span>
              </>
            ) : (
              <span className="text-sm text-muted">Vendeur sans avis pour le moment</span>
            )}
            {product.salesCount > 0 && <span className="text-sm text-muted">· {product.salesCount} vendu(s)</span>}
          </div>

          <ProductPrice price={product.price} compareAtPrice={product.compareAtPrice} size="lg" className="mb-4" />

          <div className="mb-6 space-y-3">
            {product.seller && <SellerCard seller={product.seller} shop={product.shop} product={product} />}
            {product.sku && <p className="text-sm text-muted">Référence : <span className="font-mono text-text">{product.sku}</span></p>}
          </div>

          <div className={clsx('text-sm font-medium mb-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg', isOutOfStock ? 'text-danger bg-red-50 dark:bg-red-500/10' : 'text-success bg-emerald-50 dark:bg-emerald-500/10')}>
            <span className={clsx('w-2 h-2 rounded-full', isOutOfStock ? 'bg-danger' : 'bg-success')} aria-hidden="true" />
            {isOutOfStock ? 'En rupture de stock' : `En stock — ${product.stockQuantity} unité(s) disponible(s)`}
          </div>

          {isBuyer && !isOutOfStock && (
            <div className="mb-6">
              {!allowance.maxReached && (
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-text">Quantité :</span>
                  <div className="flex items-center border border-border rounded-lg overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.max(1, selectedQuantity - 1))}
                      disabled={selectedQuantity <= 1}
                      className="p-2.5 hover:bg-surface-secondary text-muted disabled:opacity-40"
                      aria-label="Diminuer la quantité"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="px-4 font-semibold text-text min-w-[3rem] text-center" aria-live="polite" data-testid="product-quantity">{selectedQuantity}</span>
                    <button
                      type="button"
                      onClick={incrementQuantity}
                      aria-disabled={selectedQuantity >= maxQuantity || undefined}
                      className={clsx('p-2.5 hover:bg-surface-secondary text-muted', selectedQuantity >= maxQuantity && 'opacity-40')}
                      aria-label="Augmenter la quantité"
                      title={selectedQuantity >= maxQuantity ? stockLimitMessage(allowance) : undefined}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <span className="text-xs text-muted" data-testid="product-quantity-max">max. {allowance.remaining}</span>
                </div>
              )}
              {inCart > 0 && (
                <p className={clsx('mt-2 text-xs', allowance.maxReached ? 'text-amber-700 dark:text-amber-300' : 'text-muted')} data-testid="in-cart-hint">
                  {inCart} déjà dans votre panier
                  {allowance.maxReached ? ' — stock disponible atteint' : ` · ${allowance.remaining} encore ajoutable${allowance.remaining > 1 ? 's' : ''}`}
                  {' · '}
                  <Link to="/panier" className="text-primary font-medium hover:underline">Voir le panier</Link>
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 mb-8">
            {isBuyer && <AddToCartButton product={product} quantity={selectedQuantity} size="lg" className="sm:flex-1 rounded-xl" stopPropagation={false} />}
            {canManage && (
              <Link to={editHref} className="sm:flex-1">
                <Button variant="primary" size="lg" icon={Pencil} fullWidth tabIndex={-1}>
                  Modifier ce produit
                </Button>
              </Link>
            )}
          </div>

          {product.description && (
            <div className="mb-8">
              <h2 className="text-base font-bold text-text mb-2">Description</h2>
              <p className="text-sm text-muted leading-relaxed whitespace-pre-line">{product.description}</p>
            </div>
          )}

          {product.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-8">
              {product.tags.map((tag) => (
                <Link key={tag} to={`/produits?tags=${encodeURIComponent(tag)}`} className="text-xs px-2.5 py-1 rounded-full bg-surface-tertiary text-muted hover:text-primary hover:bg-primary/10 transition-colors">
                  #{tag}
                </Link>
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-4 pt-6 border-t border-border">
            <div className="flex items-center gap-2 text-xs text-muted"><ShieldCheck size={16} className="text-primary shrink-0" /> Paiement protégé en séquestre jusqu’à la réception</div>
            <div className="flex items-center gap-2 text-xs text-muted"><Truck size={16} className="text-primary shrink-0" /> Réception à confirmer par vous avant libération des fonds</div>
            <div className="flex items-center gap-2 text-xs text-muted"><RotateCcw size={16} className="text-primary shrink-0" /> Litige possible après livraison, arbitré par Tsena</div>
          </div>
        </div>
      </div>

      {relatedProducts.length > 0 && (
        <section className="mt-14 animate-fade-in-up" aria-labelledby="related-heading">
          <h2 id="related-heading" className="text-xl font-bold text-primary mb-6">Produits similaires</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {relatedProducts.slice(0, 5).map((related, index) => (
              <ProductCard key={related.id} product={related} index={index} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

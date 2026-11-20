import { Link } from 'react-router-dom';
import { Minus, Plus, Trash2, ImageOff, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { Spinner } from '../common/Button';
import { formatPrice, primaryImageUrl, toNumber } from '../../lib/format';
import { stockAllowance, stockLimitMessage } from '../../lib/cart-stock';
import type { CartItem } from '../../types/api';

interface CartItemRowProps {
  readonly item: CartItem;
  readonly onUpdateQuantity: (item: CartItem, quantity: number) => void;
  readonly onRemove: (item: CartItem) => void;
  readonly updating?: boolean;
  readonly removing?: boolean;
}

export default function CartItemRow({ item, onUpdateQuantity, onRemove, updating = false, removing = false }: CartItemRowProps) {
  const product = item.product;
  const imageUrl = product ? primaryImageUrl(product) : undefined;
  const stockLimit = product ? stockAllowance(product.stockQuantity).limit : 0;
  const maxQuantity = Math.max(1, stockLimit);
  const unavailable = !product || product.status === 'sold_out' || product.stockQuantity <= 0 || (product.status !== 'active' && product.status !== 'published');
  const exceedsStock = !!product && item.quantity > product.stockQuantity;
  const atMax = !unavailable && !exceedsStock && item.quantity >= maxQuantity;
  const busy = updating || removing;
  const limitMessage = product ? stockLimitMessage(stockAllowance(product.stockQuantity, item.quantity)) : 'Cet article n’est plus disponible';

  return (
    <li
      className={clsx('bg-surface rounded-2xl border border-border p-4 flex gap-4 transition-opacity', busy && 'opacity-70')}
      aria-busy={busy || undefined}
      data-testid="cart-item"
    >
      <Link to={product ? `/produits/${product.slug || product.id}` : '#'} className="w-24 h-24 rounded-xl overflow-hidden bg-surface-secondary shrink-0" aria-label={product?.name ?? 'Produit indisponible'}>
        {imageUrl ? (
          <img src={imageUrl} alt={product?.name ?? ''} className="w-full h-full object-cover" width={96} height={96} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted"><ImageOff size={22} /></div>
        )}
      </Link>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm text-text line-clamp-2">{product?.name ?? 'Produit indisponible'}</h3>
            <p className="text-sm font-bold text-primary mt-1">{formatPrice(item.unitPrice)}</p>
            {(unavailable || exceedsStock) && (
              <p className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300 mt-1">
                <AlertTriangle size={12} />
                {unavailable ? 'Cet article n’est plus disponible' : `Stock limité : ${product?.stockQuantity} disponible(s)`}
                {exceedsStock && !unavailable && product && (
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(item, product.stockQuantity)}
                    disabled={busy}
                    className="ml-1 font-semibold underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-100 disabled:opacity-50"
                    data-testid="cart-item-adjust"
                  >
                    Ajuster à {product.stockQuantity}
                  </button>
                )}
              </p>
            )}
            {atMax && (
              <p className="text-[11px] text-muted mt-1" data-testid="cart-item-max">Quantité maximale disponible atteinte ({maxQuantity})</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onRemove(item)}
            disabled={busy}
            className="p-2 rounded-lg text-muted hover:text-danger hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50 shrink-0"
            aria-label={`Retirer ${product?.name ?? "l'article"} du panier`}
          >
            {removing ? <Spinner /> : <Trash2 size={18} />}
          </button>
        </div>

        <div className="flex items-center justify-between mt-auto pt-3">
          <div className="flex items-center border border-border rounded-lg overflow-hidden" aria-label="Quantité">
            <button
              type="button"
              onClick={() => onUpdateQuantity(item, item.quantity - 1)}
              disabled={busy || item.quantity <= 1}
              className="p-2 hover:bg-surface-secondary text-muted disabled:opacity-40"
              aria-label="Diminuer la quantité"
            >
              <Minus size={14} />
            </button>
            <span className="px-3 text-sm font-semibold text-text min-w-[2.5rem] text-center flex items-center justify-center" aria-live="polite">
              {updating ? <Spinner /> : item.quantity}
            </span>
            <button
              type="button"
              onClick={() => onUpdateQuantity(item, item.quantity + 1)}
              disabled={busy || unavailable}
              aria-disabled={item.quantity >= maxQuantity || undefined}
              title={item.quantity >= maxQuantity && !unavailable ? limitMessage : undefined}
              className={clsx('p-2 hover:bg-surface-secondary text-muted disabled:opacity-40', item.quantity >= maxQuantity && 'opacity-40')}
              aria-label="Augmenter la quantité"
            >
              <Plus size={14} />
            </button>
          </div>
          <span className="text-sm font-bold text-text">{formatPrice(toNumber(item.unitPrice) * item.quantity)}</span>
        </div>
      </div>
    </li>
  );
}

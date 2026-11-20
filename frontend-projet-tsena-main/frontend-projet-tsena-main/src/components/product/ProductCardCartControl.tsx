import { Minus, Plus, ShoppingCart } from 'lucide-react';
import clsx from 'clsx';
import AddToCartButton from './AddToCartButton';
import { useRemoveCartItem, useUpdateCartItem } from '../../hooks/mutations/useCartMutations';
import { useCart } from '../../hooks/queries/useCart';
import { stockAllowance, stockLimitMessage } from '../../lib/cart-stock';
import { toast, TOAST_MESSAGES } from '../../lib/toast';
import { Spinner } from '../common/Button';
import type { ApiProduct } from '../../types/api';

interface ProductCardCartControlProps {
  readonly product: ApiProduct;
  readonly className?: string;
}

export default function ProductCardCartControl({
  product,
  className,
}: ProductCardCartControlProps) {
  const cartQuery = useCart();
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();
  const cartItems = cartQuery.data?.items.filter((item) => item.productId === product.id) ?? [];
  const inCart = cartItems.reduce((total, item) => total + item.quantity, 0);
  const cartItem = cartItems[0];
  const busy = updateItem.isPending || removeItem.isPending;
  const allowance = stockAllowance(product.stockQuantity, inCart);
  const unavailable =
    product.stockQuantity <= 0 ||
    product.status === 'sold_out' ||
    (product.status !== 'active' && product.status !== 'published');

  if (!cartItem || inCart === 0) {
    return <AddToCartButton product={product} size="sm" className={className} />;
  }

  const decrease = () => {
    if (busy) return;
    if (cartItem.quantity === 1) {
      removeItem.mutate(cartItem.id);
      return;
    }
    updateItem.mutate({ itemId: cartItem.id, quantity: cartItem.quantity - 1 });
  };

  const increase = () => {
    if (busy) return;
    if (allowance.maxReached) {
      toast.warning(TOAST_MESSAGES.cart.stockLimit, {
        id: `stock-limit-${product.id}`,
        description: stockLimitMessage(allowance),
      });
      return;
    }
    updateItem.mutate({ itemId: cartItem.id, quantity: cartItem.quantity + 1 });
  };

  return (
    <div
      className={clsx(
        'flex items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-2 py-1.5',
        className,
        busy && 'opacity-70',
      )}
      aria-busy={busy || undefined}
      data-testid="product-card-cart-selection"
    >
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
        <ShoppingCart size={14} aria-hidden="true" />
        Dans le panier
      </span>
      <div className="flex items-center border border-border bg-surface rounded-md overflow-hidden">
        <button
          type="button"
          onClick={decrease}
          disabled={busy}
          className="p-1.5 text-muted hover:bg-surface-secondary disabled:opacity-40"
          aria-label={`Diminuer la quantité de ${product.name}`}
        >
          {busy ? <Spinner /> : <Minus size={13} aria-hidden="true" />}
        </button>
        <span
          className="min-w-[1.75rem] px-1 text-center text-xs font-semibold text-text"
          aria-live="polite"
          data-testid="product-card-cart-quantity"
        >
          {inCart}
        </span>
        <button
          type="button"
          onClick={increase}
          disabled={busy || unavailable}
          aria-disabled={allowance.maxReached || undefined}
          title={allowance.maxReached && !unavailable ? stockLimitMessage(allowance) : undefined}
          className={clsx(
            'p-1.5 text-muted hover:bg-surface-secondary disabled:opacity-40',
            allowance.maxReached && 'opacity-40',
          )}
          aria-label={`Augmenter la quantité de ${product.name}`}
        >
          <Plus size={13} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShoppingCart, Check, Loader2, PackageX, PackageCheck } from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useAddToCart } from '../../hooks/mutations/useCartMutations';
import { useCartQuantity } from '../../hooks/queries/useCart';
import { stockAllowance, stockLimitMessage } from '../../lib/cart-stock';
import { toast, TOAST_MESSAGES } from '../../lib/toast';
import type { ApiProduct } from '../../types/api';

interface AddToCartButtonProps {
  readonly product: Pick<ApiProduct, 'id' | 'name' | 'stockQuantity' | 'status'>;
  readonly quantity?: number;
  readonly className?: string;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly stopPropagation?: boolean;
}

const SIZES = { sm: 'py-2 text-xs', md: 'py-2.5 text-sm', lg: 'py-3.5 text-base' } as const;

export default function AddToCartButton({ product, quantity = 1, className, size = 'md', stopPropagation = true }: AddToCartButtonProps) {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const addToCart = useAddToCart();
  const inCart = useCartQuantity(product.id);
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    if (!justAdded) return;
    const timer = window.setTimeout(() => setJustAdded(false), 1600);
    return () => window.clearTimeout(timer);
  }, [justAdded]);

  const outOfStock = product.stockQuantity <= 0 || product.status === 'sold_out';
  const unavailable = outOfStock || (product.status !== 'active' && product.status !== 'published');
  const isSellerOrAdmin = user?.role === 'seller' || user?.role === 'admin';
  const busy = addToCart.isPending;
  const allowance = stockAllowance(product.stockQuantity, inCart);
  const maxReached = isAuthenticated && !unavailable && allowance.maxReached;

  const handleClick = (event: React.MouseEvent) => {
    if (stopPropagation) event.stopPropagation();
    if (busy || justAdded || unavailable || maxReached) return;

    if (!isAuthenticated) {
      navigate('/connexion', { state: { from: location.pathname } });
      return;
    }

    if (quantity > allowance.remaining) {
      toast.warning(TOAST_MESSAGES.cart.stockLimit, { id: `stock-limit-${product.id}`, description: stockLimitMessage(allowance) });
      return;
    }

    addToCart.mutate(
      { productId: product.id, quantity },
      { onSuccess: () => setJustAdded(true) },
    );
  };

  if (isSellerOrAdmin) return null;

  const state = unavailable ? 'unavailable' : maxReached ? 'max' : busy ? 'loading' : justAdded ? 'success' : 'idle';
  const ariaLabel = unavailable
    ? `${product.name} indisponible`
    : maxReached
      ? `${product.name} : quantité maximale déjà dans le panier (${allowance.inCart})`
      : `Ajouter ${product.name} au panier`;

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      disabled={state !== 'idle'}
      className={clsx(
        'w-full flex items-center justify-center gap-2 rounded-lg font-semibold text-white relative overflow-hidden',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 transition-colors',
        state === 'idle' && 'bg-primary hover:bg-primary-dark cursor-pointer',
        state === 'loading' && 'bg-primary/70 cursor-wait',
        state === 'success' && 'bg-success',
        state === 'unavailable' && 'bg-surface-tertiary text-muted cursor-not-allowed',
        state === 'max' && 'bg-surface-tertiary text-muted cursor-not-allowed',
        SIZES[size],
        className,
      )}
      aria-label={ariaLabel}
      title={maxReached ? stockLimitMessage(allowance) : undefined}
      aria-busy={busy || undefined}
      whileTap={state === 'idle' ? { scale: 0.97 } : undefined}
      data-testid="add-to-cart"
      data-state={state}
    >
      <AnimatePresence mode="wait" initial={false}>
        {state === 'unavailable' && (
          <motion.span key="unavailable" className="flex items-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <PackageX size={16} aria-hidden="true" /> {outOfStock ? 'Rupture de stock' : 'Indisponible'}
          </motion.span>
        )}
        {state === 'max' && (
          <motion.span key="max" className="flex items-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <PackageCheck size={16} aria-hidden="true" /> Maximum dans le panier
          </motion.span>
        )}
        {state === 'loading' && (
          <motion.span key="loading" className="flex items-center gap-2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
            <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Ajout...
          </motion.span>
        )}
        {state === 'success' && (
          <motion.span key="success" className="flex items-center gap-2" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, y: -8 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
            <Check size={16} aria-hidden="true" /> Ajouté !
          </motion.span>
        )}
        {state === 'idle' && (
          <motion.span key="idle" className="flex items-center gap-2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
            <ShoppingCart size={16} aria-hidden="true" /> Ajouter au panier
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

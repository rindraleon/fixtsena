import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, ArrowRight, Trash2, ShieldCheck, LogIn } from 'lucide-react';
import { useTitle } from '../../hooks';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../hooks/queries/useCart';
import { useClearCart, useRemoveCartItem, useUpdateCartItem } from '../../hooks/mutations/useCartMutations';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import { CartItemRow } from '../../components/cart';
import { Button, ConfirmDialog, EmptyState, ErrorState, LoadingState } from '../../components/common';
import { formatPrice } from '../../lib/format';
import { CART_MAX_PER_LINE, stockAllowance, stockLimitMessage } from '../../lib/cart-stock';
import { toast, TOAST_MESSAGES } from '../../lib/toast';
import type { CartItem } from '../../types/api';

export default function CartPage() {
  useTitle('Mon panier', { noindex: true });
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const cartQuery = useCart();
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();
  const clearCart = useClearCart();
  const confirmRemove = useConfirmAction<CartItem>();
  const confirmClear = useConfirmAction<true>();

  if (authLoading) return <LoadingState variant="page" />;

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <EmptyState titleAs="h1"
          icon={LogIn}
          title="Connectez-vous pour accéder à votre panier"
          description="Votre panier est lié à votre compte afin de le retrouver sur tous vos appareils."
          action={{ label: 'Se connecter', onClick: () => navigate('/connexion', { state: { from: '/panier' } }) }}
          secondaryAction={{ label: 'Continuer mes achats', to: '/produits' }}
        />
      </div>
    );
  }

  if (cartQuery.isPending) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <LoadingState variant="table" count={3} label="Chargement du panier..." />
      </div>
    );
  }

  if (cartQuery.isError) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <ErrorState error={cartQuery.error} onRetry={() => void cartQuery.refetch()} retrying={cartQuery.isFetching} />
      </div>
    );
  }

  const cart = cartQuery.data;
  const items = cart.items;

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 animate-fade-in-up">
        <EmptyState titleAs="h1"
          icon={ShoppingCart}
          title="Panier vide"
          description="Vous n'avez encore ajouté aucun article. Découvrez nos produits et nos promotions du moment."
          action={{ label: 'Continuer mes achats', to: '/produits', icon: ArrowRight }}
          secondaryAction={{ label: 'Voir les promotions', to: '/promotions' }}
        />
      </div>
    );
  }

  const subtotal = cart.summary.totalAmount;
  const total = subtotal;
  const hasUnavailable = items.some((item) => !item.product || item.product.stockQuantity < item.quantity);

  const handleUpdateQuantity = (item: CartItem, quantity: number) => {
    if (quantity < 1 || updateItem.isPending) return;
    const allowance = stockAllowance(item.product?.stockQuantity ?? 0);
    if (quantity > item.quantity && quantity > allowance.limit) {
      toast.warning(TOAST_MESSAGES.cart.stockLimit, {
        id: `stock-limit-${item.productId}`,
        description: item.product ? stockLimitMessage(stockAllowance(item.product.stockQuantity, item.quantity)) : 'Cet article n’est plus disponible.',
      });
      return;
    }
    updateItem.mutate({ itemId: item.id, quantity: Math.min(quantity, CART_MAX_PER_LINE) });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-fade-in-up">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Mon panier</h1>
          <p className="text-sm text-muted">{cart.summary.totalQuantity} article{cart.summary.totalQuantity > 1 ? 's' : ''}</p>
        </div>
        <Button variant="ghost" size="sm" icon={Trash2} onClick={() => confirmClear.request(true)} disabled={clearCart.isPending} className="text-danger hover:bg-red-50 dark:hover:bg-red-500/10">
          Vider le panier
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ul className="lg:col-span-2 space-y-3" aria-label="Articles du panier">
          {items.map((item) => (
            <CartItemRow
              key={item.id}
              item={item}
              onUpdateQuantity={handleUpdateQuantity}
              onRemove={confirmRemove.request}
              updating={updateItem.isPending && updateItem.variables?.itemId === item.id}
              removing={removeItem.isPending && removeItem.variables === item.id}
            />
          ))}
        </ul>

        <aside className="bg-surface rounded-2xl border border-border p-5 h-fit sticky top-24 space-y-3">
          <h2 className="font-bold text-text mb-2">Récapitulatif</h2>
          <div className="flex justify-between text-sm"><span className="text-muted">Sous-total</span><span className="font-medium text-text">{formatPrice(subtotal)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted">Livraison</span><span className="font-medium text-success">Offerte</span></div>
          <div className="border-t border-border pt-3 flex justify-between text-base font-bold"><span className="text-text">Total</span><span className="text-primary">{formatPrice(total)}</span></div>

          {hasUnavailable && (
            <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 rounded-lg px-3 py-2">
              Certains articles ne sont plus disponibles en quantité suffisante. Ajustez votre panier avant de commander.
            </p>
          )}

          <Button fullWidth size="lg" icon={ArrowRight} onClick={() => navigate('/commande/validation')} disabled={hasUnavailable || updateItem.isPending || removeItem.isPending} data-testid="checkout-button">
            Passer la commande
          </Button>
          <Link to="/produits" className="block text-center text-sm text-primary font-medium hover:underline">
            Continuer mes achats
          </Link>
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted pt-2"><ShieldCheck size={14} className="text-primary" /> Paiement sécurisé · Retour 7 jours</p>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmRemove.isOpen}
        variant="destructive"
        title="Retirer cet article ?"
        description={confirmRemove.target?.product ? `« ${confirmRemove.target.product.name} » sera retiré de votre panier.` : "L'article sera retiré de votre panier."}
        confirmLabel="Retirer"
        loadingLabel="Suppression..."
        loading={removeItem.isPending}
        onConfirm={() => void confirmRemove.run((item) => removeItem.mutateAsync(item.id))}
        onCancel={confirmRemove.cancel}
      />

      <ConfirmDialog
        open={confirmClear.isOpen}
        variant="destructive"
        title="Vider le panier ?"
        description="Tous les articles seront retirés de votre panier. Cette action est irréversible."
        confirmLabel="Vider le panier"
        loadingLabel="Suppression..."
        loading={clearCart.isPending}
        onConfirm={() => void confirmClear.run(() => clearCart.mutateAsync())}
        onCancel={confirmClear.cancel}
      />
    </div>
  );
}

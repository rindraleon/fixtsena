export const CART_MAX_PER_LINE = 99;

export interface StockAllowance {
  readonly inCart: number;
  readonly limit: number;
  readonly remaining: number;
  readonly maxReached: boolean;
}

export function stockAllowance(stockQuantity: number, inCart = 0): StockAllowance {
  const limit = Math.max(0, Math.min(CART_MAX_PER_LINE, Math.floor(Number(stockQuantity) || 0)));
  const safeInCart = Math.max(0, Math.floor(Number(inCart) || 0));
  const remaining = Math.max(0, limit - safeInCart);
  return { inCart: safeInCart, limit, remaining, maxReached: remaining <= 0 };
}

export function selectableMax(stockQuantity: number, inCart = 0): number {
  return Math.max(1, stockAllowance(stockQuantity, inCart).remaining);
}

const unit = (n: number) => `${n} unité${n > 1 ? 's' : ''}`;

export function stockLimitMessage(allowance: StockAllowance): string {
  if (allowance.limit <= 0) return 'Cet article est en rupture de stock.';
  if (allowance.maxReached) {
    return allowance.inCart > 0
      ? `Vous avez déjà ${unit(allowance.inCart)} dans votre panier : le stock disponible (${allowance.limit}) est atteint.`
      : `Stock maximum atteint (${allowance.limit}).`;
  }
  return allowance.inCart > 0
    ? `Il ne reste que ${unit(allowance.remaining)} à ajouter : vous en avez déjà ${allowance.inCart} dans votre panier sur ${allowance.limit} disponible(s).`
    : `Il ne reste que ${unit(allowance.remaining)} disponible(s).`;
}

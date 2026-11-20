import { useQuery } from '@tanstack/react-query';
import { cartApi } from '../../api/cart.api';
import { queryKeys } from '../../lib/query-keys';
import { useAuth } from '../../context/AuthContext';
import type { CartData } from '../../types/api';

export const EMPTY_CART: CartData = {
  cart: null,
  items: [],
  summary: { itemCount: 0, totalQuantity: 0, totalAmount: 0 },
};

export function useCart() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.cart.detail(),
    queryFn: cartApi.get,
    enabled: isAuthenticated,
    staleTime: 15 * 1000,
  });
}

export function useCartQuantity(productId: string | undefined): number {
  const cartQuery = useCart();
  if (!productId || !cartQuery.data) return 0;
  return cartQuery.data.items.reduce((sum, item) => (item.productId === productId ? sum + item.quantity : sum), 0);
}

export function useCartCount() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.cart.count(),
    queryFn: cartApi.count,
    enabled: isAuthenticated,
    staleTime: 15 * 1000,
    select: (data) => data.count,
  });
}

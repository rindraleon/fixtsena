import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cartApi } from '../../api/cart.api';
import { queryKeys } from '../../lib/query-keys';
import { toast, TOAST_MESSAGES } from '../../lib/toast';
import { getApiErrorMessage } from '../../lib/api-error';
import type { AddCartItemDto, CartData } from '../../types/api';

function useSyncCart() {
  const queryClient = useQueryClient();
  return (cart: CartData) => {
    queryClient.setQueryData(queryKeys.cart.detail(), cart);
    queryClient.setQueryData(queryKeys.cart.count(), { count: cart.summary.totalQuantity });
    void queryClient.invalidateQueries({ queryKey: queryKeys.checkout.all });
  };
}

function useCartErrorHandler() {
  const queryClient = useQueryClient();
  return (error: unknown) => {
    toast.error(TOAST_MESSAGES.cart.error, { id: 'cart-error', description: getApiErrorMessage(error) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.cart.all });
  };
}

export function useAddToCart() {
  const sync = useSyncCart();
  const onError = useCartErrorHandler();
  return useMutation({
    mutationFn: (dto: AddCartItemDto) => cartApi.addItem(dto),
    onSuccess: (cart) => {
      sync(cart);
      toast.success(TOAST_MESSAGES.cart.added, { id: 'cart-added' });
    },
    onError,
  });
}

export function useUpdateCartItem() {
  const sync = useSyncCart();
  const onError = useCartErrorHandler();
  return useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      cartApi.updateItem(itemId, { quantity }),
    onSuccess: (cart) => {
      sync(cart);
      toast.success(TOAST_MESSAGES.cart.updated, { id: 'cart-updated' });
    },
    onError,
  });
}

export function useRemoveCartItem() {
  const sync = useSyncCart();
  const onError = useCartErrorHandler();
  return useMutation({
    mutationFn: (itemId: string) => cartApi.removeItem(itemId),
    onSuccess: (cart) => {
      sync(cart);
      toast.success(TOAST_MESSAGES.cart.removed, { id: 'cart-removed' });
    },
    onError,
  });
}

export function useClearCart() {
  const sync = useSyncCart();
  const onError = useCartErrorHandler();
  return useMutation({
    mutationFn: () => cartApi.clear(),
    onSuccess: (cart) => {
      sync(cart);
      toast.success(TOAST_MESSAGES.cart.cleared, { id: 'cart-cleared' });
    },
    onError,
  });
}

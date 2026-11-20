import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from '../../api/orders.api';
import { queryKeys } from '../../lib/query-keys';
import { toast, TOAST_MESSAGES } from '../../lib/toast';
import { getApiErrorMessage } from '../../lib/api-error';
import { EMPTY_CART } from '../queries/useCart';
import type { CreateOrderDto, UpdateDeliveryDto, UpdateOrderStatusDto } from '../../types/api';

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateOrderDto = {}) => ordersApi.create(dto),
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.cart.detail(), EMPTY_CART);
      queryClient.setQueryData(queryKeys.cart.count(), { count: 0 });
      queryClient.removeQueries({ queryKey: queryKeys.checkout.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cart.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      toast.success(TOAST_MESSAGES.orders.created, { id: 'order-created' });
    },
    onError: (error) =>
      toast.error(TOAST_MESSAGES.orders.error, { id: 'order-error', description: getApiErrorMessage(error) }),
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateOrderStatusDto }) => ordersApi.updateStatus(id, dto),
    onSuccess: (order) => {
      queryClient.setQueryData(queryKeys.orders.detail(order.id), order);
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.escrow.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.dashboard() });
      toast.success(TOAST_MESSAGES.orders.statusUpdated, { id: 'order-status-updated' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'order-status-error' }),
  });
}

export function useUpdateDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateDeliveryDto }) => ordersApi.updateDelivery(id, dto),
    onSuccess: (order) => {
      queryClient.setQueryData(queryKeys.orders.detail(order.id), order);
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      toast.success('Suivi de livraison mis à jour', { id: 'delivery-updated', description: "L'acheteur est informé de la mise à jour." });
    },
    onError: (error) => toast.error('Impossible de mettre à jour le suivi', { id: 'delivery-error', description: getApiErrorMessage(error) }),
  });
}

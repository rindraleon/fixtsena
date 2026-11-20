import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ordersApi } from '../../api/orders.api';
import { queryKeys } from '../../lib/query-keys';
import { useAuth } from '../../context/AuthContext';
import type { OrderFilters } from '../../types/api';

export function useOrders(filters: OrderFilters = {}, options: { enabled?: boolean } = {}) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.orders.list(filters),
    queryFn: () => ordersApi.list(filters),
    enabled: isAuthenticated && (options.enabled ?? true),
    placeholderData: keepPreviousData,
    staleTime: 15 * 1000,
  });
}

export function useOrder(id: string | undefined) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.orders.detail(id ?? ''),
    queryFn: () => ordersApi.getById(id as string),
    enabled: isAuthenticated && !!id,
  });
}

export function useOrderByNumber(orderNumber: string | undefined) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.orders.byNumber(orderNumber ?? ''),
    queryFn: () => ordersApi.getByNumber(orderNumber as string),
    enabled: isAuthenticated && !!orderNumber,
  });
}

export function useSellerOrderStats() {
  const { isAuthenticated, hasRole } = useAuth();
  return useQuery({
    queryKey: queryKeys.orders.sellerStats(),
    queryFn: ordersApi.sellerStats,
    enabled: isAuthenticated && hasRole('seller', 'admin'),
    staleTime: 30 * 1000,
  });
}

export function useBuyerOrderStats() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.orders.buyerStats(),
    queryFn: ordersApi.buyerStats,
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
  });
}

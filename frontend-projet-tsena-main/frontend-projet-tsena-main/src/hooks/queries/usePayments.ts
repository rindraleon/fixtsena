import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { PaymentFilters } from '../../types/api';
import { paymentsApi } from '../../api/payments.api';
import { queryKeys } from '../../lib/query-keys';
import { useAuth } from '../../context/AuthContext';

export function usePayment(id: string | undefined) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.payments.detail(id ?? ''),
    queryFn: () => paymentsApi.getById(id as string),
    enabled: isAuthenticated && !!id,
  });
}

export function usePaymentsByOrder(orderId: string | undefined) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.payments.byOrder(orderId ?? ''),
    queryFn: () => paymentsApi.getByOrder(orderId as string),
    enabled: isAuthenticated && !!orderId,
  });
}

export function usePaymentByTransaction(transactionId: string | undefined) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.payments.byTransaction(transactionId ?? ''),
    queryFn: () => paymentsApi.getByTransaction(transactionId as string),
    enabled: isAuthenticated && !!transactionId,
  });
}

export function usePayments(filters: PaymentFilters = {}) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.payments.list(filters),
    queryFn: () => paymentsApi.list(filters),
    enabled: isAuthenticated,
    placeholderData: keepPreviousData,
  });
}

export function usePaymentStats() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.payments.stats(),
    queryFn: () => paymentsApi.stats(),
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
  });
}

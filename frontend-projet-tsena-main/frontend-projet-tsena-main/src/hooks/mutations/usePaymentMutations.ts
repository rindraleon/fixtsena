import { useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentsApi } from '../../api/payments.api';
import { queryKeys } from '../../lib/query-keys';
import { toast } from '../../lib/toast';
import { getApiErrorMessage } from '../../lib/api-error';
import type { InitiatePaymentDto } from '../../types/api';

export function useInitiatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: InitiatePaymentDto) => paymentsApi.initiate(dto),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.payments.byOrder(result.payment.orderId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      toast.success('Paiement initié', { id: 'payment-initiated' });
    },
    onError: (error) =>
      toast.error('Échec du paiement', {
        id: 'payment-error',
        description: getApiErrorMessage(error, 'Le paiement n’a pas pu être initié. Veuillez réessayer.'),
        duration: 8000,
      }),
  });
}

function useSyncPayment() {
  const queryClient = useQueryClient();
  return (_payment: { id: string; orderId: string }) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.escrow.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.dashboard() });
  };
}

export function useConfirmPayment() {
  const sync = useSyncPayment();
  return useMutation({
    mutationFn: (id: string) => paymentsApi.confirm(id),
    onSuccess: (payment) => { sync(payment); toast.success('Paiement confirmé', { id: 'payment-confirmed', description: 'Les fonds sont placés en séquestre.' }); },
    onError: (error) => toast.error('Impossible de confirmer le paiement', { id: 'payment-admin-error', description: getApiErrorMessage(error) }),
  });
}

export function useSimulatePaymentSuccess() {
  const sync = useSyncPayment();
  return useMutation({
    mutationFn: (id: string) => paymentsApi.simulateSuccess(id),
    onSuccess: (payment) => { sync(payment); toast.success('Paiement simulé avec succès', { id: 'payment-simulated' }); },
    onError: (error) => toast.error('Impossible de simuler le paiement', { id: 'payment-admin-error', description: getApiErrorMessage(error) }),
  });
}

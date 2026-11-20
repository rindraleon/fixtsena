import { useMutation, useQueryClient } from '@tanstack/react-query';
import { escrowApi } from '../../api/escrow.api';
import { queryKeys } from '../../lib/query-keys';
import { toast } from '../../lib/toast';
import { getApiErrorMessage } from '../../lib/api-error';
import type { ApiEscrow } from '../../types/api';

function useInvalidateEscrow() {
  const queryClient = useQueryClient();
  return (escrow: ApiEscrow) => {
    queryClient.setQueryData(queryKeys.escrow.byOrder(escrow.orderId), escrow);
    queryClient.setQueryData(queryKeys.escrow.detail(escrow.id), escrow);
    void queryClient.invalidateQueries({ queryKey: queryKeys.escrow.stats() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
  };
}

export function useReleaseEscrow() {
  const sync = useInvalidateEscrow();
  return useMutation({
    mutationFn: (escrowId: string) => escrowApi.release(escrowId),
    onSuccess: (escrow) => {
      sync(escrow);
      toast.success('Réception confirmée', { id: 'escrow-released', description: 'Les fonds ont été libérés au vendeur.' });
    },
    onError: (error) => toast.error('Impossible de confirmer la réception', { id: 'escrow-error', description: getApiErrorMessage(error) }),
  });
}

export function useBlockEscrow() {
  const sync = useInvalidateEscrow();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => escrowApi.block(id, reason),
    onSuccess: (escrow) => { sync(escrow); toast.success('Fonds bloqués', { id: 'escrow-blocked' }); },
    onError: (error) => toast.error('Impossible de bloquer les fonds', { id: 'escrow-error', description: getApiErrorMessage(error) }),
  });
}

export function useUnblockEscrow() {
  const sync = useInvalidateEscrow();
  return useMutation({
    mutationFn: (id: string) => escrowApi.unblock(id),
    onSuccess: (escrow) => { sync(escrow); toast.success('Fonds débloqués', { id: 'escrow-unblocked' }); },
    onError: (error) => toast.error('Impossible de débloquer les fonds', { id: 'escrow-error', description: getApiErrorMessage(error) }),
  });
}

export function useRefundEscrow() {
  const sync = useInvalidateEscrow();
  return useMutation({
    mutationFn: (id: string) => escrowApi.refund(id),
    onSuccess: (escrow) => { sync(escrow); toast.success('Remboursement effectué', { id: 'escrow-refunded', description: "L'acheteur a été remboursé." }); },
    onError: (error) => toast.error("Impossible d'effectuer le remboursement", { id: 'escrow-error', description: getApiErrorMessage(error) }),
  });
}

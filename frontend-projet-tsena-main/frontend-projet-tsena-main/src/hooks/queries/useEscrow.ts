import { useQuery } from '@tanstack/react-query';
import { escrowApi } from '../../api/escrow.api';
import { queryKeys } from '../../lib/query-keys';
import { isNotFoundError } from '../../lib/api-error';
import { useAuth } from '../../context/AuthContext';
import type { ApiEscrow } from '../../types/api';

export function useEscrowByOrder(orderId: string | undefined, options: { enabled?: boolean } = {}) {
  const { isAuthenticated } = useAuth();
  return useQuery<ApiEscrow | null>({
    queryKey: queryKeys.escrow.byOrder(orderId ?? ''),
    queryFn: async () => {
      try {
        return await escrowApi.getByOrder(orderId as string);
      } catch (error) {
        if (isNotFoundError(error)) return null;
        throw error;
      }
    },
    enabled: isAuthenticated && !!orderId && (options.enabled ?? true),
  });
}

export function useEscrowStats() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.escrow.stats(),
    queryFn: () => escrowApi.stats(),
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
  });
}

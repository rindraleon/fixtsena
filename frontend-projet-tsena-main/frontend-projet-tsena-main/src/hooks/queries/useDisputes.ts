import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { disputesApi } from '../../api/disputes.api';
import { queryKeys } from '../../lib/query-keys';
import { useAuth } from '../../context/AuthContext';
import type { DisputeFilters } from '../../types/api';

export function useDisputes(filters: DisputeFilters = {}, options: { enabled?: boolean } = {}) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.disputes.list(filters),
    queryFn: () => disputesApi.list(filters),
    enabled: isAuthenticated && (options.enabled ?? true),
    placeholderData: keepPreviousData,
  });
}

export function useDispute(id: string | undefined) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.disputes.detail(id ?? ''),
    queryFn: () => disputesApi.getById(id as string),
    enabled: isAuthenticated && !!id,
  });
}

export function useDisputeEvidence(id: string | undefined) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.disputes.evidence(id ?? ''),
    queryFn: () => disputesApi.evidence(id as string),
    enabled: isAuthenticated && !!id,
  });
}

export function useDisputeStats() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.disputes.stats(),
    queryFn: () => disputesApi.stats(),
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
  });
}

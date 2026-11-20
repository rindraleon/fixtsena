import { useQuery } from '@tanstack/react-query';
import { addressesApi } from '../../api/addresses.api';
import { queryKeys } from '../../lib/query-keys';

export function useAddresses(enabled = true) {
  return useQuery({
    queryKey: queryKeys.addresses.list(),
    queryFn: () => addressesApi.list(),
    enabled,
    staleTime: 60 * 1000,
  });
}

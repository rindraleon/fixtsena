import { QueryClient } from '@tanstack/react-query';
import { normalizeApiError } from './api-error';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          const { kind } = normalizeApiError(error);
          if (kind === 'network' || kind === 'timeout' || kind === 'server') return failureCount < 1;
          return false;
        },
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        gcTime: 5 * 60 * 1000,
        staleTime: 0,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

export const queryClient = createQueryClient();

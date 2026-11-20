import { useQuery } from '@tanstack/react-query';
import { authApi } from '../../api/auth.api';
import { queryKeys } from '../../lib/query-keys';
import { useAuth } from '../../context/AuthContext';

export function useCurrentUser() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: authApi.me,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRegisterOptions() {
  return useQuery({
    queryKey: queryKeys.auth.registerOptions(),
    queryFn: authApi.registerOptions,
    staleTime: 60 * 1000,
    retry: 1,
  });
}

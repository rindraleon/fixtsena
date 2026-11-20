import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminApi, usersApi } from '../../api/users.api';
import { queryKeys } from '../../lib/query-keys';
import { useAuth } from '../../context/AuthContext';
import type { AdminReportParams, UserFilters } from '../../types/api';

export function useUsers(filters: UserFilters = {}) {
  const { isAuthenticated, hasRole } = useAuth();
  return useQuery({
    queryKey: queryKeys.users.list(filters),
    queryFn: () => usersApi.list(filters),
    enabled: isAuthenticated && hasRole('admin'),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  });
}

export function useUser(id: string | undefined) {
  const { isAuthenticated, hasRole } = useAuth();
  return useQuery({
    queryKey: queryKeys.users.detail(id ?? ''),
    queryFn: () => usersApi.getById(id as string),
    enabled: isAuthenticated && hasRole('admin') && !!id,
  });
}

export function useAdminDashboard() {
  const { isAuthenticated, hasRole } = useAuth();
  return useQuery({
    queryKey: queryKeys.admin.dashboard(),
    queryFn: adminApi.dashboard,
    enabled: isAuthenticated && hasRole('admin'),
    staleTime: 30 * 1000,
  });
}

export function useAdminReport(params: AdminReportParams = {}, options: { enabled?: boolean } = {}) {
  const { isAuthenticated, hasRole } = useAuth();
  return useQuery({
    queryKey: queryKeys.admin.report({ ...params }),
    queryFn: () => adminApi.report(params),
    enabled: (options.enabled ?? true) && isAuthenticated && hasRole('admin'),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  });
}

export function useAuditLogs(params: { page?: number; limit?: number; action?: string; userId?: string } = {}) {
  const { isAuthenticated, hasRole } = useAuth();
  return useQuery({
    queryKey: queryKeys.admin.auditLogs(params),
    queryFn: () => adminApi.auditLogs(params),
    enabled: isAuthenticated && hasRole('admin'),
    placeholderData: keepPreviousData,
  });
}

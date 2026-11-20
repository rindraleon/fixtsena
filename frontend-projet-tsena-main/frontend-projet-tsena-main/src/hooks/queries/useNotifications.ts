import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { notificationsApi } from '../../api/notifications.api';
import { settingsApi } from '../../api/settings.api';
import { queryKeys } from '../../lib/query-keys';
import type { NotificationFilters } from '../../types/api';

export function useNotifications(filters: NotificationFilters = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.notifications.list(filters),
    queryFn: () => notificationsApi.list(filters),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
    staleTime: 15 * 1000,
  });
}

export function useNotificationsUnreadCount(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: () => notificationsApi.unreadCount(),
    enabled: options.enabled ?? true,
    staleTime: 15 * 1000,
    refetchInterval: 45 * 1000,
  });
}

export function useAdminEmailLogs(params: { status?: 'sent' | 'failed' | 'skipped'; page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.notifications.emailLogs(params),
    queryFn: () => notificationsApi.adminEmailLogs(params),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  });
}

export function usePublicSettings() {
  return useQuery({
    queryKey: queryKeys.settings.public(),
    queryFn: () => settingsApi.public(),
    staleTime: 10 * 60 * 1000,
  });
}

export function useAdminSettings() {
  return useQuery({
    queryKey: queryKeys.settings.admin(),
    queryFn: () => settingsApi.adminAll(),
    staleTime: 60 * 1000,
  });
}

import { get, getPaginated, post } from './client';
import type { ApiEmailLog, ApiNotification, NotificationFilters, Paginated } from '../types/api';

export const notificationsApi = {
  list: (filters: NotificationFilters = {}): Promise<Paginated<ApiNotification>> =>
    getPaginated<ApiNotification>('/notifications', filters as Record<string, unknown>),

  unreadCount: () => get<{ count: number }>('/notifications/unread-count'),

  markRead: (id: string) => post<ApiNotification>(`/notifications/${id}/read`),

  markAllRead: () => post<{ updated: number }>('/notifications/read-all'),

  adminEmailLogs: (params: { status?: 'sent' | 'failed' | 'skipped'; page?: number; limit?: number } = {}): Promise<Paginated<ApiEmailLog>> =>
    getPaginated<ApiEmailLog>('/admin/email-logs', params),
};

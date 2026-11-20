import { del, get, put } from './client';
import type { AdminSettings, PublicSettings } from '../types/api';

export const settingsApi = {
  public: () => get<PublicSettings>('/settings/public'),

  adminAll: () => get<AdminSettings>('/admin/settings'),

  adminUpdate: (values: Record<string, unknown>) => put<Record<string, unknown>>('/admin/settings', values),

  adminReset: (key: string) => del<Record<string, unknown>>(`/admin/settings/${encodeURIComponent(key)}`),
};

import { cleanParams, del, downloadFile, get, getPaginated, patch, post } from './client';
import type {
  ApiProduct,
  ApiUser,
  AuditLog,
  CreateUserDto,
  AdminPeriodReport,
  AdminReportParams,
  AdminReportType,
  DashboardStats,
  Paginated,
  UpdateUserDto,
  UserFilters,
} from '../types/api';

export const usersApi = {
  list: (filters: UserFilters = {}): Promise<Paginated<ApiUser>> =>
    getPaginated<ApiUser>('/users', filters as Record<string, unknown>),

  getById: (id: string) => get<ApiUser>(`/users/${id}`),

  requestSellerAccount: () => post<ApiUser>('/users/me/seller-request'),

  create: (dto: CreateUserDto) => post<ApiUser>('/users', dto),

  update: (id: string, dto: UpdateUserDto) => patch<ApiUser>(`/users/${id}`, dto),

  remove: (id: string) => del<null>(`/users/${id}`),
};

export const adminApi = {
  dashboard: () => get<DashboardStats>('/admin/dashboard'),

  auditLogs: (params: Record<string, unknown> = {}): Promise<Paginated<AuditLog>> =>
    getPaginated<AuditLog>('/admin/audit-logs', params),

  report: (params: AdminReportParams = {}) =>
    get<AdminPeriodReport>('/admin/reports', { params: cleanParams({ ...params }) }),

  exportReport: (type: AdminReportType, params: AdminReportParams = {}) =>
    downloadFile('/admin/reports/export', { type, ...params }, `tsena-${type}.csv`),

  suspendUser: (id: string, reason?: string) => post<ApiUser>(`/admin/users/${id}/suspend`, { reason }),

  activateUser: (id: string) => post<ApiUser>(`/admin/users/${id}/activate`),

  approveSeller: (id: string) => post<ApiUser>(`/admin/users/${id}/approve-seller`),

  approveProduct: (id: string) => post<ApiProduct>(`/admin/products/${id}/approve`),

  rejectProduct: (id: string, reason: string) => post<ApiProduct>(`/admin/products/${id}/reject`, { reason }),

  suspendProduct: (id: string, reason: string) => post<ApiProduct>(`/admin/products/${id}/suspend`, { reason }),
};

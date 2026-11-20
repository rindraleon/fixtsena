import { del, get, getPaginated, patch, post } from './client';
import type {
  AdminShopStats,
  ApiShop,
  Paginated,
  ShopEligibility,
  ShopFilters,
  ShopFollowResult,
  ShopLevel,
  ShopStatus,
  UpsertShopDto,
} from '../types/api';

export const shopsApi = {
  list: (filters: ShopFilters = {}): Promise<Paginated<ApiShop>> =>
    getPaginated<ApiShop>('/shops', filters as Record<string, unknown>),

  getByIdOrSlug: (idOrSlug: string) => get<ApiShop>(`/shops/${encodeURIComponent(idOrSlug)}`),

  mine: () => get<ApiShop | null>('/shops/me'),

  eligibility: () => get<ShopEligibility>('/shops/me/eligibility'),

  followed: (params: { page?: number; limit?: number } = {}): Promise<Paginated<ApiShop>> =>
    getPaginated<ApiShop>('/shops/followed', params),

  create: (dto: UpsertShopDto & { name: string }) => post<ApiShop>('/shops', dto),

  update: (dto: UpsertShopDto) => patch<ApiShop>('/shops/me', dto),

  submit: () => post<ApiShop>('/shops/me/submit'),

  uploadLogo: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return post<ApiShop>('/shops/me/logo', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },

  uploadCover: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return post<ApiShop>('/shops/me/cover', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },

  follow: (shopId: string) => post<ShopFollowResult>(`/shops/${shopId}/follow`),

  unfollow: (shopId: string) => del<ShopFollowResult>(`/shops/${shopId}/follow`),

  adminStats: () => get<AdminShopStats>('/admin/shops/stats'),

  adminSetStatus: (shopId: string, dto: { status: ShopStatus; reason?: string }) =>
    patch<ApiShop>(`/admin/shops/${shopId}/status`, dto),

  adminSetIdentity: (shopId: string, dto: { verified: boolean; reason?: string }) =>
    patch<ApiShop>(`/admin/shops/${shopId}/identity`, dto),

  adminSetLevel: (shopId: string, dto: { level: ShopLevel; reason?: string }) =>
    patch<ApiShop>(`/admin/shops/${shopId}/level`, dto),
};

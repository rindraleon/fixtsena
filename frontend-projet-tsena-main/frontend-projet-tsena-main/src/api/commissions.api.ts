import { del, get, post, put } from './client';
import type {
  CommissionGrid,
  CommissionQuote,
  CommissionTier,
  DeliveryZone,
  SaveDeliveryZoneDto,
  UpsertCommissionRateDto,
} from '../types/api';

export const commissionsApi = {
  deliveryZones: () => get<DeliveryZone[]>('/delivery-zones'),

  preview: (params: { categoryId?: string; price?: number; sellerId?: string }) =>
    get<CommissionQuote>('/commissions/preview', { params }),

  grid: () => get<CommissionGrid>('/admin/commissions'),

  upsertRate: (dto: UpsertCommissionRateDto) => put<unknown>('/admin/commissions', dto),

  removeRate: (categoryId: string, tier: CommissionTier) => del<null>(`/admin/commissions/${categoryId}/${tier}`),

  seedGrid: () => post<{ created: number; updated?: number }>('/admin/commissions/seed'),

  adminZones: () => get<DeliveryZone[]>('/admin/delivery-zones'),

  createZone: (dto: SaveDeliveryZoneDto) => post<DeliveryZone>('/admin/delivery-zones', dto),

  updateZone: (id: string, dto: SaveDeliveryZoneDto) => put<DeliveryZone>(`/admin/delivery-zones/${id}`, dto),

  removeZone: (id: string) => del<null>(`/admin/delivery-zones/${id}`),
};

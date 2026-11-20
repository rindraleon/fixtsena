import { get, getPaginated, post } from './client';
import type {
  ApiPromotion,
  CreatePromotionDto,
  Paginated,
  PromotionOffers,
  PromotionStats,
  PromotionStatus,
  PromotionType,
} from '../types/api';

export const promotionsApi = {
  offers: () => get<PromotionOffers>('/promotions/offers'),

  myOffers: () => get<PromotionOffers>('/promotions/offers/me'),

  mine: (params: { status?: PromotionStatus; page?: number; limit?: number } = {}): Promise<Paginated<ApiPromotion>> =>
    getPaginated<ApiPromotion>('/promotions/me', params),

  create: (dto: CreatePromotionDto) => post<ApiPromotion>('/promotions', dto),

  pay: (id: string, method: string) => post<ApiPromotion>(`/promotions/${id}/pay`, { method }),

  cancel: (id: string) => post<ApiPromotion>(`/promotions/${id}/cancel`),

  adminList: (params: { status?: PromotionStatus; type?: PromotionType; page?: number; limit?: number } = {}): Promise<Paginated<ApiPromotion>> =>
    getPaginated<ApiPromotion>('/admin/promotions', params),

  adminStats: () => get<PromotionStats>('/admin/promotions/stats'),

  adminStop: (id: string, reason?: string) => post<ApiPromotion>(`/admin/promotions/${id}/stop`, { reason }),
};

import { del, get, getPaginated, patch, post } from './client';
import type {
  ApiReview,
  CreateReviewDto,
  Paginated,
  ReviewAverage,
  ReviewFilters,
  UpdateReviewDto,
} from '../types/api';

export const reviewsApi = {
  list: (filters: ReviewFilters = {}): Promise<Paginated<ApiReview>> =>
    getPaginated<ApiReview>('/reviews', filters as Record<string, unknown>),

  getById: (id: string) => get<ApiReview>(`/reviews/${id}`),

  averageForUser: (userId: string) => get<ReviewAverage>(`/reviews/user/${userId}/average`),

  create: (dto: CreateReviewDto) => post<ApiReview>('/reviews', dto),

  update: (id: string, dto: UpdateReviewDto) => patch<ApiReview>(`/reviews/${id}`, dto),

  remove: (id: string) => del<null>(`/reviews/${id}`),

  reply: (id: string, reply: string) => post<ApiReview>(`/reviews/${id}/reply`, { reply }),

  report: (id: string, reason: string) => post<ApiReview>(`/reviews/${id}/report`, { reason }),

  moderate: (id: string, dto: { isVisible: boolean; reason?: string }) => patch<ApiReview>(`/reviews/${id}/moderate`, dto),
};

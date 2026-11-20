import { get, getPaginated, post } from './client';
import type {
  ApiSubscription,
  MySubscription,
  Paginated,
  SubscribeDto,
  SubscribeResult,
  SubscriptionChangePreview,
  SubscriptionPlan,
  SubscriptionPlanOffer,
  SubscriptionStatus,
} from '../types/api';

export const subscriptionsApi = {
  plans: () => get<SubscriptionPlanOffer[]>('/subscriptions/plans'),

  mine: () => get<MySubscription>('/subscriptions/me'),

  subscribe: (dto: SubscribeDto) => post<SubscribeResult>('/subscriptions', dto),

  previewChange: (plan: SubscriptionPlan) =>
    get<SubscriptionChangePreview>('/subscriptions/preview', { params: { plan } }),

  pay: (id: string, method: string) => post<ApiSubscription>(`/subscriptions/${id}/pay`, { method }),

  cancel: (id: string) => post<ApiSubscription>(`/subscriptions/${id}/cancel`),

  adminList: (params: { status?: SubscriptionStatus; plan?: SubscriptionPlan; page?: number; limit?: number } = {}): Promise<Paginated<ApiSubscription>> =>
    getPaginated<ApiSubscription>('/admin/subscriptions', params),
};

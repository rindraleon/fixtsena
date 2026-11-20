import { get, getPaginated, post } from './client';
import type { ApiPayment, InitiatePaymentDto, InitiatePaymentResult, Paginated, PaymentFilters, PaymentStats } from '../types/api';

export const paymentsApi = {
  initiate: (dto: InitiatePaymentDto) => post<InitiatePaymentResult>('/payments/initiate', dto),

  getById: (id: string) => get<ApiPayment>(`/payments/${id}`),

  getByOrder: (orderId: string) => get<ApiPayment[]>(`/payments/order/${orderId}`),

  getByTransaction: (transactionId: string) =>
    get<ApiPayment>(`/payments/transaction/${encodeURIComponent(transactionId)}`),

  list: (params: PaymentFilters = {}): Promise<Paginated<ApiPayment>> =>
    getPaginated<ApiPayment>('/payments', params as Record<string, unknown>),

  stats: () => get<PaymentStats>('/payments/stats'),

  simulateSuccess: (id: string) => post<ApiPayment>(`/payments/${id}/simulate-success`),

  confirm: (id: string) => post<ApiPayment>(`/payments/${id}/confirm`),
};

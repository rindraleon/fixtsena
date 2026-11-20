import { get, post } from './client';
import type { ApiEscrow, EscrowStats } from '../types/api';

export const escrowApi = {
  getByOrder: (orderId: string) => get<ApiEscrow>(`/escrow/order/${orderId}`),

  getById: (id: string) => get<ApiEscrow>(`/escrow/${id}`),

  stats: () => get<EscrowStats>('/escrow/stats'),

  release: (id: string) => post<ApiEscrow>(`/escrow/${id}/release`),

  block: (id: string, reason: string) => post<ApiEscrow>(`/escrow/${id}/block`, { reason }),

  unblock: (id: string) => post<ApiEscrow>(`/escrow/${id}/unblock`),

  refund: (id: string) => post<ApiEscrow>(`/escrow/${id}/refund`),
};

import { del, get, post, put } from './client';
import type { ApiBadge, BadgeDto, BadgeEvaluation, BadgeStats, BadgeUserStats, UserBadge } from '../types/api';

export const badgesApi = {
  list: (includeInactive = false) => get<ApiBadge[]>('/badges', { params: includeInactive ? { includeInactive: true } : undefined }),

  forUser: (userId: string) => get<UserBadge[]>(`/badges/user/${userId}`),

  stats: () => get<BadgeStats>('/badges/stats'),

  userStats: (userId: string) => get<BadgeUserStats>(`/badges/user/${userId}/stats`),

  create: (dto: BadgeDto) => post<ApiBadge>('/badges', dto),

  update: (id: string, dto: Partial<BadgeDto>) => put<ApiBadge>(`/badges/${id}`, dto),

  remove: (id: string) => del<null>(`/badges/${id}`),

  award: (userId: string, badgeId: string) => post<UserBadge>('/badges/award', { userId, badgeId }),

  revoke: (userId: string, badgeId: string) => del<null>(`/badges/award/${userId}/${badgeId}`),

  evaluate: (userId: string) => post<BadgeEvaluation>(`/badges/evaluate/${userId}`),

  seedDefaults: () => post<{ created: number }>('/badges/seed-defaults'),
};

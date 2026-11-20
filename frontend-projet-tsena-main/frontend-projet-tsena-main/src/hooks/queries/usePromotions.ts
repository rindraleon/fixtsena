import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { promotionsApi } from '../../api/promotions.api';
import { queryKeys } from '../../lib/query-keys';
import type { PromotionStatus, PromotionType } from '../../types/api';

export function usePromotionOffers() {
  return useQuery({
    queryKey: queryKeys.promotions.offers(),
    queryFn: () => promotionsApi.offers(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useMyPromotionOffers(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.promotions.myOffers(),
    queryFn: () => promotionsApi.myOffers(),
    enabled: options.enabled ?? true,
    staleTime: 60 * 1000,
  });
}

export function useMyPromotions(params: { status?: PromotionStatus; page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.promotions.mine(params),
    queryFn: () => promotionsApi.mine(params),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  });
}

export function useAdminPromotions(params: { status?: PromotionStatus; type?: PromotionType; page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.promotions.adminList(params),
    queryFn: () => promotionsApi.adminList(params),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  });
}

export function useAdminPromotionStats() {
  return useQuery({
    queryKey: queryKeys.promotions.adminStats(),
    queryFn: () => promotionsApi.adminStats(),
    staleTime: 60 * 1000,
  });
}

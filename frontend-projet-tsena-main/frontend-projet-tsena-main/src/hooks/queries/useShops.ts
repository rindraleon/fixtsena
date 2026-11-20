import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { shopsApi } from '../../api/shops.api';
import { subscriptionsApi } from '../../api/subscriptions.api';
import { queryKeys } from '../../lib/query-keys';
import type { ShopFilters, SubscriptionPlan, SubscriptionStatus } from '../../types/api';

export function useShops(filters: ShopFilters = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.shops.list(filters),
    queryFn: () => shopsApi.list(filters),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
    staleTime: 60 * 1000,
  });
}

export function useShop(idOrSlug: string | undefined) {
  return useQuery({
    queryKey: queryKeys.shops.detail(idOrSlug ?? ''),
    queryFn: () => shopsApi.getByIdOrSlug(idOrSlug as string),
    enabled: !!idOrSlug,
    staleTime: 60 * 1000,
  });
}

export function useMyShop(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.shops.mine(),
    queryFn: () => shopsApi.mine(),
    enabled: options.enabled ?? true,
    staleTime: 30 * 1000,
  });
}

export function useShopEligibility(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.shops.eligibility(),
    queryFn: () => shopsApi.eligibility(),
    enabled: options.enabled ?? true,
    staleTime: 60 * 1000,
  });
}

export function useFollowedShops(params: { page?: number; limit?: number } = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.shops.followed(params),
    queryFn: () => shopsApi.followed(params),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
    staleTime: 30 * 1000,
  });
}

export function useAdminShopStats() {
  return useQuery({
    queryKey: queryKeys.shops.adminStats(),
    queryFn: () => shopsApi.adminStats(),
    staleTime: 60 * 1000,
  });
}

export function useSubscriptionPlans() {
  return useQuery({
    queryKey: queryKeys.subscriptions.plans(),
    queryFn: () => subscriptionsApi.plans(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useMySubscription(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.subscriptions.mine(),
    queryFn: () => subscriptionsApi.mine(),
    enabled: options.enabled ?? true,
    staleTime: 30 * 1000,
  });
}

export function useSubscriptionChangePreview(plan: SubscriptionPlan | null, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.subscriptions.preview(plan ?? ''),
    queryFn: () => subscriptionsApi.previewChange(plan as SubscriptionPlan),
    enabled: (options.enabled ?? true) && !!plan,
    staleTime: 30 * 1000,
  });
}

export function useAdminSubscriptions(params: { status?: SubscriptionStatus; plan?: SubscriptionPlan; page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.subscriptions.adminList(params),
    queryFn: () => subscriptionsApi.adminList(params),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  });
}

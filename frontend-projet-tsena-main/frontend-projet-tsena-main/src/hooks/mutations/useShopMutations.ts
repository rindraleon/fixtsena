import { useMutation, useQueryClient } from '@tanstack/react-query';
import { shopsApi } from '../../api/shops.api';
import { subscriptionsApi } from '../../api/subscriptions.api';
import { queryKeys } from '../../lib/query-keys';
import { toast, TOAST_MESSAGES } from '../../lib/toast';
import { getApiErrorMessage } from '../../lib/api-error';
import type { ApiShop, ShopLevel, ShopStatus, SubscribeDto, UpsertShopDto } from '../../types/api';

function useInvalidateShops() {
  const queryClient = useQueryClient();
  return (shop?: ApiShop | null) => {
    if (shop) {
      queryClient.setQueryData(queryKeys.shops.mine(), shop);
      queryClient.setQueryData(queryKeys.shops.detail(shop.slug), shop);
      queryClient.setQueryData(queryKeys.shops.detail(shop.id), shop);
    }
    void queryClient.invalidateQueries({ queryKey: queryKeys.shops.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
  };
}

export function useCreateShop() {
  const invalidate = useInvalidateShops();
  return useMutation({
    mutationFn: (dto: UpsertShopDto & { name: string }) => shopsApi.create(dto),
    onSuccess: (shop) => {
      invalidate(shop);
      toast.success(TOAST_MESSAGES.shops.created, { id: 'shop-created' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'shop-error' }),
  });
}

export function useUpdateShop() {
  const invalidate = useInvalidateShops();
  return useMutation({
    mutationFn: (dto: UpsertShopDto) => shopsApi.update(dto),
    onSuccess: (shop) => {
      invalidate(shop);
      toast.success(TOAST_MESSAGES.shops.updated, { id: 'shop-updated' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'shop-error' }),
  });
}

export function useSubmitShop() {
  const invalidate = useInvalidateShops();
  return useMutation({
    mutationFn: () => shopsApi.submit(),
    onSuccess: (shop) => {
      invalidate(shop);
      toast.success(TOAST_MESSAGES.shops.submitted, { id: 'shop-submitted' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'shop-error' }),
  });
}

export function useUploadShopImage() {
  const invalidate = useInvalidateShops();
  return useMutation({
    mutationFn: ({ kind, file }: { kind: 'logo' | 'cover'; file: File }) =>
      kind === 'logo' ? shopsApi.uploadLogo(file) : shopsApi.uploadCover(file),
    onSuccess: (shop, { kind }) => {
      invalidate(shop);
      toast.success(kind === 'logo' ? TOAST_MESSAGES.shops.logoUpdated : TOAST_MESSAGES.shops.coverUpdated, { id: 'shop-image' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'shop-image-error' }),
  });
}

export function useToggleFollowShop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ shopId, follow }: { shopId: string; follow: boolean; slug?: string }) =>
      follow ? shopsApi.follow(shopId) : shopsApi.unfollow(shopId),
    onSuccess: (result, { shopId, slug, follow }) => {
      const patch = (shop: ApiShop | undefined) =>
        shop ? { ...shop, isFollowing: result.following, followersCount: result.followersCount } : shop;
      queryClient.setQueryData<ApiShop | undefined>(queryKeys.shops.detail(shopId), patch);
      if (slug) queryClient.setQueryData<ApiShop | undefined>(queryKeys.shops.detail(slug), patch);
      void queryClient.invalidateQueries({ queryKey: queryKeys.shops.all });
      toast.success(follow ? TOAST_MESSAGES.shops.followed : TOAST_MESSAGES.shops.unfollowed, { id: 'shop-follow' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'shop-follow-error' }),
  });
}

export function useAdminUpdateShop() {
  const invalidate = useInvalidateShops();
  return useMutation({
    mutationFn: (input:
      | { shopId: string; action: 'status'; status: ShopStatus; reason?: string }
      | { shopId: string; action: 'identity'; verified: boolean; reason?: string }
      | { shopId: string; action: 'level'; level: ShopLevel; reason?: string }) => {
      if (input.action === 'status') return shopsApi.adminSetStatus(input.shopId, { status: input.status, reason: input.reason });
      if (input.action === 'identity') return shopsApi.adminSetIdentity(input.shopId, { verified: input.verified, reason: input.reason });
      return shopsApi.adminSetLevel(input.shopId, { level: input.level, reason: input.reason });
    },
    onSuccess: (shop) => {
      invalidate(shop);
      toast.success(TOAST_MESSAGES.shops.statusUpdated, { id: 'shop-admin-updated' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'shop-admin-error' }),
  });
}

function useInvalidateSubscriptions() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.shops.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.promotions.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.commissions.all });
  };
}

export function useSubscribe() {
  const invalidate = useInvalidateSubscriptions();
  return useMutation({
    mutationFn: (dto: SubscribeDto) => subscriptionsApi.subscribe(dto),
    onSuccess: (created) => {
      invalidate();
      toast.success(created.changeMessage || TOAST_MESSAGES.subscriptions.created, { id: 'subscription-created' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'subscription-error' }),
  });
}

export function usePaySubscription() {
  const invalidate = useInvalidateSubscriptions();
  return useMutation({
    mutationFn: ({ id, method }: { id: string; method: string }) => subscriptionsApi.pay(id, method),
    onSuccess: (paid) => {
      invalidate();
      const message =
        paid.status === 'scheduled' && paid.startsAt
          ? TOAST_MESSAGES.subscriptions.scheduled(new Date(paid.startsAt).toLocaleDateString('fr-FR'))
          : TOAST_MESSAGES.subscriptions.paid;
      toast.success(message, { id: 'subscription-paid' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'subscription-error' }),
  });
}

export function useCancelSubscription() {
  const invalidate = useInvalidateSubscriptions();
  return useMutation({
    mutationFn: (id: string) => subscriptionsApi.cancel(id),
    onSuccess: () => {
      invalidate();
      toast.success(TOAST_MESSAGES.subscriptions.cancelled, { id: 'subscription-cancelled' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'subscription-error' }),
  });
}

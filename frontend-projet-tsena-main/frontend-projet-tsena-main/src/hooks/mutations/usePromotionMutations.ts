import { useMutation, useQueryClient } from '@tanstack/react-query';
import { promotionsApi } from '../../api/promotions.api';
import { queryKeys } from '../../lib/query-keys';
import { toast, TOAST_MESSAGES } from '../../lib/toast';
import { getApiErrorMessage } from '../../lib/api-error';
import type { CreatePromotionDto } from '../../types/api';

function useInvalidatePromotions() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.promotions.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
  };
}

export function useCreatePromotion() {
  const invalidate = useInvalidatePromotions();
  return useMutation({
    mutationFn: (dto: CreatePromotionDto) => promotionsApi.create(dto),
    onSuccess: () => {
      invalidate();
      toast.success(TOAST_MESSAGES.promotions.created, { id: 'promotion-created' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'promotion-error' }),
  });
}

export function usePayPromotion() {
  const invalidate = useInvalidatePromotions();
  return useMutation({
    mutationFn: ({ id, method }: { id: string; method: string }) => promotionsApi.pay(id, method),
    onSuccess: () => {
      invalidate();
      toast.success(TOAST_MESSAGES.promotions.paid, { id: 'promotion-paid' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'promotion-error' }),
  });
}

export function useCancelPromotion() {
  const invalidate = useInvalidatePromotions();
  return useMutation({
    mutationFn: (id: string) => promotionsApi.cancel(id),
    onSuccess: () => {
      invalidate();
      toast.success(TOAST_MESSAGES.promotions.cancelled, { id: 'promotion-cancelled' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'promotion-error' }),
  });
}

export function useAdminStopPromotion() {
  const invalidate = useInvalidatePromotions();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => promotionsApi.adminStop(id, reason),
    onSuccess: () => {
      invalidate();
      toast.success(TOAST_MESSAGES.promotions.stopped, { id: 'promotion-stopped' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'promotion-error' }),
  });
}

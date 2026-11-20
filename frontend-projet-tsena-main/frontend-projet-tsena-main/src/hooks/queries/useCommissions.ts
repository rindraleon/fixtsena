import { useQuery } from '@tanstack/react-query';
import { commissionsApi } from '../../api/commissions.api';
import { ordersApi } from '../../api/orders.api';
import { queryKeys } from '../../lib/query-keys';

export function useDeliveryZones(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.commissions.zones(),
    queryFn: () => commissionsApi.deliveryZones(),
    enabled: options.enabled ?? true,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCheckoutQuote(deliveryZoneId: string | undefined, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.checkout.quote(deliveryZoneId),
    queryFn: () => ordersApi.checkoutQuote(deliveryZoneId),
    enabled: options.enabled ?? true,
    staleTime: 0,
  });
}

export function useCommissionPreview(params: { categoryId?: string; price?: number }, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.commissions.preview(params),
    queryFn: () => commissionsApi.preview(params),
    enabled: (options.enabled ?? true) && !!params.categoryId,
    staleTime: 60 * 1000,
  });
}

export function useCommissionGrid() {
  return useQuery({
    queryKey: queryKeys.commissions.grid(),
    queryFn: () => commissionsApi.grid(),
    staleTime: 60 * 1000,
  });
}

export function useAdminDeliveryZones() {
  return useQuery({
    queryKey: queryKeys.commissions.adminZones(),
    queryFn: () => commissionsApi.adminZones(),
    staleTime: 60 * 1000,
  });
}

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { productsApi } from '../../api/products.api';
import { queryKeys } from '../../lib/query-keys';
import { useAuth } from '../../context/AuthContext';
import type { ProductFilters } from '../../types/api';

export function useProducts(filters: ProductFilters = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.products.list(filters),
    queryFn: () => productsApi.list(filters),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    enabled: options.enabled ?? true,
  });
}

export function useProduct(idOrSlug: string | undefined) {
  return useQuery({
    queryKey: queryKeys.products.detail(idOrSlug ?? ''),
    queryFn: () => productsApi.getByIdOrSlug(idOrSlug as string),
    enabled: !!idOrSlug,
    staleTime: 60 * 1000,
  });
}

export function useFeaturedProducts(limit = 8) {
  return useQuery({
    queryKey: queryKeys.products.featured(limit),
    queryFn: () => productsApi.featured(limit),
    staleTime: 2 * 60 * 1000,
  });
}

export function useSellerProductStats() {
  const { isAuthenticated, hasRole } = useAuth();
  return useQuery({
    queryKey: queryKeys.products.sellerStats(),
    queryFn: productsApi.sellerStats,
    enabled: isAuthenticated && hasRole('seller', 'admin'),
    staleTime: 30 * 1000,
  });
}

export function useProductLocations() {
  return useQuery({
    queryKey: queryKeys.products.locations(),
    queryFn: () => productsApi.locations(),
    staleTime: 5 * 60 * 1000,
  });
}

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { categoriesApi } from '../../api/categories.api';
import { queryKeys } from '../../lib/query-keys';
import type { CategoryFilters } from '../../types/api';

export function useCategories(filters: CategoryFilters = {}) {
  return useQuery({
    queryKey: queryKeys.categories.list(filters as Record<string, unknown>),
    queryFn: () => categoriesApi.list(filters),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCategoryTree() {
  return useQuery({
    queryKey: queryKeys.categories.tree(),
    queryFn: categoriesApi.tree,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCategory(idOrSlug: string | undefined) {
  return useQuery({
    queryKey: queryKeys.categories.detail(idOrSlug ?? ''),
    queryFn: () => categoriesApi.getByIdOrSlug(idOrSlug as string),
    enabled: !!idOrSlug,
    staleTime: 60 * 1000,
  });
}

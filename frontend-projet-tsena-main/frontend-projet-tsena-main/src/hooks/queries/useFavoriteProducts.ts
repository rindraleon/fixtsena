import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { productsApi } from '../../api/products.api';
import { queryKeys } from '../../lib/query-keys';
import { useFavorites } from '../../context/FavoritesContext';
import { isNotFoundError } from '../../lib/api-error';
import type { ApiProduct } from '../../types/api';

export function useFavoriteProducts() {
  const { favorites } = useFavorites();

  const queries = useQueries({
    queries: favorites.map((favorite) => ({
      queryKey: queryKeys.products.detail(favorite.id),
      queryFn: () => productsApi.getByIdOrSlug(favorite.id),
      staleTime: 60 * 1000,
    })),
  });

  return useMemo(() => {
    const products: ApiProduct[] = [];
    const unavailableIds: string[] = [];
    let firstError: unknown = null;

    queries.forEach((query, index) => {
      const favoriteId = favorites[index]?.id;
      if (query.data) products.push(query.data);
      else if (query.error && favoriteId) {
        if (isNotFoundError(query.error)) unavailableIds.push(favoriteId);
        else firstError ??= query.error;
      }
    });

    return {
      products,
      unavailableIds,
      error: firstError,
      isPending: queries.some((query) => query.isPending),
      isFetching: queries.some((query) => query.isFetching),
      refetch: () => Promise.all(queries.map((query) => query.refetch())),
    };
  }, [queries, favorites]);
}

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { reviewsApi } from '../../api/reviews.api';
import { queryKeys } from '../../lib/query-keys';
import type { ReviewFilters } from '../../types/api';

export function useReviews(filters: ReviewFilters = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.reviews.list(filters),
    queryFn: () => reviewsApi.list(filters),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
    staleTime: 60 * 1000,
  });
}

export function useUserReviewAverage(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.reviews.average(userId ?? ''),
    queryFn: () => reviewsApi.averageForUser(userId as string),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewsApi } from '../../api/reviews.api';
import { queryKeys } from '../../lib/query-keys';
import { toast, TOAST_MESSAGES } from '../../lib/toast';
import { getApiErrorMessage } from '../../lib/api-error';
import type { CreateReviewDto, UpdateReviewDto } from '../../types/api';

function useInvalidateReviews() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.all });
  };
}

export function useCreateReview() {
  const invalidate = useInvalidateReviews();
  return useMutation({
    mutationFn: (dto: CreateReviewDto) => reviewsApi.create(dto),
    onSuccess: () => {
      invalidate();
      toast.success(TOAST_MESSAGES.reviews.created, { id: 'review-created' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'review-error' }),
  });
}

export function useUpdateReview() {
  const invalidate = useInvalidateReviews();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateReviewDto }) => reviewsApi.update(id, dto),
    onSuccess: () => {
      invalidate();
      toast.success(TOAST_MESSAGES.reviews.updated, { id: 'review-updated' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'review-error' }),
  });
}

export function useDeleteReview() {
  const invalidate = useInvalidateReviews();
  return useMutation({
    mutationFn: (id: string) => reviewsApi.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success(TOAST_MESSAGES.reviews.deleted, { id: 'review-deleted' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'review-delete-error' }),
  });
}

export function useReplyToReview() {
  const invalidate = useInvalidateReviews();
  return useMutation({
    mutationFn: ({ id, reply }: { id: string; reply: string }) => reviewsApi.reply(id, reply),
    onSuccess: () => {
      invalidate();
      toast.success(TOAST_MESSAGES.reviews.replied, { id: 'review-replied' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'review-reply-error' }),
  });
}

export function useReportReview() {
  const invalidate = useInvalidateReviews();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => reviewsApi.report(id, reason),
    onSuccess: () => {
      invalidate();
      toast.success(TOAST_MESSAGES.reviews.reported, { id: 'review-reported' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'review-report-error' }),
  });
}

export function useModerateReview() {
  const invalidate = useInvalidateReviews();
  return useMutation({
    mutationFn: ({ id, isVisible, reason }: { id: string; isVisible: boolean; reason?: string }) =>
      reviewsApi.moderate(id, { isVisible, reason }),
    onSuccess: (review) => {
      invalidate();
      toast.success(review.isVisible ? 'Avis rétabli' : 'Avis masqué', { id: 'review-moderated' });
    },
    onError: (error) => toast.error(getApiErrorMessage(error), { id: 'review-moderate-error' }),
  });
}

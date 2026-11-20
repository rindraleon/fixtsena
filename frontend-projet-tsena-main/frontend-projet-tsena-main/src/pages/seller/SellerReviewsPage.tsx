import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageSquare, Star } from 'lucide-react';
import { useTitle } from '../../hooks';
import { useAuth } from '../../context/AuthContext';
import { useReviews, useUserReviewAverage } from '../../hooks/queries/useReviews';
import { useReplyToReview, useReportReview } from '../../hooks/mutations/useReviewMutations';
import { ReviewCard, ReportReviewDialog, StarRating } from '../../components/reviews';
import { EmptyState, ErrorState, LoadingState, Pagination } from '../../components/common';
import PageHeader from '../../shared/components/PageHeader';
import type { ApiReview } from '../../types/api';

const PAGE_SIZE = 10;

export default function SellerReviewsPage() {
  useTitle('Avis clients | Vendeur');
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const reviewsQuery = useReviews({ reviewedId: user?.id, page, limit: PAGE_SIZE }, { enabled: !!user });
  const averageQuery = useUserReviewAverage(user?.id);
  const replyToReview = useReplyToReview();
  const reportReview = useReportReview();
  const [reporting, setReporting] = useState<ApiReview | null>(null);

  const reviews = reviewsQuery.data?.items ?? [];
  const meta = reviewsQuery.data?.meta;
  const average = averageQuery.data;

  return (
    <div className="max-w-3xl">
      <PageHeader title="Avis clients" subtitle="Ce que vos clients pensent de votre boutique — vous pouvez répondre publiquement à chaque avis" />

      <section className="bg-surface rounded-xl border border-border p-5 mb-6 flex items-center gap-5" aria-label="Note moyenne">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0"><Star size={26} fill="currentColor" /></div>
        {averageQuery.isPending ? (
          <LoadingState variant="inline" label="Calcul de la note..." />
        ) : averageQuery.isError ? (
          <ErrorState error={averageQuery.error} onRetry={() => void averageQuery.refetch()} compact />
        ) : (
          <div>
            <p className="text-3xl font-bold text-text leading-none">{average && average.reviewCount > 0 ? average.averageRating.toFixed(1) : '—'}<span className="text-base font-normal text-muted"> / 5</span></p>
            <div className="flex items-center gap-2 mt-1.5">
              <StarRating value={Math.round(average?.averageRating ?? 0)} size={14} />
              <span className="text-xs text-muted">{average?.reviewCount ?? 0} avis</span>
            </div>
          </div>
        )}
      </section>

      {reviewsQuery.isPending ? (
        <LoadingState variant="list" count={3} />
      ) : reviewsQuery.isError ? (
        <ErrorState error={reviewsQuery.error} onRetry={() => void reviewsQuery.refetch()} retrying={reviewsQuery.isFetching} />
      ) : reviews.length === 0 ? (
        <EmptyState icon={MessageSquare} title="Aucun avis pour le moment" description="Les avis laissés par vos clients après livraison apparaîtront ici." />
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              person={review.reviewer}
              personRole="Client"
              onReply={(r, reply) => replyToReview.mutateAsync({ id: r.id, reply })}
              replying={replyToReview.isPending}
              onReport={setReporting}
              disabled={reportReview.isPending}
            />
          ))}
          {meta && meta.totalPages > 1 && <Pagination currentPage={page} totalPages={meta.totalPages} onPageChange={(p) => setSearchParams({ page: String(p) }, { replace: true })} />}
        </div>
      )}

      <ReportReviewDialog
        review={reporting}
        loading={reportReview.isPending}
        onConfirm={(review, reason) => reportReview.mutate({ id: review.id, reason }, { onSettled: () => setReporting(null) })}
        onCancel={() => setReporting(null)}
      />
    </div>
  );
}

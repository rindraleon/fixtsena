import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { useTitle } from '../../hooks';
import { useAuth } from '../../context/AuthContext';
import { useReviews } from '../../hooks/queries/useReviews';
import { useDeleteReview } from '../../hooks/mutations/useReviewMutations';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import { ReviewCard, ReviewFormDialog } from '../../components/reviews';
import { ConfirmDialog, EmptyState, ErrorState, LoadingState, Pagination } from '../../components/common';
import PageHeader from '../../shared/components/PageHeader';
import type { ApiReview } from '../../types/api';

const PAGE_SIZE = 10;

export default function ClientReviewsPage() {
  useTitle('Mes avis');
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const reviewsQuery = useReviews({ reviewerId: user?.id, page, limit: PAGE_SIZE }, { enabled: !!user });
  const deleteReview = useDeleteReview();
  const confirmDelete = useConfirmAction<ApiReview>();
  const [editing, setEditing] = useState<ApiReview | null>(null);

  const reviews = reviewsQuery.data?.items ?? [];
  const meta = reviewsQuery.data?.meta;

  return (
    <div className="max-w-3xl">
      <PageHeader title="Mes avis" subtitle={meta ? `${meta.total} avis publié${meta.total > 1 ? 's' : ''}` : 'Les avis que vous avez laissés aux vendeurs'} />

      {reviewsQuery.isPending ? (
        <LoadingState variant="list" count={3} />
      ) : reviewsQuery.isError ? (
        <ErrorState error={reviewsQuery.error} onRetry={() => void reviewsQuery.refetch()} retrying={reviewsQuery.isFetching} />
      ) : reviews.length === 0 ? (
        <EmptyState icon={MessageSquare} title="Aucun avis" description="Après la livraison d'une commande, vous pourrez évaluer le vendeur depuis le détail de la commande." action={{ label: 'Voir mes commandes', to: '/dashboard/client/mes-commandes' }} />
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} person={review.reviewed} personRole="Vendeur" onEdit={setEditing} onDelete={confirmDelete.request} disabled={deleteReview.isPending} />
          ))}
          {meta && meta.totalPages > 1 && <Pagination currentPage={page} totalPages={meta.totalPages} onPageChange={(p) => setSearchParams({ page: String(p) }, { replace: true })} />}
        </div>
      )}

      <ReviewFormDialog open={!!editing} onClose={() => setEditing(null)} review={editing ?? undefined} />

      <ConfirmDialog
        open={confirmDelete.isOpen}
        variant="destructive"
        title="Supprimer cet avis ?"
        description="Votre avis sera définitivement retiré de la page du vendeur."
        confirmLabel="Supprimer"
        loadingLabel="Suppression..."
        loading={deleteReview.isPending}
        onConfirm={() => void confirmDelete.run((review) => deleteReview.mutateAsync(review.id))}
        onCancel={confirmDelete.cancel}
      />
    </div>
  );
}

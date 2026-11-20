import { useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { X, MessageSquare } from 'lucide-react';
import { Button } from '../common';
import { FormError, FormField } from '../form';
import StarRating from './StarRating';
import { useCreateReview, useUpdateReview } from '../../hooks/mutations/useReviewMutations';
import { getFieldErrors } from '../../lib/api-error';
import type { ApiReview } from '../../types/api';

interface ReviewFormDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly orderId?: string;
  readonly reviewedId?: string;
  readonly reviewedName?: string;
  readonly review?: ApiReview;
  readonly productId?: string;
  readonly productName?: string;
}

const COMMENT_MAX = 1000;

export default function ReviewFormDialog({ open, onClose, orderId, reviewedId, reviewedName, review, productId, productName }: ReviewFormDialogProps) {
  const isEdit = !!review;
  const createReview = useCreateReview();
  const updateReview = useUpdateReview();
  const mutation = isEdit ? updateReview : createReview;
  const [rating, setRating] = useState(review?.rating ?? 0);
  const [productRating, setProductRating] = useState(review?.productRating ?? 0);
  const [deliveryRating, setDeliveryRating] = useState(review?.deliveryRating ?? 0);
  const [comment, setComment] = useState(review?.comment ?? '');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRating(review?.rating ?? 0);
    setProductRating(review?.productRating ?? 0);
    setDeliveryRating(review?.deliveryRating ?? 0);
    setComment(review?.comment ?? '');
    setSubmitted(false);
    createReview.reset();
    updateReview.reset();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !mutation.isPending) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, review?.id]);

  if (!open) return null;

  const serverErrors = getFieldErrors(mutation.error);
  const ratingError = serverErrors.rating ?? (submitted && rating === 0 ? 'Veuillez attribuer une note.' : undefined);
  const commentError = serverErrors.comment ?? (submitted && comment.length > COMMENT_MAX ? `Le commentaire ne doit pas dépasser ${COMMENT_MAX} caractères.` : undefined);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (rating === 0 || comment.length > COMMENT_MAX || mutation.isPending) return;
    const trimmed = comment.trim();
    if (isEdit && review) {
      updateReview.mutate({ id: review.id, dto: { rating, comment: trimmed || undefined } }, { onSuccess: onClose });
    } else if (orderId && reviewedId) {
      createReview.mutate(
        {
          orderId,
          reviewedId,
          rating,
          comment: trimmed || undefined,
          productRating: productRating || undefined,
          deliveryRating: deliveryRating || undefined,
          productId: productId || undefined,
        },
        { onSuccess: onClose },
      );
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="review-dialog-title">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => !mutation.isPending && onClose()} aria-hidden="true" />
      <form onSubmit={submit} noValidate className="relative w-full sm:max-w-lg bg-surface rounded-t-2xl sm:rounded-2xl shadow-2xl border border-border animate-scale-in" aria-busy={mutation.isPending}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 id="review-dialog-title" className="font-semibold text-text flex items-center gap-2"><MessageSquare size={18} className="text-primary" /> {isEdit ? 'Modifier mon avis' : 'Laisser un avis'}</h2>
          <button type="button" onClick={onClose} disabled={mutation.isPending} className="p-2 rounded-lg hover:bg-surface-tertiary text-muted" aria-label="Fermer"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {reviewedName && !isEdit && <p className="text-sm text-muted">Votre expérience avec <span className="font-medium text-text">{reviewedName}</span> aidera d'autres acheteurs.</p>}
          {mutation.isError && <FormError error={mutation.error} handledFields={['rating', 'comment']} />}
          <div>
            <p className="block text-sm font-medium text-text mb-1.5">Note du vendeur <span className="text-danger">*</span></p>
            <StarRating value={rating} onChange={setRating} size={28} />
            {ratingError && <p className="text-xs text-danger mt-1" role="alert">{ratingError}</p>}
          </div>
          {!isEdit && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl bg-surface-secondary/50 p-3" data-testid="review-extra-ratings">
              <div>
                <p className="block text-sm font-medium text-text mb-1">Produit{productName ? <span className="block text-[11px] font-normal text-muted truncate">{productName}</span> : <span className="text-xs font-normal text-muted"> (facultatif)</span>}</p>
                <StarRating value={productRating} onChange={setProductRating} size={22} />
              </div>
              <div>
                <p className="block text-sm font-medium text-text mb-1">Livraison <span className="text-xs font-normal text-muted">(facultatif)</span></p>
                <StarRating value={deliveryRating} onChange={setDeliveryRating} size={22} />
              </div>
            </div>
          )}
          <FormField as="textarea" label="Commentaire" value={comment} onChange={(e) => setComment(e.target.value)} rows={4} maxLength={COMMENT_MAX} placeholder="Qualité du produit, délai de livraison, communication…" hint={`${comment.length}/${COMMENT_MAX}`} error={commentError} />
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border bg-surface-secondary/40 rounded-b-2xl">
          <Button type="button" variant="ghost" onClick={onClose} disabled={mutation.isPending}>Annuler</Button>
          <Button type="submit" loading={mutation.isPending} loadingLabel={isEdit ? 'Enregistrement...' : 'Publication...'}>{isEdit ? 'Enregistrer' : "Publier l'avis"}</Button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

import { useState, type FormEvent } from 'react';
import { CornerDownRight, EyeOff, Flag, Package, Pencil, Trash2, Truck, User, Store, MessageSquareReply } from 'lucide-react';
import StarRating from './StarRating';
import { Button } from '../common';
import { FormField } from '../form';
import { formatDate, partyName } from '../../lib/format';
import type { ApiReview, ReviewUserSummary } from '../../types/api';
import { resolveMediaUrl } from '../../lib/media';

interface ReviewCardProps {
  readonly review: ApiReview;
  readonly person: ReviewUserSummary | null;
  readonly personRole: 'Client' | 'Vendeur' | 'Acheteur';
  readonly onEdit?: (review: ApiReview) => void;
  readonly onDelete?: (review: ApiReview) => void;
  readonly onReply?: (review: ApiReview, reply: string) => Promise<unknown> | void;
  readonly replying?: boolean;
  readonly onReport?: (review: ApiReview) => void;
  readonly disabled?: boolean;
  readonly showModeration?: boolean;
}

export default function ReviewCard({ review, person, personRole, onEdit, onDelete, onReply, replying, onReport, disabled, showModeration }: ReviewCardProps) {
  const name = partyName(person);
  const [replyOpen, setReplyOpen] = useState(false);
  const [reply, setReply] = useState('');
  const [replySubmitted, setReplySubmitted] = useState(false);
  const replyError = replySubmitted && reply.trim().length < 2 ? 'Écrivez votre réponse (2 caractères minimum).' : undefined;

  const submitReply = (event: FormEvent) => {
    event.preventDefault();
    setReplySubmitted(true);
    if (!onReply || reply.trim().length < 2) return;
    void Promise.resolve(onReply(review, reply.trim())).then(() => { setReplyOpen(false); setReply(''); setReplySubmitted(false); });
  };

  return (
    <article className={`bg-surface rounded-xl border p-4 sm:p-5 flex gap-4 ${review.isVisible ? 'border-border' : 'border-dashed border-amber-300 dark:border-amber-500/40'}`} data-testid="review-card">
      <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 overflow-hidden">
        {person?.avatarUrl ? <img src={resolveMediaUrl(person.avatarUrl)} alt="" className="w-full h-full object-cover" /> : <User size={20} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-text truncate">{name} <span className="text-xs font-normal text-muted">· {personRole}</span></p>
            <p className="text-xs text-muted">
              {formatDate(review.createdAt)}{review.orderNumber ? <> · Commande <span className="font-mono">{review.orderNumber}</span></> : null}
              {review.updatedAt && review.updatedAt !== review.createdAt ? ' · modifié' : ''}
            </p>
          </div>
          <StarRating value={review.rating} size={16} />
        </div>

        {(review.productRating || review.deliveryRating) ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-muted" data-testid="review-sub-ratings">
            {review.productRating ? <span className="inline-flex items-center gap-1"><Package size={12} /> Produit <StarRating value={review.productRating} size={11} /></span> : null}
            {review.deliveryRating ? <span className="inline-flex items-center gap-1"><Truck size={12} /> Livraison <StarRating value={review.deliveryRating} size={11} /></span> : null}
            {review.product && <span className="inline-flex items-center gap-1 truncate">· {review.product.name}</span>}
          </div>
        ) : null}

        {review.comment ? <p className="text-sm text-text mt-2 whitespace-pre-line break-words">{review.comment}</p> : <p className="text-sm text-muted italic mt-2">Aucun commentaire.</p>}

        {review.sellerReply && (
          <div className="mt-3 rounded-lg bg-surface-secondary/60 border border-border/70 p-3 flex gap-2" data-testid="review-seller-reply">
            <CornerDownRight size={14} className="text-primary shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-text flex items-center gap-1"><Store size={12} /> Réponse du vendeur <span className="font-normal text-muted">· {formatDate(review.sellerRepliedAt)}</span></p>
              <p className="text-sm text-text mt-1 whitespace-pre-line break-words">{review.sellerReply}</p>
            </div>
          </div>
        )}

        {showModeration && (
          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
            {!review.isVisible && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"><EyeOff size={11} /> Masqué{review.moderationReason ? ` — ${review.moderationReason}` : ''}</span>}
            {review.reportedAt && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"><Flag size={11} /> Signalé le {formatDate(review.reportedAt)}{review.reportReason ? ` — ${review.reportReason}` : ''}</span>}
          </div>
        )}

        {(onEdit || onDelete || onReply || onReport) && (
          <div className="flex flex-wrap gap-1 mt-3 -ml-1.5">
            {onEdit && <button type="button" onClick={() => onEdit(review)} disabled={disabled} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-muted hover:text-primary hover:bg-surface-tertiary disabled:opacity-50"><Pencil size={13} /> Modifier</button>}
            {onDelete && <button type="button" onClick={() => onDelete(review)} disabled={disabled} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-muted hover:text-danger hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50"><Trash2 size={13} /> Supprimer</button>}
            {onReply && !review.sellerReply && !replyOpen && <button type="button" onClick={() => setReplyOpen(true)} disabled={disabled} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50" data-testid="review-reply-button"><MessageSquareReply size={13} /> Répondre publiquement</button>}
            {onReport && !review.reportedAt && <button type="button" onClick={() => onReport(review)} disabled={disabled} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-muted hover:text-danger hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50" data-testid="review-report-button"><Flag size={13} /> Signaler</button>}
            {onReport && review.reportedAt && <span className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted"><Flag size={13} /> Signalé</span>}
          </div>
        )}

        {replyOpen && onReply && (
          <form onSubmit={submitReply} noValidate className="mt-3 space-y-2" data-testid="review-reply-form">
            <FormField as="textarea" label="Votre réponse publique" rows={3} value={reply} onChange={(e) => setReply(e.target.value)} maxLength={1000} error={replyError} hint="Visible par tous. Une réponse ne peut être ni modifiée ni supprimée : restez factuel et courtois." autoFocus />
            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => { setReplyOpen(false); setReply(''); setReplySubmitted(false); }} disabled={replying}>Annuler</Button>
              <Button type="submit" size="sm" loading={replying} loadingLabel="Publication...">Publier la réponse</Button>
            </div>
          </form>
        )}
      </div>
    </article>
  );
}

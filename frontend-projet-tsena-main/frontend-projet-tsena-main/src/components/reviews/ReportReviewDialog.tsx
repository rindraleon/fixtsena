import { useState, type FormEvent } from 'react';
import { ConfirmDialog } from '../common';
import { FormField } from '../form';
import type { ApiReview } from '../../types/api';

interface ReportReviewDialogProps {
  readonly review: ApiReview | null;
  readonly loading?: boolean;
  readonly onConfirm: (review: ApiReview, reason: string) => void;
  readonly onCancel: () => void;
}

export default function ReportReviewDialog({ review, loading, onConfirm, onCancel }: ReportReviewDialogProps) {
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const error = submitted && reason.trim().length < 5 ? 'Précisez le motif (5 caractères minimum).' : undefined;

  const confirm = () => {
    setSubmitted(true);
    if (!review || reason.trim().length < 5) return;
    onConfirm(review, reason.trim());
  };

  const handleSubmit = (e: FormEvent) => { e.preventDefault(); confirm(); };

  return (
    <ConfirmDialog
      open={!!review}
      variant="destructive"
      title="Signaler cet avis ?"
      description="Un administrateur examinera votre signalement. L'avis reste visible jusqu'à décision de la modération."
      confirmLabel="Envoyer le signalement"
      loadingLabel="Envoi..."
      loading={loading}
      onConfirm={confirm}
      onCancel={() => { setReason(''); setSubmitted(false); onCancel(); }}
    >
      <form onSubmit={handleSubmit} noValidate>
        <FormField as="textarea" label="Motif" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} error={error} placeholder="Propos injurieux, contenu hors sujet, avis manifestement faux…" required autoFocus />
      </form>
    </ConfirmDialog>
  );
}

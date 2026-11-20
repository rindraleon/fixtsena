import { useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from '../common';
import { FormError, FormField } from '../form';
import { useCreateDispute } from '../../hooks/mutations/useDisputeMutations';
import { getFieldErrors } from '../../lib/api-error';
import { DISPUTE_REASON_LABELS, type DisputeReasonCode } from '../../types/api';

interface DisputeFormDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly orderId: string;
  readonly orderNumber: string;
}

const REASON_MIN = 20;
const REASON_MAX = 1000;
const REASON_CODES = Object.keys(DISPUTE_REASON_LABELS) as DisputeReasonCode[];

export default function DisputeFormDialog({ open, onClose, orderId, orderNumber }: DisputeFormDialogProps) {
  const createDispute = useCreateDispute();
  const [reason, setReason] = useState('');
  const [reasonCode, setReasonCode] = useState<DisputeReasonCode | ''>('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason('');
    setReasonCode('');
    setSubmitted(false);
    createDispute.reset();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !createDispute.isPending) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const trimmed = reason.trim();
  const clientError = trimmed.length < REASON_MIN ? `Décrivez le problème en au moins ${REASON_MIN} caractères.` : trimmed.length > REASON_MAX ? `Le motif ne doit pas dépasser ${REASON_MAX} caractères.` : undefined;
  const serverErrors = getFieldErrors(createDispute.error);
  const reasonError = serverErrors.reason ?? (submitted ? clientError : undefined);
  const reasonCodeError = serverErrors.reasonCode ?? (submitted && !reasonCode ? 'Choisissez le motif principal du litige.' : undefined);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (clientError || !reasonCode || createDispute.isPending) return;
    createDispute.mutate({ orderId, reason: trimmed, reasonCode }, { onSuccess: onClose });
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="dispute-dialog-title">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => !createDispute.isPending && onClose()} aria-hidden="true" />
      <form onSubmit={submit} noValidate className="relative w-full sm:max-w-lg bg-surface rounded-t-2xl sm:rounded-2xl shadow-2xl border border-border animate-scale-in" aria-busy={createDispute.isPending}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 id="dispute-dialog-title" className="font-semibold text-text flex items-center gap-2"><AlertTriangle size={18} className="text-orange-500" /> Signaler un problème</h2>
          <button type="button" onClick={onClose} disabled={createDispute.isPending} className="p-2 rounded-lg hover:bg-surface-tertiary text-muted" aria-label="Fermer"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-muted">Commande <span className="font-mono font-medium text-text">{orderNumber}</span>. Un administrateur examinera votre signalement ; les fonds séquestrés resteront bloqués jusqu'à la décision.</p>
          {createDispute.isError && <FormError error={createDispute.error} handledFields={['reason', 'reasonCode']} />}
          <FormField as="select" label="Motif du litige" value={reasonCode} onChange={(e) => setReasonCode(e.target.value as DisputeReasonCode | '')} error={reasonCodeError} required data-testid="dispute-reason-code">
            <option value="">— Sélectionnez un motif —</option>
            {REASON_CODES.map((code) => <option key={code} value={code}>{DISPUTE_REASON_LABELS[code]}</option>)}
          </FormField>
          <FormField as="textarea" label="Description du problème" value={reason} onChange={(e) => setReason(e.target.value)} rows={5} maxLength={REASON_MAX} placeholder="Décrivez précisément ce qui s'est passé (dates, état du colis, échanges avec l'autre partie…)" hint={`${reason.length}/${REASON_MAX}`} error={reasonError} required />
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border bg-surface-secondary/40 rounded-b-2xl">
          <Button type="button" variant="ghost" onClick={onClose} disabled={createDispute.isPending}>Annuler</Button>
          <Button type="submit" variant="danger" loading={createDispute.isPending} loadingLabel="Envoi..." data-testid="dispute-submit">Envoyer le signalement</Button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

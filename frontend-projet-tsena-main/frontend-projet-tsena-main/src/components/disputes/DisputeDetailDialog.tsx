import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Scale, Paperclip, FileText, Upload, Gavel, User, Store, ExternalLink, FolderOpen, Search, MessageSquareWarning, Lock, Undo2, Tag } from 'lucide-react';
import StatusBadge from '../../shared/components/StatusBadge';
import { Button, ConfirmDialog, ErrorState, LoadingState } from '../common';
import { FormError, FormField } from '../form';
import { useDispute, useDisputeEvidence } from '../../hooks/queries/useDisputes';
import { useAddDisputeEvidence, useResolveDispute, useUpdateDisputeStatus } from '../../hooks/mutations/useDisputeMutations';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import { useAuth } from '../../context/AuthContext';
import { formatDateTime, formatPrice, partyName } from '../../lib/format';
import { getFieldErrors } from '../../lib/api-error';
import type { AppRole } from '../../types/auth';
import type { ApiDispute, DisputeDecision, DisputeStatus, DisputeStatusAction } from '../../types/api';
import { DISPUTE_REASON_LABELS } from '../../types/api';
import { resolveMediaUrl } from '../../lib/media';

interface DisputeDetailDialogProps {
  readonly disputeId: string | null;
  readonly role: AppRole;
  readonly onClose: () => void;
  readonly orderHref?: (dispute: ApiDispute) => string;
}

const EVIDENCE_OPEN_STATUSES: readonly DisputeStatus[] = ['reported', 'open', 'awaiting_evidence'];
const RESOLVABLE_STATUSES: readonly DisputeStatus[] = ['reported', 'open', 'awaiting_evidence', 'under_review'];
const DECIDED_STATUSES: readonly DisputeStatus[] = ['resolved_buyer', 'resolved_seller', 'partial_resolution'];

const ADMIN_STATUS_ACTIONS: Record<DisputeStatus, DisputeStatusAction[]> = {
  reported: ['open', 'under_review', 'awaiting_evidence'],
  open: ['under_review', 'awaiting_evidence'],
  awaiting_evidence: ['under_review'],
  under_review: ['awaiting_evidence'],
  resolved_buyer: ['closed'],
  resolved_seller: ['closed'],
  partial_resolution: ['closed'],
  closed: [],
  cancelled: [],
};

const STATUS_ACTION_META: Record<DisputeStatusAction, { label: string; icon: typeof FolderOpen; description: string; noteRequired: boolean; variant: 'default' | 'warning' | 'destructive' }> = {
  open: { label: 'Ouvrir le dossier', icon: FolderOpen, description: 'Le signalement est pris en charge ; les parties en sont informées.', noteRequired: false, variant: 'default' },
  under_review: { label: "Passer en cours d'analyse", icon: Search, description: 'Le dossier est en cours d’instruction par l’administration.', noteRequired: false, variant: 'default' },
  awaiting_evidence: { label: 'Demander des informations', icon: MessageSquareWarning, description: 'Précisez les éléments attendus (photos, justificatifs, précisions) : la demande est transmise aux deux parties.', noteRequired: true, variant: 'default' },
  closed: { label: 'Clôturer le litige', icon: Lock, description: 'Le dossier est clos après application de la décision ; plus aucune modification ne sera possible.', noteRequired: false, variant: 'warning' },
  cancelled: { label: 'Retirer mon signalement', icon: Undo2, description: 'Le litige sera annulé et la commande reprendra son cours normal (fonds débloqués).', noteRequired: false, variant: 'destructive' },
};
const EVIDENCE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
const EVIDENCE_MAX_MB = 5;

const DECISIONS: { value: DisputeDecision; label: string; description: string }[] = [
  { value: 'resolved_buyer', label: "En faveur de l'acheteur", description: 'Remboursement intégral, commande remboursée.' },
  { value: 'resolved_seller', label: 'En faveur du vendeur', description: 'Fonds libérés au vendeur, commande livrée.' },
  { value: 'partial_resolution', label: 'Résolution partielle', description: 'Remboursement partiel selon un pourcentage.' },
];

function isImageUrl(url: string): boolean {
  return /\.(jpe?g|png|webp|gif)(\?.*)?$/i.test(url);
}

export default function DisputeDetailDialog({ disputeId, role, onClose, orderHref }: DisputeDetailDialogProps) {
  const open = disputeId !== null;
  const { user } = useAuth();
  const disputeQuery = useDispute(disputeId ?? undefined);
  const evidenceQuery = useDisputeEvidence(disputeId ?? undefined);
  const addEvidence = useAddDisputeEvidence();
  const resolveDispute = useResolveDispute();
  const updateStatus = useUpdateDisputeStatus();
  const confirmResolve = useConfirmAction<true>();
  const confirmStatus = useConfirmAction<DisputeStatusAction>();
  const [statusNote, setStatusNote] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [evidenceDescription, setEvidenceDescription] = useState('');
  const [evidenceError, setEvidenceError] = useState('');
  const [decision, setDecision] = useState<DisputeDecision>('resolved_buyer');
  const [adminDecision, setAdminDecision] = useState('');
  const [refundPercentage, setRefundPercentage] = useState('50');
  const [resolveSubmitted, setResolveSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEvidenceDescription(''); setEvidenceError(''); setDecision('resolved_buyer'); setAdminDecision(''); setRefundPercentage('50'); setResolveSubmitted(false);
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);

  const dispute = disputeQuery.data;
  const isParty = !!dispute && !!user && (dispute.reporterId === user.id || dispute.buyerId === user.id || dispute.sellerId === user.id);
  const canAddEvidence = !!dispute && isParty && EVIDENCE_OPEN_STATUSES.includes(dispute.status);
  const canResolve = role === 'admin' && !!dispute && RESOLVABLE_STATUSES.includes(dispute.status);
  const statusActions: DisputeStatusAction[] = dispute
    ? role === 'admin'
      ? ADMIN_STATUS_ACTIONS[dispute.status]
      : user && dispute.reporterId === user.id && (dispute.status === 'reported' || dispute.status === 'open') ? ['cancelled'] : []
    : [];
  const pendingStatusAction = confirmStatus.target ? STATUS_ACTION_META[confirmStatus.target] : null;
  const statusNoteMissing = !!pendingStatusAction?.noteRequired && statusNote.trim().length < 5;

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !dispute) return;
    setEvidenceError('');
    if (!EVIDENCE_TYPES.includes(file.type)) { setEvidenceError('Format non pris en charge (image ou PDF).'); return; }
    if (file.size > EVIDENCE_MAX_MB * 1024 * 1024) { setEvidenceError(`Le fichier dépasse ${EVIDENCE_MAX_MB} Mo.`); return; }
    addEvidence.mutate({ disputeId: dispute.id, file, description: evidenceDescription.trim() || undefined }, { onSuccess: () => setEvidenceDescription('') });
  };

  const percentage = Number(refundPercentage);
  const resolveClientErrors = {
    adminDecision: adminDecision.trim().length < 10 ? 'Motivez la décision (10 caractères minimum).' : undefined,
    refundPercentage: decision === 'partial_resolution' && (!Number.isFinite(percentage) || percentage <= 0 || percentage >= 100) ? 'Indiquez un pourcentage entre 1 et 99.' : undefined,
  };
  const resolveServerErrors = getFieldErrors(resolveDispute.error);
  const resolveErrors = {
    adminDecision: resolveServerErrors.adminDecision ?? (resolveSubmitted ? resolveClientErrors.adminDecision : undefined),
    refundPercentage: resolveServerErrors.refundPercentage ?? (resolveSubmitted ? resolveClientErrors.refundPercentage : undefined),
  };

  const submitResolve = (event: FormEvent) => {
    event.preventDefault();
    setResolveSubmitted(true);
    if (resolveClientErrors.adminDecision || resolveClientErrors.refundPercentage) return;
    confirmResolve.request(true);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div key="dispute-detail" className="fixed inset-0 z-50 flex justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
          <motion.aside role="dialog" aria-modal="true" aria-labelledby="dispute-detail-title" className="relative w-full max-w-xl h-full bg-surface shadow-2xl flex flex-col" initial={{ x: 40 }} animate={{ x: 0 }} exit={{ x: 40 }} transition={{ type: 'spring', stiffness: 320, damping: 32 }}>
            <header className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 id="dispute-detail-title" className="font-bold text-text flex items-center gap-2"><Scale size={18} className="text-primary" /> Litige {dispute?.orderNumber ? <span className="font-mono">{dispute.orderNumber}</span> : ''}</h2>
                {dispute && <p className="text-xs text-muted">Signalé le {formatDateTime(dispute.createdAt)}</p>}
              </div>
              <button type="button" onClick={onClose} className="p-2 rounded-lg text-muted hover:bg-surface-secondary hover:text-text" aria-label="Fermer"><X size={18} /></button>
            </header>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {disputeQuery.isPending ? (
                <LoadingState variant="detail" />
              ) : disputeQuery.isError ? (
                <ErrorState error={disputeQuery.error} onRetry={() => void disputeQuery.refetch()} retrying={disputeQuery.isFetching} compact />
              ) : dispute ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <StatusBadge status={dispute.status} kind="dispute" />
                    {dispute.orderTotal !== null && <span className="text-sm text-muted">Montant : <span className="font-semibold text-text">{formatPrice(dispute.orderTotal)}</span></span>}
                  </div>

                  <section className="grid grid-cols-1 sm:grid-cols-2 gap-2" aria-label="Parties">
                    <div className="bg-surface-secondary rounded-lg px-3 py-2.5 text-sm"><p className="text-[11px] uppercase tracking-wide text-muted flex items-center gap-1"><User size={11} /> Acheteur</p><p className="font-medium text-text truncate">{partyName(dispute.buyer)}</p></div>
                    <div className="bg-surface-secondary rounded-lg px-3 py-2.5 text-sm"><p className="text-[11px] uppercase tracking-wide text-muted flex items-center gap-1"><Store size={11} /> Vendeur</p><p className="font-medium text-text truncate">{partyName(dispute.seller)}</p></div>
                  </section>

                  <section aria-labelledby="dispute-reason-heading">
                    <h3 id="dispute-reason-heading" className="text-sm font-semibold text-text mb-2">Motif du signalement <span className="font-normal text-muted">— par {partyName(dispute.reporter)}</span></h3>
                    {dispute.reasonCode && (
                      <p className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-500/15 px-2.5 py-1 rounded-full mb-2" data-testid="dispute-reason-code-label"><Tag size={11} /> {DISPUTE_REASON_LABELS[dispute.reasonCode] ?? dispute.reasonCode}</p>
                    )}
                    <p className="text-sm text-text bg-surface-secondary rounded-lg px-3 py-2 whitespace-pre-line break-words">{dispute.reason}</p>
                    {dispute.adminNote && dispute.status === 'awaiting_evidence' && (
                      <p className="mt-2 text-xs text-text bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg px-3 py-2 flex items-start gap-2"><MessageSquareWarning size={14} className="shrink-0 mt-0.5 text-amber-600" /> <span><span className="font-semibold">Informations demandées par l'administration :</span> {dispute.adminNote}</span></p>
                    )}
                    {orderHref && dispute.orderNumber && <Link to={orderHref(dispute)} onClick={onClose} className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2">Voir la commande <ExternalLink size={11} /></Link>}
                  </section>

                  {dispute.adminDecision && (
                    <section aria-labelledby="dispute-decision-heading" className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                      <h3 id="dispute-decision-heading" className="text-sm font-semibold text-text mb-1 flex items-center gap-1.5"><Gavel size={14} className="text-primary" /> Décision de l'administration</h3>
                      <p className="text-sm text-text whitespace-pre-line">{dispute.adminDecision}</p>
                      {dispute.resolvedAt && <p className="text-xs text-muted mt-2">Décision rendue le {formatDateTime(dispute.resolvedAt)}{dispute.closedAt ? ` · dossier clos le ${formatDateTime(dispute.closedAt)}` : ''} — décision définitive.</p>}
                    </section>
                  )}

                  {statusActions.length > 0 && (
                    <section aria-labelledby="dispute-followup-heading" data-testid="dispute-status-actions">
                      <h3 id="dispute-followup-heading" className="text-sm font-semibold text-text mb-2">Suivi du dossier</h3>
                      <div className="flex flex-wrap gap-2">
                        {statusActions.map((action) => {
                          const meta = STATUS_ACTION_META[action];
                          const Icon = meta.icon;
                          return (
                            <Button key={action} size="sm" variant={action === 'cancelled' ? 'danger' : action === 'closed' ? 'primary' : 'outline'} icon={Icon} onClick={() => { setStatusNote(''); updateStatus.reset(); confirmStatus.request(action); }} disabled={updateStatus.isPending} data-testid={`dispute-status-${action}`}>
                              {meta.label}
                            </Button>
                          );
                        })}
                      </div>
                      {role === 'admin' && DECIDED_STATUSES.includes(dispute.status) && <p className="text-xs text-muted mt-2">La décision a été appliquée (fonds libérés ou remboursés). Clôturez le dossier pour l'archiver : il deviendra alors immuable.</p>}
                    </section>
                  )}

                  <section aria-labelledby="dispute-evidence-heading">
                    <h3 id="dispute-evidence-heading" className="text-sm font-semibold text-text mb-2 flex items-center gap-1.5"><Paperclip size={14} className="text-primary" /> Pièces justificatives</h3>
                    {evidenceQuery.isPending ? (
                      <LoadingState variant="inline" label="Chargement des pièces..." />
                    ) : evidenceQuery.isError ? (
                      <ErrorState error={evidenceQuery.error} onRetry={() => void evidenceQuery.refetch()} compact />
                    ) : (evidenceQuery.data ?? []).length === 0 ? (
                      <p className="text-sm text-muted">Aucune pièce justificative pour le moment.</p>
                    ) : (
                      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {(evidenceQuery.data ?? []).map((evidence) => (
                          <li key={evidence.id}>
                            <a href={resolveMediaUrl(evidence.url)} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-border overflow-hidden hover:border-primary/40 transition-colors">
                              {isImageUrl(evidence.url) ? <img src={resolveMediaUrl(evidence.url)} alt={evidence.description ?? 'Pièce justificative'} className="w-full h-24 object-cover" /> : <div className="w-full h-24 flex items-center justify-center bg-surface-secondary text-muted"><FileText size={24} /></div>}
                              <p className="text-[11px] text-muted px-2 py-1 truncate">{evidence.description || formatDateTime(evidence.createdAt)}</p>
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                    {canAddEvidence && (
                      <div className="mt-3 space-y-2">
                        <FormField label="Description (optionnel)" value={evidenceDescription} onChange={(e) => setEvidenceDescription(e.target.value)} maxLength={500} placeholder="Ex. photo du colis à réception" />
                        <input ref={fileRef} type="file" accept={EVIDENCE_TYPES.join(',')} className="hidden" onChange={handleFile} aria-label="Joindre une preuve (image ou PDF)" />
                        <Button type="button" variant="outline" size="sm" icon={Upload} onClick={() => fileRef.current?.click()} loading={addEvidence.isPending} loadingLabel="Téléversement...">Ajouter une pièce (image ou PDF)</Button>
                        {evidenceError && <p className="text-xs text-danger" role="alert">{evidenceError}</p>}
                      </div>
                    )}
                  </section>

                  {canResolve && (
                    <form onSubmit={submitResolve} noValidate className="rounded-xl border border-border p-4 space-y-3" aria-busy={resolveDispute.isPending}>
                      <h3 className="text-sm font-semibold text-text flex items-center gap-1.5"><Gavel size={14} className="text-primary" /> Rendre une décision</h3>
                      {resolveDispute.isError && <FormError error={resolveDispute.error} handledFields={['adminDecision', 'refundPercentage']} />}
                      <fieldset className="space-y-2">
                        <legend className="sr-only">Décision</legend>
                        {DECISIONS.map((option) => (
                          <label key={option.value} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${decision === option.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                            <input type="radio" name="decision" value={option.value} checked={decision === option.value} onChange={() => setDecision(option.value)} className="mt-1 accent-primary" />
                            <span><span className="block text-sm font-medium text-text">{option.label}</span><span className="block text-xs text-muted">{option.description}</span></span>
                          </label>
                        ))}
                      </fieldset>
                      {decision === 'partial_resolution' && (
                        <FormField label="Pourcentage remboursé à l'acheteur" type="number" inputMode="numeric" min={1} max={99} value={refundPercentage} onChange={(e) => setRefundPercentage(e.target.value)} error={resolveErrors.refundPercentage} hint={dispute.orderTotal !== null && Number.isFinite(percentage) ? `≈ ${formatPrice((dispute.orderTotal * percentage) / 100)} remboursés` : undefined} required />
                      )}
                      <FormField as="textarea" label="Motivation de la décision" value={adminDecision} onChange={(e) => setAdminDecision(e.target.value)} rows={4} maxLength={2000} error={resolveErrors.adminDecision} hint="Ce texte est communiqué aux deux parties." required />
                      <Button type="submit" icon={Gavel} fullWidth loading={resolveDispute.isPending} loadingLabel="Application de la décision...">Appliquer la décision</Button>
                    </form>
                  )}
                </>
              ) : null}
            </div>
          </motion.aside>

          <ConfirmDialog
            open={confirmStatus.isOpen}
            variant={pendingStatusAction?.variant ?? 'default'}
            title={pendingStatusAction ? `${pendingStatusAction.label} ?` : ''}
            description={pendingStatusAction?.description}
            confirmLabel={pendingStatusAction?.label ?? 'Confirmer'}
            loadingLabel="Mise à jour..."
            loading={updateStatus.isPending}
            onConfirm={() => {
              if (statusNoteMissing) return;
              void confirmStatus.run((status) => updateStatus.mutateAsync({ id: dispute!.id, dto: { status, note: statusNote.trim() || undefined } }));
            }}
            onCancel={confirmStatus.cancel}
          >
            {pendingStatusAction && pendingStatusAction.label !== STATUS_ACTION_META.closed.label && (
              <label className="block text-sm text-text text-left">
                <span className="block font-medium mb-1">{pendingStatusAction.noteRequired ? 'Informations attendues (obligatoire)' : 'Note aux parties (optionnel)'}</span>
                <textarea value={statusNote} onChange={(e) => setStatusNote(e.target.value)} rows={3} maxLength={1000} className="w-full px-3 py-2 border border-input-border bg-input-bg rounded-lg text-sm focus:outline-none focus:border-primary" placeholder={pendingStatusAction.noteRequired ? 'Ex. photo du colis et de l’étiquette, preuve de dépôt du transporteur…' : 'Message transmis aux parties avec la notification'} data-testid="dispute-status-note" />
                {statusNoteMissing && <span className="block text-xs text-danger mt-1">Précisez les informations attendues (5 caractères minimum).</span>}
              </label>
            )}
          </ConfirmDialog>

          <ConfirmDialog
            open={confirmResolve.isOpen}
            variant="destructive"
            title="Appliquer cette décision ?"
            description="La décision est définitive : les fonds seront libérés ou remboursés selon votre choix et les parties seront notifiées."
            confirmLabel="Confirmer la décision"
            loadingLabel="Application..."
            loading={resolveDispute.isPending}
            onConfirm={() => void confirmResolve.run(() => resolveDispute.mutateAsync({ id: dispute!.id, dto: { decision, adminDecision: adminDecision.trim(), refundPercentage: decision === 'partial_resolution' ? percentage : undefined } }))}
            onCancel={confirmResolve.cancel}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

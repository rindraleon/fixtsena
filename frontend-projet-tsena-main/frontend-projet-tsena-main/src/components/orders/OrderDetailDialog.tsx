import { useEffect, useState } from 'react';
import { X, Package, MapPin, CreditCard, ExternalLink, User, Store, Mail, Phone, Star, ShieldCheck, AlertTriangle, Lock, CheckCircle2, Scale, Percent, Truck, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import StatusBadge from '../../shared/components/StatusBadge';
import OrderStatusActions from './OrderStatusActions';
import OrderPaymentRetry from './OrderPaymentRetry';
import OrderTrackingSection from './OrderTrackingSection';
import { LoadingState, ErrorState, Button, ConfirmDialog } from '../common';
import { ReviewFormDialog } from '../reviews';
import { DisputeFormDialog } from '../disputes';
import { useOrder } from '../../hooks/queries/useOrders';
import { usePaymentsByOrder } from '../../hooks/queries/usePayments';
import { useReviews } from '../../hooks/queries/useReviews';
import { useEscrowByOrder } from '../../hooks/queries/useEscrow';
import { useReleaseEscrow } from '../../hooks/mutations/useEscrowMutations';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import { formatDateTime, formatPrice, partyName, paymentMethodLabel } from '../../lib/format';
import type { AppRole } from '../../types/auth';
import type { ApiEscrow, OrderPartySummary } from '../../types/api';
import { DISPUTABLE_ORDER_STATUSES, isOrderPayable } from '../../lib/order-transitions';
import { resolveMediaUrl } from '../../lib/media';
import { COMMISSION_TIER_LABELS } from '../../types/api';
import ContactSellerButton from '../shops/ContactSellerButton';

function escrowState(escrow: ApiEscrow): { label: string; description: string; icon: typeof Lock; tone: string } {
  if (escrow.releasedAt) return { label: 'Fonds libérés au vendeur', description: `Le ${formatDateTime(escrow.releasedAt)}`, icon: CheckCircle2, tone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30' };
  if (escrow.isBlocked) return { label: 'Fonds bloqués (litige en cours)', description: escrow.reason ?? "Un administrateur statuera sur la libération des fonds.", icon: Lock, tone: 'text-orange-600 bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30' };
  return { label: 'Fonds sécurisés en séquestre', description: "Le vendeur sera payé après confirmation de réception par l'acheteur.", icon: ShieldCheck, tone: 'text-primary bg-primary/5 border-primary/20' };
}

function PartyCard({ party, label, icon: Icon }: { party: OrderPartySummary | null; label: string; icon: typeof User }) {
  return (
    <div className="flex items-start gap-3 bg-surface-secondary rounded-lg px-3 py-2.5 text-sm min-w-0">
      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 overflow-hidden">
        {party?.avatarUrl ? <img src={resolveMediaUrl(party.avatarUrl)} alt="" className="w-full h-full object-cover" /> : <Icon size={16} />}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
        <p className="font-medium text-text truncate">{partyName(party)}</p>
        {party?.email && <a href={`mailto:${party.email}`} className="text-xs text-muted hover:text-primary inline-flex items-center gap-1 truncate max-w-full"><Mail size={11} /> <span className="truncate">{party.email}</span></a>}
        {party?.phone && <a href={`tel:${party.phone}`} className="text-xs text-muted hover:text-primary inline-flex items-center gap-1"><Phone size={11} /> {party.phone}</a>}
      </div>
    </div>
  );
}

interface OrderDetailDialogProps {
  readonly orderId: string | null;
  readonly role: AppRole;
  readonly onClose: () => void;
}

const ESCROW_PAYMENT_STATUSES: ReadonlySet<string> = new Set(['success', 'escrow', 'blocked', 'released', 'refunded', 'partially_refunded']);
const PENDING_PAYMENT_STATUSES: ReadonlySet<string> = new Set(['initiated', 'pending', 'processing']);

export default function OrderDetailDialog({ orderId, role, onClose }: OrderDetailDialogProps) {
  const orderQuery = useOrder(orderId ?? undefined);
  const paymentsQuery = usePaymentsByOrder(orderId ?? undefined);
  const open = orderId !== null;
  const [reviewOpen, setReviewOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const payments = paymentsQuery.data;
  const hasEscrowPayment = !!payments && payments.some((payment) => payment.method !== 'cash_on_delivery' && ESCROW_PAYMENT_STATUSES.has(payment.status));
  const paymentInProgress = !!payments && payments.some((payment) => PENDING_PAYMENT_STATUSES.has(payment.status) && payment.method !== 'cash_on_delivery');
  const needsPayment = role === 'client' && orderQuery.data?.status === 'pending' && !!payments && !isOrderPayable(payments) && !paymentInProgress;
  const escrowQuery = useEscrowByOrder(orderId ?? undefined, { enabled: hasEscrowPayment });
  const releaseEscrow = useReleaseEscrow();
  const confirmReception = useConfirmAction<ApiEscrow>();
  const canReview = role === 'client' && orderQuery.data?.status === 'delivered';
  const existingReviewQuery = useReviews({ reviewerId: orderQuery.data?.buyerId, limit: 100 }, { enabled: canReview });
  const alreadyReviewed = (existingReviewQuery.data?.items ?? []).some((review) => review.orderId === orderId);
  const escrow = escrowQuery.data ?? null;
  const canConfirmReception = role === 'client' && orderQuery.data?.status === 'delivered' && !!escrow && !escrow.releasedAt && !escrow.isBlocked;
  const canReport = role !== 'admin' && !!orderQuery.data && DISPUTABLE_ORDER_STATUSES.includes(orderQuery.data.status);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);

  const order = orderQuery.data;

  return (
    <>
    <AnimatePresence>
      {open && (
        <motion.div key="order-detail" className="fixed inset-0 z-50 flex justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-detail-title"
            className="relative w-full max-w-lg h-full bg-surface shadow-2xl flex flex-col"
            initial={{ x: 40 }}
            animate={{ x: 0 }}
            exit={{ x: 40 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          >
            <header className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 id="order-detail-title" className="font-bold text-text flex items-center gap-2"><Package size={18} className="text-primary" /> {order?.orderNumber ?? 'Commande'}</h2>
                {order && <p className="text-xs text-muted">{formatDateTime(order.createdAt)}</p>}
              </div>
              <button type="button" onClick={onClose} className="p-2 rounded-lg text-muted hover:bg-surface-secondary hover:text-text" aria-label="Fermer"><X size={18} /></button>
            </header>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {orderQuery.isPending ? (
                <LoadingState variant="detail" />
              ) : orderQuery.isError ? (
                <ErrorState error={orderQuery.error} onRetry={() => void orderQuery.refetch()} retrying={orderQuery.isFetching} compact />
              ) : order ? (
                <>
                  <div className="flex items-center justify-between">
                    <StatusBadge status={order.status} kind="order" />
                    <span className="text-lg font-bold text-primary">{formatPrice(order.totalAmount)}</span>
                  </div>

                  <section aria-label="Parties" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {role !== 'client' && <PartyCard party={order.buyer} label="Client" icon={User} />}
                    {role !== 'seller' && <PartyCard party={order.seller} label="Vendeur" icon={Store} />}
                  </section>

                  <section aria-labelledby="order-lines-heading">
                    <h3 id="order-lines-heading" className="text-sm font-semibold text-text mb-2">Articles ({order.lines.length})</h3>
                    <ul className="divide-y divide-border border border-border rounded-xl overflow-hidden">
                      {order.lines.map((line) => (
                        <li key={line.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                          <div className="w-11 h-11 rounded-lg bg-surface-secondary overflow-hidden shrink-0">
                            {line.productImage && <img src={resolveMediaUrl(line.productImage)} alt="" className="w-full h-full object-cover" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <Link to={`/produits/${line.productSlug ?? line.productId}`} className="font-medium text-text hover:text-primary inline-flex items-center gap-1 truncate max-w-full">
                              <span className="truncate">{line.productName}</span> <ExternalLink size={12} className="shrink-0" />
                            </Link>
                            <p className="text-xs text-muted">{line.quantity} × {formatPrice(line.unitPrice)}</p>
                          </div>
                          <span className="font-semibold text-text shrink-0">{formatPrice(line.totalPrice)}</span>
                        </li>
                      ))}
                    </ul>
                    <dl className="mt-3 space-y-1 text-sm">
                      <div className="flex justify-between"><dt className="text-muted">Sous-total</dt><dd className="text-text">{formatPrice(order.subtotalAmount)}</dd></div>
                      <div className="flex justify-between"><dt className="text-muted inline-flex items-center gap-1"><Truck size={13} /> Livraison{order.deliveryZoneName ? <span className="text-xs">· {order.deliveryZoneName}</span> : null}</dt><dd className="text-text">{Number(order.shippingAmount) > 0 ? formatPrice(order.shippingAmount) : 'Offerte'}</dd></div>
                      <div className="flex justify-between font-bold border-t border-border pt-2"><dt className="text-text">Total</dt><dd className="text-primary">{formatPrice(order.totalAmount)}</dd></div>
                      {Number(order.refundedAmount) > 0 && (
                        <div className="flex justify-between text-amber-700 dark:text-amber-300" data-testid="order-refunded">
                          <dt className="inline-flex items-center gap-1"><RotateCcw size={13} /> Remboursé à l'acheteur (décision de litige)</dt>
                          <dd className="font-semibold">− {formatPrice(order.refundedAmount)}</dd>
                        </div>
                      )}
                    </dl>
                    {role !== 'client' && order.commissionRate != null && (
                      <dl className="mt-3 rounded-lg border border-border bg-surface-secondary/50 px-3 py-2.5 space-y-1 text-sm" data-testid="order-commission">
                        <div className="flex justify-between">
                          <dt className="text-muted inline-flex items-center gap-1"><Percent size={13} /> Commission Tsena ({Number(order.commissionRate)} %{order.commissionTier ? ` · palier ${COMMISSION_TIER_LABELS[order.commissionTier] ?? order.commissionTier}` : ''})</dt>
                          <dd className="text-text">− {formatPrice(order.commissionAmount)}</dd>
                        </div>
                        <div className="flex justify-between font-semibold">
                          <dt className="text-text">Net vendeur (hors livraison)</dt>
                          <dd className="text-emerald-600 dark:text-emerald-400">{formatPrice(order.sellerNetAmount)}</dd>
                        </div>
                        <p className="text-[11px] text-muted">{Number(order.refundedAmount) > 0 ? 'Commission recalculée après la décision de litige (politique de remboursement de la plateforme) ; taux figé à la création de la commande.' : 'Taux figé à la création de la commande ; définitif après libération des fonds.'}</p>
                      </dl>
                    )}
                  </section>

                  <OrderTrackingSection order={order} role={role} />

                  {order.notes && (
                    <section aria-labelledby="order-notes-heading">
                      <h3 id="order-notes-heading" className="text-sm font-semibold text-text mb-2 flex items-center gap-1.5"><MapPin size={14} className="text-primary" /> Notes de commande</h3>
                      <p className="text-sm text-muted bg-surface-secondary rounded-lg px-3 py-2 whitespace-pre-line">{order.notes}</p>
                    </section>
                  )}

                  <section aria-labelledby="order-escrow-heading">
                    <h3 id="order-escrow-heading" className="text-sm font-semibold text-text mb-2 flex items-center gap-1.5"><ShieldCheck size={14} className="text-primary" /> Paiement sécurisé (séquestre)</h3>
                    {escrowQuery.isPending ? (
                      <LoadingState variant="inline" label="Vérification du séquestre..." />
                    ) : escrowQuery.isError ? (
                      <ErrorState error={escrowQuery.error} onRetry={() => void escrowQuery.refetch()} compact />
                    ) : escrow ? (
                      (() => { const state = escrowState(escrow); const Icon = state.icon; return (
                        <div className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${state.tone}`}>
                          <Icon size={18} className="shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">{state.label} · {formatPrice(escrow.amount)}</p>
                            <p className="text-xs opacity-80">{state.description}</p>
                          </div>
                        </div>
                      ); })()
                    ) : (
                      <p className="text-sm text-muted">Aucun fonds séquestré : le paiement n'a pas encore été confirmé.</p>
                    )}
                    {order.status === 'in_dispute' && (
                      <p className="mt-2 text-xs text-orange-600 flex items-center gap-1.5"><Scale size={13} /> Un litige est en cours sur cette commande. <Link to={role === 'seller' ? '/dashboard/vendeur/litiges' : role === 'admin' ? '/dashboard/admin/litiges' : '/dashboard/client/mes-litiges'} className="text-primary hover:underline">Suivre le litige</Link></p>
                    )}
                  </section>

                  <section aria-labelledby="order-payments-heading">
                    <h3 id="order-payments-heading" className="text-sm font-semibold text-text mb-2 flex items-center gap-1.5"><CreditCard size={14} className="text-primary" /> Paiement</h3>
                    {paymentsQuery.isPending ? (
                      <LoadingState variant="inline" label="Chargement du paiement..." />
                    ) : paymentsQuery.isError ? (
                      <ErrorState error={paymentsQuery.error} onRetry={() => void paymentsQuery.refetch()} compact />
                    ) : (paymentsQuery.data ?? []).length === 0 ? (
                      <p className="text-sm text-muted">Aucun paiement enregistré pour cette commande.</p>
                    ) : (
                      <ul className="space-y-2">
                        {(paymentsQuery.data ?? []).map((payment) => (
                          <li key={payment.id} className="flex items-center justify-between text-sm bg-surface-secondary rounded-lg px-3 py-2">
                            <div>
                              <p className="font-medium text-text">{paymentMethodLabel(payment.method)}</p>
                              <p className="text-xs text-muted font-mono">{payment.transactionId}</p>
                            </div>
                            <div className="text-right">
                              <StatusBadge status={payment.status} kind="payment" />
                              <p className="text-xs text-muted mt-1">{formatPrice(payment.amount)}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </>
              ) : null}
            </div>

            {order && (
              <footer className="border-t border-border p-4 space-y-3">
                {needsPayment && <OrderPaymentRetry order={order} />}
                {role === 'client' && order.status === 'pending' && paymentInProgress && (
                  <p className="text-xs text-muted flex items-center gap-1.5" data-testid="order-payment-in-progress"><Lock size={13} className="text-primary" /> Paiement en cours de confirmation par l’opérateur : les fonds seront conservés en séquestre jusqu’à votre confirmation de réception.</p>
                )}
                {canConfirmReception && (
                  <Button icon={CheckCircle2} fullWidth onClick={() => confirmReception.request(escrow)} loading={releaseEscrow.isPending} loadingLabel="Confirmation..." data-testid="order-confirm-reception">
                    Confirmer la réception et libérer les fonds
                  </Button>
                )}
                {canReview && !existingReviewQuery.isPending && (
                  alreadyReviewed ? (
                    <p className="text-xs text-muted flex items-center gap-1.5"><Star size={13} className="text-amber-400" fill="currentColor" /> Vous avez déjà évalué cette commande. <Link to="/dashboard/client/mes-avis" className="text-primary hover:underline">Voir mes avis</Link></p>
                  ) : (
                    <Button variant="secondary" icon={Star} fullWidth onClick={() => setReviewOpen(true)} data-testid="order-review-button">Laisser un avis au vendeur</Button>
                  )
                )}
                <OrderStatusActions order={order} role={role} size="md" payments={payments} />
                {role === 'client' && (
                  <ContactSellerButton sellerId={order.sellerId} orderId={order.id} subjectHint={`Commande ${order.orderNumber}`} size="sm" variant="ghost" fullWidth label="Écrire au vendeur à propos de cette commande" />
                )}
                {canReport && (
                  <button type="button" onClick={() => setDisputeOpen(true)} className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium text-muted hover:text-orange-600 py-1 transition-colors" data-testid="order-report-problem">
                    <AlertTriangle size={13} /> Un problème avec cette commande ? Signaler un litige
                  </button>
                )}
              </footer>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
      {order && canReview && (
        <ReviewFormDialog
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
          orderId={order.id}
          reviewedId={order.sellerId}
          reviewedName={partyName(order.seller, 'ce vendeur')}
          productId={order.lines.length === 1 ? order.lines[0]?.productId : undefined}
          productName={order.lines.length === 1 ? order.lines[0]?.productName : undefined}
        />
      )}
      {order && canReport && (
        <DisputeFormDialog open={disputeOpen} onClose={() => setDisputeOpen(false)} orderId={order.id} orderNumber={order.orderNumber} />
      )}
      <ConfirmDialog
        open={confirmReception.isOpen}
        title="Confirmer la réception ?"
        description="Vous attestez avoir reçu la commande conforme. Les fonds séquestrés seront immédiatement libérés au vendeur ; cette action est définitive."
        confirmLabel="Oui, j'ai bien reçu ma commande"
        loadingLabel="Confirmation..."
        loading={releaseEscrow.isPending}
        onConfirm={() => void confirmReception.run((target) => releaseEscrow.mutateAsync(target.id))}
        onCancel={confirmReception.cancel}
      />
    </>
  );
}

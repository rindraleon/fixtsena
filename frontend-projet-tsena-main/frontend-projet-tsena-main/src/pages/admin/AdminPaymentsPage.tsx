import { useSearchParams } from 'react-router-dom';
import { CreditCard, CheckCircle2, XCircle, Clock, ShieldCheck, Lock, Unlock, Wallet, PlayCircle, BadgeCheck } from 'lucide-react';
import { useTitle } from '../../hooks';
import { usePayments, usePaymentStats } from '../../hooks/queries/usePayments';
import { useEscrowStats } from '../../hooks/queries/useEscrow';
import { useConfirmPayment, useSimulatePaymentSuccess } from '../../hooks/mutations/usePaymentMutations';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import DataTable, { type DataTableColumn } from '../../components/common/DataTable';
import { ConfirmDialog, ErrorState, LoadingState } from '../../components/common';
import PageHeader from '../../shared/components/PageHeader';
import StatCard from '../../shared/components/StatCard';
import StatusBadge from '../../shared/components/StatusBadge';
import { formatDateTime, formatPrice, PAYMENT_STATUS_LABELS, paymentMethodLabel } from '../../lib/format';
import { env } from '../../lib/env';
import type { ApiPayment, PaymentStatus } from '../../types/api';

const PAGE_SIZE = 15;
const STATUS_FILTERS: PaymentStatus[] = ['initiated', 'pending', 'processing', 'success', 'escrow', 'released', 'failed', 'cancelled', 'blocked', 'refunded', 'partially_refunded'];
const CONFIRMABLE: readonly PaymentStatus[] = ['initiated', 'pending'];
type PaymentAction = { kind: 'confirm' | 'simulate'; payment: ApiPayment };

export default function AdminPaymentsPage() {
  useTitle('Paiements & séquestre | Administration');
  const [searchParams, setSearchParams] = useSearchParams();
  const status = (searchParams.get('status') ?? '') as PaymentStatus | '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const setParam = (key: string, value: string | null, resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (resetPage) next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const paymentsQuery = usePayments({ status: status || undefined, page, limit: PAGE_SIZE });
  const paymentStats = usePaymentStats();
  const escrowStats = useEscrowStats();
  const confirmPayment = useConfirmPayment();
  const simulateSuccess = useSimulatePaymentSuccess();
  const confirm = useConfirmAction<PaymentAction>();
  const pending = confirmPayment.isPending || simulateSuccess.isPending;
  const statsPending = paymentStats.isPending || escrowStats.isPending;
  const statsError = paymentStats.error ?? escrowStats.error;

  const columns: DataTableColumn<ApiPayment>[] = [
    { header: 'Transaction', primary: true, cell: (payment) => <div className="min-w-0"><p className="font-mono text-xs sm:text-sm font-semibold text-text truncate">{payment.transactionId}</p><p className="text-xs text-muted">{paymentMethodLabel(payment.method)}</p></div> },
    { header: 'Commande', cell: (payment) => <span className="font-mono text-xs text-muted">{payment.orderId.slice(0, 8)}…</span> },
    { header: 'Montant', mobile: true, cell: (payment) => <span className="font-semibold">{formatPrice(payment.amount)}</span> },
    { header: 'Statut', mobile: true, cell: (payment) => <StatusBadge status={payment.status} kind="payment" /> },
    { header: 'Date', cell: (payment) => <span className="text-muted">{formatDateTime(payment.paidAt ?? payment.createdAt)}</span> },
  ];

  const dialogCopy = confirm.target?.kind === 'confirm'
    ? { title: 'Confirmer ce paiement ?', description: `Le paiement ${confirm.target.payment.transactionId} (${formatPrice(confirm.target.payment.amount)}) sera marqué comme réussi et les fonds placés en séquestre.`, confirmLabel: 'Confirmer le paiement', loadingLabel: 'Confirmation...' }
    : confirm.target?.kind === 'simulate'
      ? { title: 'Simuler un paiement réussi ?', description: 'Réservé aux environnements de test : simule le callback de l’opérateur mobile money.', confirmLabel: 'Simuler', loadingLabel: 'Simulation...' }
      : null;

  return (
    <div>
      <PageHeader title="Paiements & séquestre" subtitle="Suivi des transactions, des fonds séquestrés et des libérations" />

      {statsPending ? (
        <LoadingState variant="stats" count={4} className="mb-6" />
      ) : statsError ? (
        <ErrorState error={statsError} onRetry={() => { void paymentStats.refetch(); void escrowStats.refetch(); }} compact className="mb-6" />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <StatCard title="Paiements" value={paymentStats.data?.totalPayments ?? 0} icon={CreditCard} color="primary" index={0} />
            <StatCard title="Réussis" value={paymentStats.data?.successfulPayments ?? 0} icon={CheckCircle2} color="success" index={1} />
            <StatCard title="En attente" value={paymentStats.data?.pendingPayments ?? 0} icon={Clock} color="warning" index={2} />
            <StatCard title="Échoués" value={paymentStats.data?.failedPayments ?? 0} icon={XCircle} color="danger" index={3} />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard title="Volume encaissé" value={formatPrice(paymentStats.data?.totalRevenue ?? 0)} icon={Wallet} color="success" index={4} />
            <StatCard title="En séquestre" value={formatPrice(escrowStats.data?.totalHeld ?? 0)} icon={ShieldCheck} color="info" index={5} />
            <StatCard title="Bloqués (litiges)" value={formatPrice(escrowStats.data?.blockedAmount ?? 0)} icon={Lock} color="warning" index={6} />
            <StatCard title="Libérés aux vendeurs" value={formatPrice(escrowStats.data?.releasedAmount ?? 0)} icon={Unlock} color="primary" index={7} />
          </div>
        </>
      )}

      <DataTable
        data={paymentsQuery.data?.items ?? []}
        columns={columns}
        isLoading={paymentsQuery.isPending}
        isFetching={paymentsQuery.isFetching}
        error={paymentsQuery.error}
        onRetry={() => void paymentsQuery.refetch()}
        toolbar={
          <select value={status} onChange={(e) => setParam('status', e.target.value || null)} className="px-3 py-2 border border-input-border bg-input-bg rounded-lg text-sm text-text focus:outline-none focus:border-primary" aria-label="Filtrer par statut">
            <option value="">Tous les statuts</option>
            {STATUS_FILTERS.map((s) => <option key={s} value={s}>{PAYMENT_STATUS_LABELS[s]}</option>)}
          </select>
        }
        pagination={paymentsQuery.data ? { page, totalPages: paymentsQuery.data.meta.totalPages, total: paymentsQuery.data.meta.total, onPageChange: (p) => setParam('page', String(p), false) } : undefined}
        emptyIcon={CreditCard}
        emptyTitle={status ? 'Aucun résultat' : 'Aucun paiement'}
        emptyDescription={status ? 'Aucun paiement ne correspond à ce filtre.' : 'Aucune transaction enregistrée pour le moment.'}
        actions={(payment) => CONFIRMABLE.includes(payment.status) ? (
          <>
            <button type="button" onClick={() => confirm.request({ kind: 'confirm', payment })} disabled={pending} className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-muted hover:text-emerald-600 disabled:opacity-50" aria-label="Confirmer le paiement" title="Confirmer le paiement"><BadgeCheck size={16} /></button>
            {env.isDev && <button type="button" onClick={() => confirm.request({ kind: 'simulate', payment })} disabled={pending} className="p-1.5 rounded-lg hover:bg-surface-tertiary text-muted hover:text-primary disabled:opacity-50" aria-label="Simuler un succès" title="Simuler un succès (test)"><PlayCircle size={16} /></button>}
          </>
        ) : null}
        data-testid="admin-payments-table"
      />

      <ConfirmDialog
        open={confirm.isOpen}
        title={dialogCopy?.title ?? ''}
        description={dialogCopy?.description}
        confirmLabel={dialogCopy?.confirmLabel}
        loadingLabel={dialogCopy?.loadingLabel}
        loading={pending}
        onConfirm={() => void confirm.run((action) => action.kind === 'confirm' ? confirmPayment.mutateAsync(action.payment.id) : simulateSuccess.mutateAsync(action.payment.id))}
        onCancel={confirm.cancel}
      />
    </div>
  );
}

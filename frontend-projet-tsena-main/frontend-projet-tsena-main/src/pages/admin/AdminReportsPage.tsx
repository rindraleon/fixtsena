import { useSearchParams } from 'react-router-dom';
import { FileText, Activity, Users, Store, Package, ShoppingBag, Wallet, ShieldCheck, Scale, CreditCard } from 'lucide-react';
import { useTitle } from '../../hooks';
import { useAdminDashboard, useAuditLogs } from '../../hooks/queries/useUsers';
import { usePaymentStats } from '../../hooks/queries/usePayments';
import { useDisputeStats } from '../../hooks/queries/useDisputes';
import DataTable, { type DataTableColumn } from '../../components/common/DataTable';
import { ErrorState, LoadingState } from '../../components/common';
import PageHeader from '../../shared/components/PageHeader';
import { formatDateTime, formatPrice } from '../../lib/format';
import type { AuditLog } from '../../types/api';
import AdminPeriodReport from './AdminPeriodReport';
import { PERIOD_PRESETS } from './report-period';

const PAGE_SIZE = 25;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function Kpi({ icon: Icon, label, value, hint }: { icon: typeof Users; label: string; value: string | number; hint?: string }) {
  return (
    <div className="bg-surface rounded-xl border border-border p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><Icon size={18} /></div>
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="text-lg font-bold text-text leading-tight">{value}</p>
        {hint && <p className="text-[11px] text-muted">{hint}</p>}
      </div>
    </div>
  );
}

export default function AdminReportsPage() {
  useTitle('Rapports & audit | Administration');
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const defaultRange = PERIOD_PRESETS[1].range(new Date());
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');
  const from = fromParam && DAY_PATTERN.test(fromParam) ? fromParam : defaultRange.from;
  const to = toParam && DAY_PATTERN.test(toParam) ? toParam : defaultRange.to;
  const updateParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }
    setSearchParams(next, { replace: true });
  };
  const dashboard = useAdminDashboard();
  const paymentStats = usePaymentStats();
  const disputeStats = useDisputeStats();
  const auditQuery = useAuditLogs({ page, limit: PAGE_SIZE });

  const kpisPending = dashboard.isPending || paymentStats.isPending || disputeStats.isPending;
  const kpisError = dashboard.error ?? paymentStats.error ?? disputeStats.error;
  const d = dashboard.data;
  const p = paymentStats.data;
  const ds = disputeStats.data;
  const paymentSuccessRate = p && p.totalPayments > 0 ? Math.round((p.successfulPayments / p.totalPayments) * 100) : null;
  const deliveryRate = d?.orders.deliverySuccessRate != null ? Math.round(d.orders.deliverySuccessRate) : d && d.orders.total > 0 ? Math.round(((d.orders.delivered ?? 0) / d.orders.total) * 100) : null;

  const columns: DataTableColumn<AuditLog>[] = [
    { header: 'Date', primary: true, cell: (log) => <span className="text-text whitespace-nowrap">{formatDateTime(log.createdAt)}</span> },
    { header: 'Action', mobile: true, cell: (log) => <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface-tertiary text-text">{log.action}</span> },
    { header: 'Entité', mobile: true, cell: (log) => <span className="text-muted">{log.entity}{log.entityId ? <span className="font-mono text-xs"> · {log.entityId.slice(0, 8)}…</span> : null}</span> },
    { header: 'Utilisateur', cell: (log) => <span className="font-mono text-xs text-muted">{log.userId ? `${log.userId.slice(0, 8)}…` : 'système'}</span> },
    { header: 'IP', cell: (log) => <span className="text-xs text-muted">{log.ipAddress ?? '—'}</span> },
  ];

  return (
    <div>
      <PageHeader title="Rapports & audit" subtitle="Indicateurs clés de la plateforme, rapports par période exportables et journal des actions sensibles" />

      <section aria-labelledby="kpi-heading" className="mb-8">
        <h3 id="kpi-heading" className="font-semibold text-text mb-3 flex items-center gap-2"><Activity size={16} className="text-primary" /> Indicateurs</h3>
        {kpisPending ? (
          <LoadingState variant="stats" count={4} />
        ) : kpisError ? (
          <ErrorState error={kpisError} onRetry={() => { void dashboard.refetch(); void paymentStats.refetch(); void disputeStats.refetch(); }} compact />
        ) : d && p && ds ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi icon={Users} label="Utilisateurs actifs" value={d.users.active} hint={`${d.users.total} au total`} />
            <Kpi icon={Store} label="Vendeurs" value={d.users.sellers} />
            <Kpi icon={Package} label="Produits publiés" value={d.products.active} hint={`${d.products.total} au total`} />
            <Kpi icon={ShoppingBag} label="Volume de commandes" value={d.orders.total} hint={`${d.orders.last7Days} sur 7 jours`} />
            <Kpi icon={Wallet} label="Chiffre d'affaires" value={formatPrice(d.revenue.total)} hint={`${formatPrice(d.revenue.last7Days)} sur 7 jours`} />
            <Kpi icon={ShieldCheck} label="Montant en séquestre" value={formatPrice(d.escrow.heldAmount)} />
            <Kpi icon={CreditCard} label="Taux de paiement réussi" value={paymentSuccessRate === null ? '—' : `${paymentSuccessRate}%`} hint={`${p.successfulPayments}/${p.totalPayments} paiements`} />
            <Kpi icon={ShoppingBag} label="Taux de livraison" value={deliveryRate === null ? '—' : `${deliveryRate}%`} hint={`${d.orders.delivered} livrées`} />
            <Kpi icon={Scale} label="Litiges ouverts" value={ds.openDisputes} hint={`${ds.totalDisputes} au total · ${ds.resolutionRate}% résolus`} />
          </div>
        ) : null}
      </section>

      <AdminPeriodReport from={from} to={to} onChange={(range) => updateParams({ from: range.from, to: range.to })} />

      <section aria-labelledby="audit-heading">
        <h3 id="audit-heading" className="font-semibold text-text mb-3 flex items-center gap-2"><FileText size={16} className="text-primary" /> Journal d'audit</h3>
        <DataTable
          data={auditQuery.data?.items ?? []}
          columns={columns}
          isLoading={auditQuery.isPending}
          isFetching={auditQuery.isFetching}
          error={auditQuery.error}
          onRetry={() => void auditQuery.refetch()}
          pagination={auditQuery.data ? { page, totalPages: auditQuery.data.meta.totalPages, total: auditQuery.data.meta.total, onPageChange: (next) => updateParams({ page: String(next) }) } : undefined}
          emptyIcon={FileText}
          emptyTitle="Aucune entrée d'audit"
          emptyDescription="Les actions sensibles (connexions, suspensions, décisions de litige…) apparaîtront ici."
          data-testid="admin-audit-table"
        />
      </section>
    </div>
  );
}

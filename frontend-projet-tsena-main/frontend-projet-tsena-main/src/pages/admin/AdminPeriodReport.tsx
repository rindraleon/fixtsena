import { useMemo, useState } from 'react';
import { CalendarRange, Download, BarChart3, Wallet, ShoppingBag, Scale, Users, RotateCcw, CreditCard } from 'lucide-react';
import clsx from 'clsx';
import { useAdminReport } from '../../hooks/queries/useUsers';
import { useExportAdminReport } from '../../hooks/mutations/useUserMutations';
import { Button, ErrorState, LoadingState } from '../../components/common';
import { formatPrice, formatNumber, ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '../../lib/format';
import { MAX_PERIOD_DAYS, PERIOD_PRESETS, toDayString, validatePeriod, type PeriodPreset } from './report-period';
import {
  ADMIN_REPORT_TYPE_LABELS,
  DISPUTE_REASON_LABELS,
  type AdminReportParams,
  type AdminReportType,
  type DisputeReasonCode,
  type OrderStatus,
} from '../../types/api';

const REPORT_TYPES = Object.keys(ADMIN_REPORT_TYPE_LABELS) as AdminReportType[];
function Tile({ icon: Icon, label, value, hint, tone = 'primary' }: { icon: typeof Users; label: string; value: string | number; hint?: string; tone?: 'primary' | 'success' | 'warning' }) {
  const tones = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
    warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
  };
  return (
    <div className="bg-surface rounded-xl border border-border p-4 flex items-start gap-3">
      <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', tones[tone])}><Icon size={18} /></div>
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="text-lg font-bold text-text leading-tight">{value}</p>
        {hint && <p className="text-[11px] text-muted">{hint}</p>}
      </div>
    </div>
  );
}

function MiniTable({ title, rows, empty }: { title: string; rows: Array<{ key: string; label: string; value: string; secondary?: string }>; empty: string }) {
  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <h4 className="text-sm font-semibold text-text mb-2">{title}</h4>
      {rows.length === 0 ? (
        <p className="text-xs text-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-border/70 text-sm">
          {rows.map((row) => (
            <li key={row.key} className="py-1.5 flex items-center justify-between gap-3">
              <span className="text-text truncate">{row.label}{row.secondary && <span className="text-xs text-muted"> · {row.secondary}</span>}</span>
              <span className="font-medium text-text whitespace-nowrap">{row.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface Props {
  readonly from: string;
  readonly to: string;
  readonly onChange: (next: { from: string; to: string }) => void;
}

export default function AdminPeriodReport({ from, to, onChange }: Props) {
  const today = useMemo(() => new Date(), []);
  const [draft, setDraft] = useState({ from, to });
  const validationError = validatePeriod(from, to, today);
  const params: AdminReportParams = { from, to };
  const report = useAdminReport(params, { enabled: !validationError });
  const exportReport = useExportAdminReport();
  const draftError = validatePeriod(draft.from, draft.to, today);
  const activePreset = PERIOD_PRESETS.find((preset) => {
    const range = preset.range(today);
    return range.from === from && range.to === to;
  })?.id;

  const applyPreset = (preset: PeriodPreset) => {
    const range = preset.range(today);
    setDraft(range);
    onChange(range);
  };

  const submitDraft = (event: React.FormEvent) => {
    event.preventDefault();
    if (draftError) return;
    onChange(draft);
  };

  const data = report.data;
  const statusRows = data
    ? (Object.entries(data.orders.byStatus) as Array<[OrderStatus, number | undefined]>)
        .filter(([, count]) => (count ?? 0) > 0)
        .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
        .map(([status, count]) => ({ key: status, label: ORDER_STATUS_LABELS[status] ?? status, value: formatNumber(count ?? 0) }))
    : [];
  const settledRate = data && data.payments.count > 0 ? Math.round((data.payments.settled / data.payments.count) * 100) : null;

  return (
    <section aria-labelledby="period-report-heading" className="mb-8" data-testid="admin-period-report">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h3 id="period-report-heading" className="font-semibold text-text flex items-center gap-2"><CalendarRange size={16} className="text-primary" /> Rapport par période</h3>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Périodes prédéfinies">
          {PERIOD_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset)}
              aria-pressed={activePreset === preset.id}
              className={clsx('px-2.5 py-1 rounded-full text-xs font-medium border transition-colors', activePreset === preset.id ? 'bg-primary text-white border-primary' : 'bg-surface text-muted border-border hover:text-text hover:border-primary/40')}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={submitDraft} className="bg-surface rounded-xl border border-border p-4 mb-4 flex flex-wrap items-end gap-3" aria-label="Choisir la période du rapport">
        <div>
          <label htmlFor="report-from" className="block text-xs font-medium text-muted mb-1">Du</label>
          <input id="report-from" type="date" value={draft.from} max={toDayString(today)} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} className="px-3 py-2 border border-input-border bg-input-bg rounded-lg text-sm text-text focus:outline-none focus:border-primary" />
        </div>
        <div>
          <label htmlFor="report-to" className="block text-xs font-medium text-muted mb-1">Au (inclus)</label>
          <input id="report-to" type="date" value={draft.to} max={toDayString(today)} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} className="px-3 py-2 border border-input-border bg-input-bg rounded-lg text-sm text-text focus:outline-none focus:border-primary" />
        </div>
        <Button type="submit" size="sm" variant="secondary" icon={BarChart3} disabled={!!draftError || (draft.from === from && draft.to === to)}>Appliquer</Button>
        {draftError ? (
          <p className="text-xs text-danger basis-full" role="alert">{draftError}</p>
        ) : (
          <p className="text-xs text-muted basis-full">Période maximale : {MAX_PERIOD_DAYS} jours. Les dates sont inclusives.</p>
        )}
      </form>

      {validationError ? (
        <p className="text-sm text-danger" role="alert">{validationError}</p>
      ) : report.isPending ? (
        <LoadingState variant="stats" count={4} />
      ) : report.isError ? (
        <ErrorState error={report.error} onRetry={() => void report.refetch()} retrying={report.isFetching} compact />
      ) : data ? (
        <div className={clsx('space-y-4 transition-opacity', report.isFetching && 'opacity-70')} data-testid="period-report-content">
          <p className="text-xs text-muted">
            Période du <strong className="text-text">{data.period.from}</strong> au <strong className="text-text">{data.period.to}</strong> ({data.period.days} jour{data.period.days > 1 ? 's' : ''}). Le chiffre d'affaires et les commissions portent sur les commandes livrées.
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Tile icon={ShoppingBag} label="Commandes" value={formatNumber(data.orders.count)} hint={`${formatNumber(data.orders.delivered)} livrées · ${formatNumber(data.orders.cancelled)} annulées`} />
            <Tile icon={Wallet} label="Chiffre d'affaires livré" value={formatPrice(data.revenue.gross)} hint={`Panier moyen ${formatPrice(data.orders.averageBasket)}`} tone="success" />
            <Tile icon={BarChart3} label="Commissions plateforme" value={formatPrice(data.revenue.commission)} hint={`Net vendeurs ${formatPrice(data.revenue.sellerNet)}`} tone="success" />
            <Tile icon={CreditCard} label="Paiements réglés" value={settledRate === null ? '—' : `${settledRate}%`} hint={`${formatNumber(data.payments.settled)}/${formatNumber(data.payments.count)} · ${formatPrice(data.payments.amount)}`} />
            <Tile icon={RotateCcw} label="Remboursements" value={formatPrice(data.refunds.amount)} hint={`${formatNumber(data.refunds.count)} commande${data.refunds.count > 1 ? 's' : ''}`} tone="warning" />
            <Tile icon={Scale} label="Litiges ouverts" value={formatNumber(data.disputes.opened)} hint={`${formatNumber(data.disputes.decided)} tranchés sur la période`} tone="warning" />
            <Tile icon={Users} label="Nouveaux utilisateurs" value={formatNumber(data.users.newUsers)} hint={`dont ${formatNumber(data.users.newSellers)} vendeur${data.users.newSellers > 1 ? 's' : ''}`} />
            <Tile icon={ShoppingBag} label="Frais de livraison" value={formatPrice(data.revenue.shipping)} hint="Commandes livrées" />
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MiniTable title="Commandes par statut" rows={statusRows} empty="Aucune commande sur la période." />
            <MiniTable
              title="Paiements par moyen"
              rows={data.payments.byMethod.map((m) => ({ key: m.method, label: PAYMENT_METHOD_LABELS[m.method] ?? m.method, value: formatPrice(m.amount), secondary: `${formatNumber(m.count)} paiement${m.count > 1 ? 's' : ''}` }))}
              empty="Aucun paiement réglé sur la période."
            />
            <MiniTable
              title="Top vendeurs"
              rows={data.topSellers.map((s) => ({ key: s.sellerId, label: s.name, value: formatPrice(s.amount), secondary: `${formatNumber(s.orders)} cde · com. ${formatPrice(s.commission)}` }))}
              empty="Aucune vente sur la période."
            />
            <MiniTable
              title="Top catégories"
              rows={data.topCategories.map((c) => ({ key: c.categoryId, label: c.name, value: formatPrice(c.amount), secondary: `${formatNumber(c.quantity)} article${c.quantity > 1 ? 's' : ''}` }))}
              empty="Aucune vente sur la période."
            />
          </div>

          {data.disputes.byReason.length > 0 && (
            <MiniTable
              title="Litiges par motif"
              rows={data.disputes.byReason.map((r) => ({ key: r.reasonCode, label: DISPUTE_REASON_LABELS[r.reasonCode as DisputeReasonCode] ?? r.reasonCode, value: formatNumber(r.count) }))}
              empty=""
            />
          )}

          <div className="bg-surface rounded-xl border border-border p-4" data-testid="report-exports">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-text flex items-center gap-2"><Download size={15} className="text-primary" /> Exporter la période</h4>
                <p className="text-xs text-muted mt-0.5">Fichiers CSV (UTF-8, séparateur « ; ») lisibles dans Excel / LibreOffice · 20 000 lignes max · chaque export est journalisé dans l'audit.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {REPORT_TYPES.map((type) => {
                  const running = exportReport.isPending && exportReport.variables?.type === type;
                  return (
                    <Button
                      key={type}
                      size="sm"
                      variant="outline"
                      icon={Download}
                      loading={running}
                      loadingLabel="Export..."
                      disabled={exportReport.isPending && !running}
                      onClick={() => exportReport.mutate({ type, params })}
                      data-testid={`export-${type}`}
                    >
                      {ADMIN_REPORT_TYPE_LABELS[type]}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

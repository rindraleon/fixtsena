import { useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Settings2, Percent, Truck, RotateCcw, Save, Plus, Pencil, Trash2, Info, Wand2 } from 'lucide-react';
import clsx from 'clsx';
import { useTitle } from '../../hooks';
import { useAdminSettings } from '../../hooks/queries/useNotifications';
import { useAdminDeliveryZones, useCommissionGrid } from '../../hooks/queries/useCommissions';
import { useRemoveCommissionRate, useRemoveDeliveryZone, useResetSetting, useSaveDeliveryZone, useSeedCommissionGrid, useUpdateSettings, useUpsertCommissionRate } from '../../hooks/mutations/useNotificationMutations';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import { Button, ConfirmDialog, EmptyState, ErrorState, LoadingState } from '../../components/common';
import { FormField } from '../../components/form';
import PageHeader from '../../shared/components/PageHeader';
import { formatPrice } from '../../lib/format';
import { COMMISSION_REFUND_POLICY_LABELS, type CommissionTier, type DeliveryZone, type SaveDeliveryZoneDto } from '../../types/api';

type Tab = 'settings' | 'commissions' | 'delivery';
const TABS: Array<{ id: Tab; label: string; icon: typeof Settings2 }> = [
  { id: 'settings', label: 'Paramètres', icon: Settings2 },
  { id: 'commissions', label: 'Grille de commission', icon: Percent },
  { id: 'delivery', label: 'Zones de livraison', icon: Truck },
];

const KEY_LABELS: Record<string, string> = {
  'account.majorityAge': 'Âge de majorité (ans)',
  'account.birthDateRequiredForPurchase': 'Date de naissance obligatoire pour acheter',
  'subscriptions.gold.monthlyPrice': 'Gold — prix mensuel (Ar)',
  'subscriptions.gold.yearlyPrice': 'Gold — prix annuel (Ar)',
  'subscriptions.gold.slots': 'Gold — places disponibles',
  'subscriptions.premium.monthlyPrice': 'Premium — prix mensuel (Ar)',
  'subscriptions.premium.yearlyPrice': 'Premium — prix annuel (Ar)',
  'subscriptions.premium.slots': 'Premium — places disponibles',
  'subscriptions.expiryAlertDays': 'Alerte d’expiration (jours avant)',
  'levels.thresholds': 'Seuils d’éligibilité par niveau (JSON)',
  'levels.onTimeDeliveryDays': 'Livraison « dans les délais » (jours)',
  'commissions.defaultRates': 'Taux par défaut par palier (JSON, %)',
  'commissions.bigSellerLevels': 'Niveaux comptés « gros vendeur » (JSON)',
  'commissions.refundPolicy': 'Commission en cas de remboursement décidé par un litige (F-COM-07)',
  'delivery.logisticsMarginPercent': 'Marge logistique (%)',
  'delivery.logisticsFixedCost': 'Coût logistique fixe (Ar)',
  'promotions.offers': 'Offres de promotion (JSON)',
  'promotions.levelDiscounts': 'Remises promotions par niveau (JSON, %)',
  'promotions.maxActivePerSeller': 'Promotions actives max. par vendeur',
  'notifications.emailRetryCount': 'Nombre de tentatives d’envoi e-mail',
  'notifications.helpEmail': 'E-mail d’aide affiché dans les notifications',
  'follows.notifyNewProducts': 'Notifier les abonnés des nouveaux produits',
  'follows.notifyPromotions': 'Notifier les abonnés des promotions',
  'messaging.attachmentsAllowed': 'Pièces jointes autorisées en messagerie',
  'messaging.maxAttachmentSizeMb': 'Taille max. d’une pièce jointe (Mo)',
  'messaging.maxMessageLength': 'Longueur max. d’un message',
  'reviews.disputeDelayDays': 'Délai avant avis après litige (jours)',
  'reviews.editWindowHours': 'Fenêtre de modification d’un avis (heures)',
  'reviews.minCommentLength': 'Longueur min. d’un commentaire',
  'privacy.dataRetentionMonths': 'Conservation des données (mois)',
  'disputes.openingWindowDays': 'Fenêtre d’ouverture d’un litige (jours)',
};

function isScalar(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

const ENUM_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  'commissions.refundPolicy': Object.entries(COMMISSION_REFUND_POLICY_LABELS).map(([value, label]) => ({ value, label: `${value} — ${label}` })),
};

const KEY_HINTS: Record<string, string> = {
  'commissions.refundPolicy':
    'Remboursement intégral : la commission est toujours annulée. Remboursement partiel : « partial » la recalcule au prorata du montant conservé par le vendeur, « full » l’annule entièrement, « none » la maintient. Le taux reste celui figé à la commande.',
};

function SettingEditor({ settingKey, value, defaultValue, overridden }: { settingKey: string; value: unknown; defaultValue: unknown; overridden: boolean }) {
  const update = useUpdateSettings();
  const reset = useResetSetting();
  const [draft, setDraft] = useState<string>(() => (isScalar(value) ? String(value) : JSON.stringify(value, null, 2)));
  const [dirty, setDirty] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const enumOptions = ENUM_OPTIONS[settingKey];
  const kind = enumOptions ? 'enum' : typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : typeof value === 'string' ? 'string' : 'json';
  const label = KEY_LABELS[settingKey] ?? settingKey;
  const hint = KEY_HINTS[settingKey];

  const save = (event: FormEvent) => {
    event.preventDefault();
    let parsed: unknown = draft;
    if (kind === 'number') { parsed = Number(draft); if (Number.isNaN(parsed as number)) { setJsonError('Nombre invalide.'); return; } }
    if (kind === 'json') { try { parsed = JSON.parse(draft); } catch { setJsonError('JSON invalide.'); return; } }
    setJsonError(null);
    update.mutate({ [settingKey]: parsed }, { onSuccess: () => setDirty(false) });
  };

  return (
    <form onSubmit={save} className={clsx('rounded-lg border p-3 space-y-2', overridden ? 'border-primary/30 bg-primary/5' : 'border-border bg-surface')} data-testid={`setting-${settingKey}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text">{label}</p>
          <p className="text-[11px] text-muted font-mono truncate">{settingKey}{overridden ? ' · personnalisé' : ' · valeur par défaut'}</p>
        </div>
        {overridden && (
          <button type="button" onClick={() => reset.mutate(settingKey, { onSuccess: () => { setDraft(isScalar(defaultValue) ? String(defaultValue) : JSON.stringify(defaultValue, null, 2)); setDirty(false); } })} disabled={reset.isPending} className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-primary shrink-0" title="Rétablir la valeur par défaut"><RotateCcw size={11} /> Défaut</button>
        )}
      </div>
      {hint && <p className="text-xs text-muted flex items-start gap-1.5"><Info size={12} className="shrink-0 mt-0.5" /> {hint}</p>}
      {kind === 'enum' && enumOptions ? (
        <select value={draft} onChange={(e) => { setDraft(e.target.value); setDirty(true); }} className="w-full px-3 py-2 rounded-lg border border-input-border bg-input-bg text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/20" aria-label={label}>
          {!enumOptions.some((o) => o.value === draft) && <option value={draft}>{draft || '—'}</option>}
          {enumOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : kind === 'boolean' ? (
        <label className="inline-flex items-center gap-2 text-sm text-text cursor-pointer">
          <input type="checkbox" checked={draft === 'true'} onChange={(e) => { setDraft(String(e.target.checked)); setDirty(true); }} className="accent-primary w-4 h-4" />
          {draft === 'true' ? 'Activé' : 'Désactivé'}
        </label>
      ) : kind === 'json' ? (
        <textarea value={draft} onChange={(e) => { setDraft(e.target.value); setDirty(true); }} rows={Math.min(12, Math.max(3, draft.split('\n').length))} className="w-full font-mono text-xs px-3 py-2 rounded-lg border border-input-border bg-input-bg text-text focus:outline-none focus:ring-2 focus:ring-primary/20" aria-label={label} spellCheck={false} />
      ) : (
        <input type={kind === 'number' ? 'number' : 'text'} step="any" value={draft} onChange={(e) => { setDraft(e.target.value); setDirty(true); }} className="w-full px-3 py-2 rounded-lg border border-input-border bg-input-bg text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/20" aria-label={label} />
      )}
      {jsonError && <p className="text-xs text-danger" role="alert">{jsonError}</p>}
      {dirty && (
        <div className="flex justify-end">
          <Button type="submit" size="sm" icon={Save} loading={update.isPending} loadingLabel="Enregistrement...">Enregistrer</Button>
        </div>
      )}
    </form>
  );
}

function SettingsTab() {
  const settingsQuery = useAdminSettings();
  const [group, setGroup] = useState<string>('');
  if (settingsQuery.isPending) return <LoadingState variant="list" count={6} />;
  if (settingsQuery.isError) return <ErrorState error={settingsQuery.error} onRetry={() => void settingsQuery.refetch()} retrying={settingsQuery.isFetching} />;
  const { values, defaults, groups, overridden } = settingsQuery.data;
  const activeGroup = groups.find((g) => g.id === group) ?? groups[0];
  if (!activeGroup) return <EmptyState icon={Settings2} title="Aucun paramètre" description="Le backend n'expose aucun groupe de paramètres." />;
  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
      <nav aria-label="Groupes de paramètres" className="flex md:flex-col gap-1 overflow-x-auto">
        {groups.map((g) => (
          <button key={g.id} type="button" onClick={() => setGroup(g.id)} className={clsx('text-left px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors', g.id === activeGroup.id ? 'bg-primary text-white' : 'text-muted hover:bg-surface-secondary hover:text-text')}>
            {g.label} <span className="text-[11px] opacity-70">({g.keys.length})</span>
          </button>
        ))}
      </nav>
      <div className="space-y-3" key={activeGroup.id}>
        <h3 className="font-semibold text-text">{activeGroup.label}</h3>
        {activeGroup.keys.map((key) => (
          <SettingEditor key={key} settingKey={key} value={values[key]} defaultValue={defaults[key]} overridden={overridden.includes(key)} />
        ))}
        <p className="text-[11px] text-muted flex items-start gap-1.5"><Info size={12} className="shrink-0 mt-0.5" /> Les modifications s'appliquent immédiatement aux nouvelles opérations ; les commandes, abonnements et promotions existants conservent leurs conditions.</p>
      </div>
    </div>
  );
}

function RateCell({ categoryId, tier, value, fallback }: { categoryId: string | null; tier: CommissionTier; value: number | null; fallback: number | null }) {
  const upsert = useUpsertCommissionRate();
  const remove = useRemoveCommissionRate();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value != null ? String(value) : '');
  const commit = () => {
    const n = Number(draft);
    if (draft === '' || Number.isNaN(n) || n < 0 || n > 100) { setEditing(false); setDraft(value != null ? String(value) : ''); return; }
    if (n === value) { setEditing(false); return; }
    upsert.mutate({ categoryId, tier, ratePercent: n }, { onSettled: () => setEditing(false) });
  };
  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        min={0}
        max={100}
        step={0.5}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); setDraft(value != null ? String(value) : ''); } }}
        className="w-20 px-2 py-1 rounded border border-primary bg-input-bg text-sm text-text text-right"
        aria-label={`Taux ${tier}`}
      />
    );
  }
  return (
    <div className="inline-flex items-center gap-1 justify-end">
      <button type="button" onClick={() => { setDraft(value != null ? String(value) : fallback != null ? String(fallback) : ''); setEditing(true); }} className={clsx('px-2 py-1 rounded text-sm tabular-nums hover:bg-surface-secondary', value != null ? 'font-semibold text-text' : 'text-muted italic')} title={value != null ? 'Taux spécifique — cliquer pour modifier' : `Taux par défaut (${fallback ?? '—'} %) — cliquer pour définir un taux spécifique`} disabled={upsert.isPending}>
        {value != null ? `${value} %` : fallback != null ? `(${fallback} %)` : '—'}
      </button>
      {value != null && categoryId && (
        <button type="button" onClick={() => remove.mutate({ categoryId, tier })} disabled={remove.isPending} className="p-1 rounded text-muted hover:text-danger" aria-label="Supprimer le taux spécifique" title="Revenir au taux par défaut"><Trash2 size={12} /></button>
      )}
    </div>
  );
}

function CommissionsTab() {
  const gridQuery = useCommissionGrid();
  const seed = useSeedCommissionGrid();
  const seedConfirm = useConfirmAction<boolean>();
  if (gridQuery.isPending) return <LoadingState variant="table" count={8} />;
  if (gridQuery.isError) return <ErrorState error={gridQuery.error} onRetry={() => void gridQuery.refetch()} retrying={gridQuery.isFetching} />;
  const grid = gridQuery.data;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-muted max-w-2xl">Taux de commission (%) par catégorie et palier vendeur. Cliquez sur une cellule pour définir un taux spécifique ; les cellules entre parenthèses héritent du taux par défaut du palier. Le taux est figé sur chaque commande à sa création.</p>
        <Button variant="outline" size="sm" icon={Wand2} onClick={() => seedConfirm.request(true)} loading={seed.isPending} loadingLabel="Initialisation...">Charger la grille du cahier des charges</Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm" data-testid="commission-grid">
          <thead className="bg-surface-secondary text-xs uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="text-left px-4 py-2.5">Catégorie</th>
              {grid.tiers.map((t) => <th key={t.tier} scope="col" className="text-right px-4 py-2.5">{t.label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr className="bg-primary/5">
              <th scope="row" className="text-left px-4 py-2 font-semibold text-text">Taux par défaut (toutes catégories)</th>
              {grid.tiers.map((t) => <td key={t.tier} className="px-4 py-2 text-right"><RateCell categoryId={null} tier={t.tier} value={grid.defaults[t.tier]} fallback={null} /></td>)}
            </tr>
            {grid.rows.map((row) => (
              <tr key={row.categoryId}>
                <th scope="row" className="text-left px-4 py-2 font-medium text-text">{row.categoryName}</th>
                {grid.tiers.map((t) => <td key={t.tier} className="px-4 py-2 text-right"><RateCell categoryId={row.categoryId} tier={t.tier} value={row.rates[t.tier]} fallback={grid.defaults[t.tier]} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {grid.refundPolicy && <p className="text-xs text-muted">Politique en cas de remboursement : <strong className="text-text">{grid.refundPolicy}</strong> (modifiable dans l'onglet Paramètres → Commissions).</p>}
      <ConfirmDialog
        open={seedConfirm.isOpen}
        title="Charger la grille de référence ?"
        description="Les taux du cahier des charges (14 catégories × 3 paliers) seront appliqués aux catégories reconnues par leur nom. Les taux spécifiques existants seront remplacés."
        confirmLabel="Charger la grille"
        loadingLabel="Initialisation..."
        loading={seed.isPending}
        onConfirm={() => void seedConfirm.run(() => seed.mutateAsync())}
        onCancel={seedConfirm.cancel}
      />
    </div>
  );
}

const EMPTY_ZONE: SaveDeliveryZoneDto = { name: '', description: '', price: 0, sortOrder: 0, isActive: true };

function DeliveryTab() {
  const zonesQuery = useAdminDeliveryZones();
  const save = useSaveDeliveryZone();
  const remove = useRemoveDeliveryZone();
  const removeConfirm = useConfirmAction<DeliveryZone>();
  const [editing, setEditing] = useState<{ id?: string; dto: SaveDeliveryZoneDto } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const zones = useMemo(() => [...(zonesQuery.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)), [zonesQuery.data]);

  const errors = editing ? {
    name: editing.dto.name.trim().length < 2 ? 'Nom requis (2 caractères min.).' : undefined,
    price: !(editing.dto.price >= 0) ? 'Prix invalide.' : undefined,
  } : {};

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (!editing || errors.name || errors.price) return;
    save.mutate({ id: editing.id, dto: { ...editing.dto, name: editing.dto.name.trim(), description: editing.dto.description?.trim() || undefined } }, { onSuccess: () => { setEditing(null); setSubmitted(false); } });
  };

  if (zonesQuery.isPending) return <LoadingState variant="table" count={5} />;
  if (zonesQuery.isError) return <ErrorState error={zonesQuery.error} onRetry={() => void zonesQuery.refetch()} retrying={zonesQuery.isFetching} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-muted max-w-2xl">Zones de livraison tarifées proposées au paiement (Centre-ville 3 000 Ar, Périphérique 4 000 Ar, …). Le prix est figé sur la commande ; les zones inactives ne sont plus proposées mais restent sur l'historique.</p>
        <Button size="sm" icon={Plus} onClick={() => { setEditing({ dto: { ...EMPTY_ZONE, sortOrder: zones.length } }); setSubmitted(false); }} data-testid="zone-add">Nouvelle zone</Button>
      </div>

      {editing && (
        <form onSubmit={submit} noValidate className="bg-surface rounded-xl border-2 border-primary/40 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="zone-form">
          <FormField label="Nom" required value={editing.dto.name} onChange={(e) => setEditing({ ...editing, dto: { ...editing.dto, name: e.target.value } })} error={submitted ? errors.name : undefined} placeholder="Ex. Centre-ville" />
          <FormField label="Prix (Ar)" required type="number" min={0} step={100} value={String(editing.dto.price)} onChange={(e) => setEditing({ ...editing, dto: { ...editing.dto, price: Number(e.target.value) } })} error={submitted ? errors.price : undefined} />
          <FormField label="Description" value={editing.dto.description ?? ''} onChange={(e) => setEditing({ ...editing, dto: { ...editing.dto, description: e.target.value } })} placeholder="Quartiers couverts, délai indicatif…" />
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Ordre" type="number" min={0} value={String(editing.dto.sortOrder ?? 0)} onChange={(e) => setEditing({ ...editing, dto: { ...editing.dto, sortOrder: Number(e.target.value) } })} />
            <label className="flex items-center gap-2 text-sm text-text mt-6 cursor-pointer"><input type="checkbox" checked={editing.dto.isActive ?? true} onChange={(e) => setEditing({ ...editing, dto: { ...editing.dto, isActive: e.target.checked } })} className="accent-primary w-4 h-4" /> Zone active</label>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditing(null)} disabled={save.isPending}>Annuler</Button>
            <Button type="submit" icon={Save} loading={save.isPending} loadingLabel="Enregistrement...">{editing.id ? 'Enregistrer' : 'Créer la zone'}</Button>
          </div>
        </form>
      )}

      {zones.length === 0 ? (
        <EmptyState icon={Truck} compact title="Aucune zone configurée" description="Sans zone active, la livraison est considérée comme offerte au paiement." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm" data-testid="zones-table">
            <thead className="bg-surface-secondary text-xs uppercase tracking-wide text-muted">
              <tr><th scope="col" className="text-left px-4 py-2.5">Zone</th><th scope="col" className="text-right px-4 py-2.5">Prix</th><th scope="col" className="text-center px-4 py-2.5">Ordre</th><th scope="col" className="text-center px-4 py-2.5">Statut</th><th scope="col" className="px-4 py-2.5"><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {zones.map((zone) => (
                <tr key={zone.id} className={clsx(!zone.isActive && 'opacity-60')}>
                  <td className="px-4 py-2.5"><p className="font-medium text-text">{zone.name}</p>{zone.description && <p className="text-xs text-muted">{zone.description}</p>}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-text tabular-nums">{formatPrice(zone.price)}</td>
                  <td className="px-4 py-2.5 text-center text-muted">{zone.sortOrder}</td>
                  <td className="px-4 py-2.5 text-center"><span className={clsx('inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold', zone.isActive ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-500/15 dark:text-gray-300')}>{zone.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex gap-1">
                      <button type="button" onClick={() => { setEditing({ id: zone.id, dto: { name: zone.name, description: zone.description ?? '', price: Number(zone.price), sortOrder: zone.sortOrder, isActive: zone.isActive } }); setSubmitted(false); }} className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-surface-secondary" aria-label={`Modifier ${zone.name}`}><Pencil size={14} /></button>
                      <button type="button" onClick={() => removeConfirm.request(zone)} className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-red-50 dark:hover:bg-red-500/10" aria-label={`Supprimer ${zone.name}`}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={removeConfirm.isOpen}
        variant="destructive"
        title={`Supprimer la zone « ${removeConfirm.target?.name ?? ''} » ?`}
        description="Elle ne sera plus proposée au paiement. Les commandes passées conservent le nom et le prix de zone figés."
        confirmLabel="Supprimer"
        loadingLabel="Suppression..."
        loading={remove.isPending}
        onConfirm={() => void removeConfirm.run((zone) => remove.mutateAsync(zone.id))}
        onCancel={removeConfirm.cancel}
      />
    </div>
  );
}

export default function AdminSettingsPage() {
  useTitle('Paramètres | Administration');
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: Tab = TABS.some((t) => t.id === tabParam) ? (tabParam as Tab) : 'settings';

  return (
    <div className="max-w-6xl">
      <PageHeader title="Paramètres de la plateforme" subtitle="Commissions, livraison, abonnements, niveaux, promotions, notifications, messagerie, avis et données personnelles" />
      <div className="flex gap-1 border-b border-border mb-5 overflow-x-auto" role="tablist" aria-label="Sections">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = t.id === tab;
          return (
            <button key={t.id} type="button" role="tab" aria-selected={active} onClick={() => setSearchParams({ tab: t.id }, { replace: true })} className={clsx('inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors', active ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text')} data-testid={`settings-tab-${t.id}`}>
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>
      {tab === 'settings' && <SettingsTab />}
      {tab === 'commissions' && <CommissionsTab />}
      {tab === 'delivery' && <DeliveryTab />}
    </div>
  );
}

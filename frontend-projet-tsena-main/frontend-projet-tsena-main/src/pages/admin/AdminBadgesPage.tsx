import { useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Award, Plus, Pencil, Trash2, X, Sparkles, UserSearch, RefreshCw, ShieldCheck, Medal, Wand2, Hand, Users } from 'lucide-react';
import clsx from 'clsx';
import { useTitle } from '../../hooks';
import { useBadges, useBadgeStats, useUserBadges, useBadgeUserStats } from '../../hooks/queries/useBadges';
import { useUsers } from '../../hooks/queries/useUsers';
import { useAwardBadge, useEvaluateBadges, useRemoveBadge, useRevokeBadge, useSaveBadge, useSeedDefaultBadges } from '../../hooks/mutations/useBadgeMutations';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { Button, ConfirmDialog, DataTable, ErrorState, LoadingState, StatCardSkeleton } from '../../components/common';
import { FormError, FormField } from '../../components/form';
import PageHeader from '../../shared/components/PageHeader';
import SearchInput from '../../shared/components/SearchInput';
import { formatDate, fullName } from '../../lib/format';
import { getFieldErrors } from '../../lib/api-error';
import type { ApiBadge, ApiUser, BadgeCriteria, BadgeDto } from '../../types/api';

type NumericCriterion = Exclude<keyof BadgeCriteria, 'mode' | 'audience' | 'autoRevoke' | 'identityVerified'>;

const NUMERIC_CRITERIA: { key: NumericCriterion; label: string; hint: string; audience: 'seller' | 'buyer' | 'any'; unit?: string }[] = [
  { key: 'minAccountAgeDays', label: 'Ancienneté minimale', hint: 'jours depuis l’inscription', audience: 'any', unit: 'j' },
  { key: 'maxAccountAgeDays', label: 'Ancienneté maximale', hint: 'ex. 30 j pour « Nouveau vendeur »', audience: 'any', unit: 'j' },
  { key: 'minCompletedSales', label: 'Ventes terminées (min.)', hint: 'commandes livrées et confirmées', audience: 'seller' },
  { key: 'maxCompletedSales', label: 'Ventes terminées (max.)', hint: 'ex. 5 pour un badge de démarrage', audience: 'seller' },
  { key: 'minAverageRating', label: 'Note moyenne minimale', hint: 'sur 5', audience: 'seller', unit: '/5' },
  { key: 'minReviewsReceived', label: 'Avis reçus (min.)', hint: 'nombre d’avis publiés', audience: 'seller' },
  { key: 'maxIncidentRatePercent', label: 'Taux d’incidents max.', hint: 'litiges + annulations / ventes', audience: 'seller', unit: '%' },
  { key: 'minOnTimeDeliveryRatePercent', label: 'Livraisons dans les délais (min.)', hint: 'part des livraisons avant la date estimée', audience: 'seller', unit: '%' },
  { key: 'minRepliedReviews', label: 'Réponses aux avis (min.)', hint: 'avis auxquels le vendeur a répondu', audience: 'seller' },
  { key: 'minCompletedPurchases', label: 'Achats terminés (min.)', hint: 'commandes reçues et confirmées', audience: 'buyer' },
  { key: 'minReviewsGiven', label: 'Avis déposés (min.)', hint: 'avis publiés par l’acheteur', audience: 'buyer' },
  { key: 'maxDisputesOpened', label: 'Litiges ouverts (max.)', hint: 'litiges déclarés par l’acheteur', audience: 'buyer' },
];

const AUDIENCE_LABELS = { seller: 'Vendeurs', buyer: 'Acheteurs', any: 'Tous' } as const;

export function describeCriteria(criteria: BadgeCriteria | null | undefined): string[] {
  if (!criteria) return [];
  const parts: string[] = [];
  for (const c of NUMERIC_CRITERIA) {
    const value = criteria[c.key];
    if (typeof value === 'number') parts.push(`${c.label} : ${value}${c.unit ?? ''}`);
  }
  if (criteria.identityVerified) parts.push('Identité vérifiée');
  return parts;
}

interface BadgeFormState {
  name: string;
  description: string;
  iconUrl: string;
  isActive: boolean;
  mode: 'auto' | 'manual';
  audience: 'seller' | 'buyer' | 'any';
  autoRevoke: boolean;
  identityVerified: boolean;
  numeric: Partial<Record<NumericCriterion, string>>;
}

const EMPTY_FORM: BadgeFormState = { name: '', description: '', iconUrl: '', isActive: true, mode: 'auto', audience: 'seller', autoRevoke: true, identityVerified: false, numeric: {} };

function formFromBadge(badge: ApiBadge): BadgeFormState {
  const criteria = badge.criteria ?? {};
  const numeric: Partial<Record<NumericCriterion, string>> = {};
  for (const c of NUMERIC_CRITERIA) {
    const value = criteria[c.key];
    if (typeof value === 'number') numeric[c.key] = String(value);
  }
  return {
    name: badge.name,
    description: badge.description ?? '',
    iconUrl: badge.iconUrl ?? '',
    isActive: badge.isActive,
    mode: criteria.mode ?? 'auto',
    audience: criteria.audience ?? 'seller',
    autoRevoke: criteria.autoRevoke ?? true,
    identityVerified: !!criteria.identityVerified,
    numeric,
  };
}

function toDto(form: BadgeFormState): BadgeDto {
  const criteria: BadgeCriteria = { mode: form.mode, audience: form.audience, autoRevoke: form.autoRevoke };
  if (form.identityVerified) criteria.identityVerified = true;
  for (const c of NUMERIC_CRITERIA) {
    const raw = form.numeric[c.key];
    if (raw !== undefined && raw.trim() !== '') criteria[c.key] = Number(raw);
  }
  return { name: form.name.trim(), description: form.description.trim() || undefined, iconUrl: form.iconUrl.trim() || undefined, isActive: form.isActive, criteria };
}

function BadgeFormDialog({ open, badge, onClose }: { readonly open: boolean; readonly badge: ApiBadge | null; readonly onClose: () => void }) {
  const save = useSaveBadge();
  const [form, setForm] = useState<BadgeFormState>(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    save.reset();
    setForm(badge ? formFromBadge(badge) : EMPTY_FORM);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !save.isPending) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, badge?.id]);

  if (!open) return null;

  const serverErrors = getFieldErrors(save.error);
  const nameError = serverErrors.name ?? (submitted && form.name.trim().length < 2 ? 'Le nom doit contenir au moins 2 caractères.' : undefined);
  const numericErrors: Partial<Record<NumericCriterion, string>> = {};
  for (const c of NUMERIC_CRITERIA) {
    const raw = form.numeric[c.key];
    if (raw !== undefined && raw.trim() !== '' && (!Number.isFinite(Number(raw)) || Number(raw) < 0)) numericErrors[c.key] = 'Nombre positif attendu.';
  }
  const hasErrors = !!nameError || Object.keys(numericErrors).length > 0;
  const visibleCriteria = NUMERIC_CRITERIA.filter((c) => form.audience === 'any' || c.audience === 'any' || c.audience === form.audience);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (hasErrors || save.isPending) return;
    save.mutate({ id: badge?.id, dto: toDto(form) }, { onSuccess: onClose });
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="badge-dialog-title">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => !save.isPending && onClose()} aria-hidden="true" />
      <form onSubmit={submit} noValidate className="relative w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto bg-surface rounded-t-2xl sm:rounded-2xl shadow-2xl border border-border animate-scale-in" aria-busy={save.isPending}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-surface z-10">
          <h2 id="badge-dialog-title" className="font-semibold text-text flex items-center gap-2"><Award size={18} className="text-primary" /> {badge ? 'Modifier le badge' : 'Nouveau badge'}</h2>
          <button type="button" onClick={onClose} disabled={save.isPending} className="p-2 rounded-lg hover:bg-surface-tertiary text-muted" aria-label="Fermer"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-5">
          {save.isError && <FormError error={save.error} handledFields={['name']} />}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Nom du badge" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} maxLength={100} placeholder="Vendeur de confiance" error={nameError} required data-testid="badge-name" />
            <FormField label="Icône (URL, optionnel)" value={form.iconUrl} onChange={(e) => setForm((f) => ({ ...f, iconUrl: e.target.value }))} placeholder="https://…/icone.svg" />
          </div>
          <FormField as="textarea" label="Description affichée aux utilisateurs" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} maxLength={500} placeholder="Ce que ce badge signifie et comment l'obtenir" />

          <fieldset className="rounded-xl border border-border p-4 space-y-3">
            <legend className="px-1 text-sm font-semibold text-text">Mode d'attribution</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {([['auto', 'Automatique', 'Attribué dès que les critères ci-dessous sont remplis (réévalué après chaque vente, avis ou maintenance).', Wand2], ['manual', 'Manuel', 'Attribué uniquement par un administrateur (ex. « Réputation excellente »).', Hand]] as const).map(([value, label, description, Icon]) => (
                <label key={value} className={clsx('flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors', form.mode === value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40')}>
                  <input type="radio" name="badge-mode" value={value} checked={form.mode === value} onChange={() => setForm((f) => ({ ...f, mode: value }))} className="mt-1 accent-primary" />
                  <span><span className="flex items-center gap-1.5 text-sm font-medium text-text"><Icon size={14} /> {label}</span><span className="block text-xs text-muted">{description}</span></span>
                </label>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField as="select" label="Public concerné" value={form.audience} onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value as BadgeFormState['audience'] }))}>
                {(Object.keys(AUDIENCE_LABELS) as Array<keyof typeof AUDIENCE_LABELS>).map((a) => <option key={a} value={a}>{AUDIENCE_LABELS[a]}</option>)}
              </FormField>
              <div className="space-y-2 pt-6">
                <label className="flex items-center gap-2 text-sm text-text cursor-pointer"><input type="checkbox" checked={form.autoRevoke} onChange={(e) => setForm((f) => ({ ...f, autoRevoke: e.target.checked }))} disabled={form.mode === 'manual'} className="accent-primary" /> Retirer automatiquement si les critères ne sont plus remplis</label>
                <label className="flex items-center gap-2 text-sm text-text cursor-pointer"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} className="accent-primary" /> Badge actif (visible et attribuable)</label>
              </div>
            </div>
          </fieldset>

          <fieldset className="rounded-xl border border-border p-4 space-y-3" data-testid="badge-criteria">
            <legend className="px-1 text-sm font-semibold text-text">Critères d'obtention {form.mode === 'manual' && <span className="font-normal text-muted">(indicatifs en mode manuel)</span>}</legend>
            <label className="flex items-center gap-2 text-sm text-text cursor-pointer"><input type="checkbox" checked={form.identityVerified} onChange={(e) => setForm((f) => ({ ...f, identityVerified: e.target.checked }))} className="accent-primary" /> <ShieldCheck size={14} className="text-primary" /> Identité / boutique vérifiée par l'administration</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {visibleCriteria.map((c) => (
                <FormField key={c.key} label={c.label} type="number" inputMode="decimal" min={0} step={c.key === 'minAverageRating' ? 0.1 : 1} value={form.numeric[c.key] ?? ''} onChange={(e) => setForm((f) => ({ ...f, numeric: { ...f.numeric, [c.key]: e.target.value } }))} placeholder="—" hint={c.hint} error={numericErrors[c.key]} data-testid={`criteria-${c.key}`} />
              ))}
            </div>
            <p className="text-[11px] text-muted">Laissez un champ vide pour ne pas appliquer ce critère.</p>
          </fieldset>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border bg-surface-secondary/40 rounded-b-2xl sticky bottom-0">
          <Button type="button" variant="ghost" onClick={onClose} disabled={save.isPending}>Annuler</Button>
          <Button type="submit" loading={save.isPending} loadingLabel="Enregistrement..." data-testid="badge-submit">{badge ? 'Enregistrer' : 'Créer le badge'}</Button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function UserBadgesPanel({ badges }: { readonly badges: readonly ApiBadge[] }) {
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search.trim(), 300);
  const [selected, setSelected] = useState<ApiUser | null>(null);
  const [badgeId, setBadgeId] = useState('');
  const usersQuery = useUsers(debounced.length >= 2 ? { search: debounced, limit: 6 } : { limit: 0 });
  const userBadgesQuery = useUserBadges(selected?.id);
  const statsQuery = useBadgeUserStats(selected?.id);
  const award = useAwardBadge();
  const revoke = useRevokeBadge();
  const evaluate = useEvaluateBadges();
  const confirmRevoke = useConfirmAction<{ userId: string; badgeId: string; name: string }>();
  const candidates = debounced.length >= 2 ? usersQuery.data?.items ?? [] : [];
  const owned = new Set((userBadgesQuery.data ?? []).map((ub) => ub.badgeId));
  const awardable = badges.filter((b) => b.isActive && !owned.has(b.id));
  const stats = statsQuery.data;

  return (
    <section className="bg-surface rounded-2xl border border-border p-5 space-y-4" aria-labelledby="user-badges-heading" data-testid="user-badges-panel">
      <h2 id="user-badges-heading" className="font-semibold text-text flex items-center gap-2"><UserSearch size={18} className="text-primary" /> Attribution manuelle & évaluation</h2>
      <SearchInput value={search} onChange={setSearch} placeholder="Rechercher un utilisateur (nom, e-mail)…" />
      {debounced.length >= 2 && (
        usersQuery.isPending ? <LoadingState variant="inline" label="Recherche..." />
        : usersQuery.isError ? <ErrorState error={usersQuery.error} onRetry={() => void usersQuery.refetch()} compact />
        : candidates.length === 0 ? <p className="text-sm text-muted">Aucun utilisateur ne correspond.</p>
        : (
          <ul className="flex flex-wrap gap-2" aria-label="Résultats">
            {candidates.map((u) => (
              <li key={u.id}>
                <button type="button" onClick={() => { setSelected(u); setBadgeId(''); }} className={clsx('px-3 py-1.5 rounded-full text-xs font-medium border transition-colors', selected?.id === u.id ? 'bg-primary text-white border-primary' : 'border-border text-text hover:border-primary/40')} data-testid={`user-pick-${u.id}`}>
                  {fullName(u)} <span className="opacity-70">· {u.email}</span>
                </button>
              </li>
            ))}
          </ul>
        )
      )}

      {selected && (
        <div className="rounded-xl border border-border p-4 space-y-4" data-testid="user-badges-detail">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-text">{fullName(selected)}</p>
              <p className="text-xs text-muted">{selected.email}</p>
            </div>
            <Button size="sm" variant="outline" icon={RefreshCw} onClick={() => evaluate.mutate(selected.id)} loading={evaluate.isPending} loadingLabel="Évaluation..." data-testid="evaluate-user">Réévaluer les badges automatiques</Button>
          </div>

          {statsQuery.isPending ? <LoadingState variant="inline" label="Calcul des indicateurs..." /> : stats && (
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {[
                ['Ancienneté', `${stats.accountAgeDays} j`],
                stats.isSeller ? ['Ventes terminées', String(stats.completedSales)] : ['Achats terminés', String(stats.completedPurchases)],
                stats.isSeller ? ['Note moyenne', stats.averageRating != null ? `${stats.averageRating.toFixed(2)}/5 (${stats.reviewsReceived})` : '—'] : ['Avis déposés', String(stats.reviewsGiven)],
                stats.isSeller ? ['Livraisons à l’heure', stats.onTimeDeliveryRate != null ? `${Math.round(stats.onTimeDeliveryRate)} %` : '—'] : ['Litiges ouverts', String(stats.disputesOpened)],
              ].map(([label, value]) => (
                <div key={label} className="bg-surface-secondary rounded-lg px-3 py-2"><dt className="text-muted">{label}</dt><dd className="font-semibold text-text">{value}</dd></div>
              ))}
            </dl>
          )}

          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Badges détenus</p>
            {userBadgesQuery.isPending ? <LoadingState variant="inline" label="Chargement..." /> : (userBadgesQuery.data ?? []).length === 0 ? <p className="text-sm text-muted">Aucun badge pour le moment.</p> : (
              <ul className="flex flex-wrap gap-2">
                {(userBadgesQuery.data ?? []).map((ub) => (
                  <li key={ub.id} className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    <Medal size={12} /> {ub.badge?.name ?? 'Badge'} <span className="opacity-60">{ub.source === 'manual' ? '(manuel)' : '(auto)'}</span>
                    <button type="button" onClick={() => confirmRevoke.request({ userId: ub.userId, badgeId: ub.badgeId, name: ub.badge?.name ?? 'ce badge' })} className="p-1 rounded-full hover:bg-primary/20" aria-label={`Retirer ${ub.badge?.name ?? 'le badge'}`}><X size={12} /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <FormField as="select" label="Attribuer un badge" value={badgeId} onChange={(e) => setBadgeId(e.target.value)} className="flex-1" data-testid="award-badge-select">
              <option value="">— Choisir un badge —</option>
              {awardable.map((b) => <option key={b.id} value={b.id}>{b.name}{b.criteria?.mode === 'manual' ? ' (manuel)' : ''}</option>)}
            </FormField>
            <Button icon={Sparkles} disabled={!badgeId} onClick={() => award.mutate({ userId: selected.id, badgeId }, { onSuccess: () => setBadgeId('') })} loading={award.isPending} loadingLabel="Attribution..." data-testid="award-badge">Attribuer</Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmRevoke.isOpen}
        variant="warning"
        title="Retirer ce badge ?"
        description={confirmRevoke.target ? `Le badge « ${confirmRevoke.target.name} » sera retiré du profil public de l'utilisateur.` : undefined}
        confirmLabel="Retirer"
        loadingLabel="Retrait..."
        loading={revoke.isPending}
        onConfirm={() => void confirmRevoke.run((t) => revoke.mutateAsync({ userId: t.userId, badgeId: t.badgeId }))}
        onCancel={confirmRevoke.cancel}
      />
    </section>
  );
}

export default function AdminBadgesPage() {
  useTitle('Badges de réputation | Administration');
  const badgesQuery = useBadges(true);
  const statsQuery = useBadgeStats();
  const remove = useRemoveBadge();
  const seed = useSeedDefaultBadges();
  const confirmRemove = useConfirmAction<ApiBadge>();
  const confirmSeed = useConfirmAction<true>();
  const [dialog, setDialog] = useState<{ open: boolean; badge: ApiBadge | null }>({ open: false, badge: null });
  const badges = badgesQuery.data ?? [];
  const stats = statsQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Badges de réputation"
        subtitle="Définissez les critères d'obtention (ventes, notes, délais, incidents…) ; les badges automatiques sont réévalués après chaque vente, avis et maintenance"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" icon={Sparkles} onClick={() => confirmSeed.request(true)} loading={seed.isPending} loadingLabel="Création..." data-testid="seed-badges">Badges par défaut</Button>
            <Button icon={Plus} onClick={() => setDialog({ open: true, badge: null })} data-testid="badge-add">Nouveau badge</Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statsQuery.isPending ? Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />) : statsQuery.isError ? <div className="sm:col-span-3"><ErrorState error={statsQuery.error} onRetry={() => void statsQuery.refetch()} compact /></div> : stats && (
          <>
            <div className="bg-surface rounded-xl border border-border p-4"><p className="text-xs text-muted flex items-center gap-1"><Award size={12} /> Badges actifs</p><p className="text-2xl font-bold text-text mt-1">{stats.activeBadges} <span className="text-sm font-normal text-muted">/ {stats.totalBadges}</span></p></div>
            <div className="bg-surface rounded-xl border border-border p-4"><p className="text-xs text-muted flex items-center gap-1"><Users size={12} /> Attributions</p><p className="text-2xl font-bold text-primary mt-1">{stats.totalAwards}</p></div>
            <div className="bg-surface rounded-xl border border-border p-4"><p className="text-xs text-muted flex items-center gap-1"><Medal size={12} /> Badge le plus attribué</p><p className="text-base font-bold text-text mt-1 truncate">{stats.topBadge?.name ?? '—'}{stats.topBadge ? <span className="text-sm font-normal text-muted"> · {stats.topBadge.count}</span> : null}</p></div>
          </>
        )}
      </div>

      <DataTable<ApiBadge>
        data={badges}
        data-testid="admin-badges-table"
        isLoading={badgesQuery.isPending}
        isFetching={badgesQuery.isFetching}
        error={badgesQuery.isError ? badgesQuery.error : null}
        onRetry={() => void badgesQuery.refetch()}
        emptyIcon={Award}
        emptyTitle="Aucun badge configuré"
        emptyDescription="Créez vos badges ou générez les badges par défaut du cahier des charges (Nouveau vendeur, Vendeur vérifié, Vendeur de confiance, Livraison rapide…)."
        emptyAction={{ label: 'Créer les badges par défaut', onClick: () => confirmSeed.request(true), icon: Sparkles }}
        columns={[
          { header: 'Badge', primary: true, cell: (b) => (
            <div className="flex items-center gap-3 min-w-0">
              <span className={clsx('w-9 h-9 rounded-full flex items-center justify-center shrink-0', b.isActive ? 'bg-primary/10 text-primary' : 'bg-surface-secondary text-muted')}>{b.iconUrl ? <img src={b.iconUrl} alt="" className="w-5 h-5" /> : <Award size={16} />}</span>
              <div className="min-w-0"><p className="font-medium text-text truncate">{b.name}</p>{b.description && <p className="text-xs text-muted line-clamp-2">{b.description}</p>}</div>
            </div>
          ) },
          { header: 'Mode', mobile: true, cell: (b) => (
            <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium', b.criteria?.mode === 'manual' ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200')}>
              {b.criteria?.mode === 'manual' ? <><Hand size={11} /> Manuel</> : <><Wand2 size={11} /> Automatique</>}
            </span>
          ) },
          { header: 'Public', cell: (b) => <span className="text-xs text-muted">{AUDIENCE_LABELS[b.criteria?.audience ?? 'any']}</span> },
          { header: 'Critères', cell: (b) => {
            const parts = describeCriteria(b.criteria);
            return parts.length === 0 ? <span className="text-xs text-muted">Aucun critère chiffré</span> : <ul className="text-xs text-muted space-y-0.5">{parts.slice(0, 3).map((p) => <li key={p}>• {p}</li>)}{parts.length > 3 && <li>+ {parts.length - 3} autre(s)</li>}</ul>;
          } },
          { header: 'Statut', mobile: true, cell: (b) => <span className={clsx('text-xs font-medium', b.isActive ? 'text-emerald-600' : 'text-muted')}>{b.isActive ? 'Actif' : 'Inactif'}</span> },
          { header: 'Créé le', cell: (b) => <span className="text-xs text-muted">{formatDate(b.createdAt)}</span> },
        ]}
        actions={(b) => (
          <div className="flex items-center gap-1 justify-end">
            <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setDialog({ open: true, badge: b })} aria-label={`Modifier ${b.name}`}>Modifier</Button>
            <Button size="sm" variant="ghost" icon={Trash2} className="text-danger" onClick={() => confirmRemove.request(b)} aria-label={`Supprimer ${b.name}`} data-testid={`badge-delete-${b.id}`}>Supprimer</Button>
          </div>
        )}
      />

      <UserBadgesPanel badges={badges} />

      <BadgeFormDialog open={dialog.open} badge={dialog.badge} onClose={() => setDialog({ open: false, badge: null })} />

      <ConfirmDialog
        open={confirmRemove.isOpen}
        variant="destructive"
        title="Supprimer ce badge ?"
        description={confirmRemove.target ? <>Le badge <strong>{confirmRemove.target.name}</strong> sera supprimé et retiré de tous les profils qui le détiennent.</> : null}
        confirmLabel="Supprimer"
        loadingLabel="Suppression..."
        loading={remove.isPending}
        onConfirm={() => void confirmRemove.run((b) => remove.mutateAsync(b.id))}
        onCancel={confirmRemove.cancel}
      />
      <ConfirmDialog
        open={confirmSeed.isOpen}
        title="Créer les badges par défaut ?"
        description="Les badges du cahier des charges (Nouveau vendeur, Vendeur vérifié, Vendeur de confiance, Livraison rapide, Vendeur réactif, Excellent service, Acheteur fiable, Membre actif, Réputation excellente) seront créés s'ils n'existent pas encore. Les badges existants ne sont pas modifiés."
        confirmLabel="Créer"
        loadingLabel="Création..."
        loading={seed.isPending}
        onConfirm={() => void confirmSeed.run(() => seed.mutateAsync())}
        onCancel={confirmSeed.cancel}
      />
    </div>
  );
}

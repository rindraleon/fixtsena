import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Award, BadgeCheck, Camera, CheckCircle2, Clock, ExternalLink, ImagePlus, Info, Package, Send, Star, Store, TrendingUp, Users, XCircle, Crown } from 'lucide-react';
import clsx from 'clsx';
import { useTitle } from '../../hooks';
import { useAuth } from '../../context/AuthContext';
import { useMyShop, useShopEligibility } from '../../hooks/queries/useShops';
import { useCategories } from '../../hooks/queries/useCategories';
import { useProducts } from '../../hooks/queries/useProducts';
import { useUserBadges } from '../../hooks/queries/useBadges';
import { useCreateShop, useSubmitShop, useUpdateShop, useUploadShopImage } from '../../hooks/mutations/useShopMutations';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import { Button, ConfirmDialog, ErrorState, LoadingState } from '../../components/common';
import MediaImage from '../../components/common/MediaImage';
import { FormError, FormField } from '../../components/form';
import { ShopLevelBadge } from '../../components/shops';
import PageHeader from '../../shared/components/PageHeader';
import { getFieldErrors } from '../../lib/api-error';
import { formatDate } from '../../lib/format';
import { resolveMediaUrl } from '../../lib/media';
import { SHOP_LEVEL_LABELS, type ApiShop, type ShopLevel, type UpsertShopDto } from '../../types/api';

interface ShopForm {
  name: string;
  description: string;
  location: string;
  city: string;
  deliveryConditions: string;
  mainCategoryIds: string[];
  featuredProductIds: string[];
}

const EMPTY_FORM: ShopForm = { name: '', description: '', location: '', city: '', deliveryConditions: '', mainCategoryIds: [], featuredProductIds: [] };
const IMAGE_MAX_MB = 5;

function toForm(shop: ApiShop | null | undefined): ShopForm {
  if (!shop) return EMPTY_FORM;
  return {
    name: shop.name,
    description: shop.description ?? '',
    location: shop.location ?? '',
    city: shop.city ?? '',
    deliveryConditions: shop.deliveryConditions ?? '',
    mainCategoryIds: shop.mainCategoryIds ?? [],
    featuredProductIds: shop.featuredProductIds ?? [],
  };
}

function validate(form: ShopForm): Partial<Record<keyof ShopForm, string>> {
  const errors: Partial<Record<keyof ShopForm, string>> = {};
  if (form.name.trim().length < 3) errors.name = 'Le nom doit contenir au moins 3 caractères.';
  if (form.name.trim().length > 80) errors.name = '80 caractères maximum.';
  if (form.description.length > 2000) errors.description = '2000 caractères maximum.';
  if (form.location.length > 120) errors.location = '120 caractères maximum.';
  if (form.city.length > 80) errors.city = '80 caractères maximum.';
  if (form.deliveryConditions.length > 1000) errors.deliveryConditions = '1000 caractères maximum.';
  if (form.mainCategoryIds.length > 5) errors.mainCategoryIds = '5 catégories principales maximum.';
  if (form.featuredProductIds.length > 8) errors.featuredProductIds = '8 produits mis en avant maximum.';
  return errors;
}

const STATUS_STYLES: Record<ApiShop['status'], { tone: string; icon: typeof Info; hint: string }> = {
  draft: { tone: 'bg-surface-secondary text-text border-border', icon: Info, hint: 'Votre boutique est en brouillon : complétez-la puis soumettez-la pour vérification. Elle n’est pas visible du public.' },
  pending_verification: { tone: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/30', icon: Clock, hint: 'Votre boutique est en cours de vérification par l’équipe Tsena. Vous serez notifié par e-mail dès son activation.' },
  active: { tone: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:border-emerald-500/30', icon: CheckCircle2, hint: 'Votre boutique est active et visible par tous les acheteurs.' },
  suspended: { tone: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-500/10 dark:text-red-200 dark:border-red-500/30', icon: XCircle, hint: 'Votre boutique est suspendue : vos produits ne sont plus visibles et vous ne pouvez plus recevoir de commandes. Contactez le support.' },
  disabled: { tone: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-500/10 dark:text-red-200 dark:border-red-500/30', icon: XCircle, hint: 'Votre boutique est désactivée.' },
  archived: { tone: 'bg-surface-secondary text-muted border-border', icon: Info, hint: 'Votre boutique est archivée.' },
};

export default function SellerStorePage() {
  useTitle('Ma boutique | Vendeur');
  const { user } = useAuth();
  const shopQuery = useMyShop();
  const shop = shopQuery.data ?? null;
  const hasShop = !!shop;
  const eligibilityQuery = useShopEligibility({ enabled: hasShop });
  const categoriesQuery = useCategories({ isActive: true });
  const myProductsQuery = useProducts({ sellerId: user?.id, limit: 50, sortBy: 'createdAt', order: 'DESC' }, { enabled: hasShop && !!user });
  const badges = useUserBadges(user?.id);
  const activeBadges = (badges.data ?? []).filter((ub) => ub.badge && ub.isActive);

  const createShop = useCreateShop();
  const updateShop = useUpdateShop();
  const submitShop = useSubmitShop();
  const uploadImage = useUploadShopImage();
  const submitConfirm = useConfirmAction<ApiShop>();
  const mutation = hasShop ? updateShop : createShop;

  const [form, setForm] = useState<ShopForm>(() => toForm(shop));
  const [touched, setTouched] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [syncedShopId, setSyncedShopId] = useState<string | null>(null);

  const shopKey = shop ? `${shop.id}:${shop.updatedAt}` : null;
  if (shopKey && shopKey !== syncedShopId) {
    setSyncedShopId(shopKey);
    setForm(toForm(shop));
  }

  const errors = validate(form);
  const serverErrors = getFieldErrors(mutation.error);
  const fieldError = (key: keyof ShopForm) => serverErrors[key] ?? (touched ? errors[key] : undefined);
  const set = <K extends keyof ShopForm>(key: K, value: ShopForm[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  const toggleInList = (key: 'mainCategoryIds' | 'featuredProductIds', id: string) =>
    setForm((prev) => ({ ...prev, [key]: prev[key].includes(id) ? prev[key].filter((x) => x !== id) : [...prev[key], id] }));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (Object.keys(errors).length > 0 || mutation.isPending) return;
    const dto: UpsertShopDto & { name: string } = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      location: form.location.trim() || undefined,
      city: form.city.trim(),
      deliveryConditions: form.deliveryConditions.trim() || undefined,
      mainCategoryIds: form.mainCategoryIds,
      featuredProductIds: form.featuredProductIds,
    };
    if (hasShop) updateShop.mutate(dto); else createShop.mutate(dto);
  };

  const handleImage = (kind: 'logo' | 'cover') => (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setImageError('Seules les images sont acceptées.'); return; }
    if (file.size > IMAGE_MAX_MB * 1024 * 1024) { setImageError(`Image trop volumineuse (max ${IMAGE_MAX_MB} Mo).`); return; }
    setImageError(null);
    uploadImage.mutate({ kind, file });
  };

  if (shopQuery.isPending) return <LoadingState variant="page" label="Chargement de votre boutique..." />;
  if (shopQuery.isError) return <ErrorState error={shopQuery.error} onRetry={() => void shopQuery.refetch()} retrying={shopQuery.isFetching} />;

  const status = shop ? STATUS_STYLES[shop.status] : null;
  const StatusIcon = status?.icon ?? Info;
  const canSubmit = shop?.status === 'draft';
  const eligibility = eligibilityQuery.data;
  const categories = categoriesQuery.data?.items ?? [];
  const myProducts = (myProductsQuery.data?.items ?? []).filter((p) => p.status === 'active' || p.status === 'published');

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Ma boutique"
        subtitle={hasShop ? 'Votre vitrine publique : identité, niveau, visuels et conditions de vente' : 'Créez votre boutique pour vendre sur Tsena'}
        actions={shop && shop.status === 'active' ? <Link to={`/boutiques/${shop.slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"><ExternalLink size={14} /> Voir ma boutique publique</Link> : undefined}
      />

      {shop && status && (
        <section className={clsx('rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-4', status.tone)} aria-live="polite" data-testid="shop-status-banner">
          <StatusIcon size={22} className="shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold flex flex-wrap items-center gap-2">Statut : {shop.statusLabel} <ShopLevelBadge level={shop.level} label={shop.levelLabel} size="sm" /> {shop.identityVerified && <span className="inline-flex items-center gap-1 text-xs font-medium"><BadgeCheck size={13} /> Identité vérifiée</span>}</p>
            <p className="text-sm opacity-90 mt-0.5">{shop.statusReason && shop.status !== 'active' ? `${status.hint} Motif : ${shop.statusReason}` : status.hint}</p>
          </div>
          {canSubmit && (
            <Button icon={Send} onClick={() => submitConfirm.request(shop)} loading={submitShop.isPending} loadingLabel="Envoi..." data-testid="shop-submit">Soumettre pour vérification</Button>
          )}
        </section>
      )}

      {shop && (
        <section className="bg-surface rounded-xl border border-border overflow-hidden" aria-labelledby="visuals-heading">
          <h2 id="visuals-heading" className="sr-only">Visuels de la boutique</h2>
          <div className="relative h-40 sm:h-52 bg-gradient-to-r from-primary via-primary/90 to-primary-dark">
            {shop.coverUrl && <MediaImage src={shop.coverUrl} alt="Image de couverture" className="w-full h-full object-cover" fallback={null} />}
            <input ref={coverInputRef} type="file" accept="image/*" className="sr-only" onChange={handleImage('cover')} aria-label="Changer l'image de couverture" />
            <button type="button" onClick={() => coverInputRef.current?.click()} disabled={uploadImage.isPending} className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 hover:bg-black/75 text-white text-xs font-medium backdrop-blur-sm disabled:opacity-60" data-testid="shop-cover-upload">
              <ImagePlus size={14} /> {shop.coverUrl ? 'Changer la couverture' : 'Ajouter une couverture'}
            </button>
          </div>
          <div className="px-5 pb-5 flex flex-col sm:flex-row sm:items-end gap-4 -mt-10">
            <div className="relative w-24 h-24 shrink-0">
              <div className="w-24 h-24 rounded-2xl bg-surface border-4 border-surface shadow-md flex items-center justify-center overflow-hidden text-primary">
                {shop.logoUrl ? <MediaImage src={shop.logoUrl} alt="Logo de la boutique" className="w-full h-full object-cover" fallback={<Store size={32} />} /> : <Store size={32} />}
              </div>
              <input ref={logoInputRef} type="file" accept="image/*" className="sr-only" onChange={handleImage('logo')} aria-label="Changer le logo" />
              <button type="button" onClick={() => logoInputRef.current?.click()} disabled={uploadImage.isPending} className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow hover:bg-primary-dark disabled:opacity-60" aria-label="Changer le logo" data-testid="shop-logo-upload"><Camera size={14} /></button>
            </div>
            <div className="flex-1 min-w-0 pt-2 sm:pt-0">
              <p className="text-xs text-muted">Logo carré (min. 256 px) et couverture large (min. 1200 × 400 px), {IMAGE_MAX_MB} Mo max. chacun.</p>
              {uploadImage.isPending && <p className="text-xs text-primary mt-1">Envoi de l'image…</p>}
              {imageError && <p className="text-xs text-danger mt-1" role="alert">{imageError}</p>}
            </div>
            <dl className="grid grid-cols-3 gap-3 text-center sm:text-left">
              <div><dt className="text-[11px] uppercase tracking-wide text-muted flex items-center gap-1"><Package size={11} /> Produits</dt><dd className="font-bold text-text">{shop.productsCount}</dd></div>
              <div><dt className="text-[11px] uppercase tracking-wide text-muted flex items-center gap-1"><Users size={11} /> Abonnés</dt><dd className="font-bold text-text" data-testid="shop-followers-count">{shop.followersCount}</dd></div>
              <div><dt className="text-[11px] uppercase tracking-wide text-muted flex items-center gap-1"><Star size={11} /> Note</dt><dd className="font-bold text-text">{shop.reviewsCount > 0 ? `${shop.averageRating.toFixed(1)}` : '—'} <span className="text-xs font-normal text-muted">({shop.reviewsCount})</span></dd></div>
            </dl>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <form onSubmit={handleSubmit} noValidate className="lg:col-span-3 bg-surface rounded-xl border border-border p-6 space-y-4" aria-busy={mutation.isPending} data-testid="shop-form">
          <h2 className="font-semibold text-text flex items-center gap-2"><Store size={18} className="text-primary" /> {hasShop ? 'Informations de la boutique' : 'Créer ma boutique'}</h2>
          {!hasShop && (
            <p className="text-sm text-muted bg-primary/5 border border-primary/10 rounded-lg p-3 flex gap-2"><Info size={16} className="text-primary shrink-0 mt-0.5" /> La création d'une boutique est obligatoire pour vendre. Elle démarre en brouillon : vous pourrez ajouter logo et couverture, puis la soumettre pour vérification.</p>
          )}
          {mutation.isError && <FormError error={mutation.error} handledFields={['name', 'description', 'location', 'city', 'deliveryConditions', 'mainCategoryIds', 'featuredProductIds']} />}

          <FormField label="Nom de la boutique" required value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={80} error={fieldError('name')} placeholder="Ex. Rakoto Électronique" data-testid="shop-name" />
          <FormField as="textarea" label="Description" rows={4} value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={2000} hint={`${form.description.length}/2000 — présentez votre activité, vos spécialités, vos garanties.`} error={fieldError('description')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Ville" value={form.city} onChange={(e) => set('city', e.target.value)} maxLength={80} placeholder="Ex. Antananarivo" hint="Alimente le filtre « Localisation » du catalogue : les clients retrouvent vos produits par ville." error={fieldError('city')} list="shop-city-suggestions" />
            <FormField label="Localisation générale" value={form.location} onChange={(e) => set('location', e.target.value)} maxLength={120} placeholder="Ex. Antananarivo — Analakely" hint="Ville / quartier affiché publiquement (pas d'adresse précise)." error={fieldError('location')} />
          </div>
          <datalist id="shop-city-suggestions">
            {['Antananarivo', 'Antsirabe', 'Toamasina', 'Fianarantsoa', 'Mahajanga', 'Toliara', 'Antsiranana', 'Nosy Be', 'Morondava', 'Fort-Dauphin'].map((c) => <option key={c} value={c} />)}
          </datalist>
          <FormField as="textarea" label="Conditions de livraison" rows={3} value={form.deliveryConditions} onChange={(e) => set('deliveryConditions', e.target.value)} maxLength={1000} placeholder="Délais, zones desservies, retrait en main propre…" error={fieldError('deliveryConditions')} />

          <fieldset>
            <legend className="block text-sm font-medium text-text mb-1.5">Catégories principales <span className="text-xs font-normal text-muted">(5 max.)</span></legend>
            {categoriesQuery.isPending ? <LoadingState variant="inline" label="Chargement des catégories..." /> : categoriesQuery.isError ? <ErrorState error={categoriesQuery.error} onRetry={() => void categoriesQuery.refetch()} compact /> : (
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => {
                  const selected = form.mainCategoryIds.includes(c.id);
                  return (
                    <label key={c.id} className={clsx('cursor-pointer px-3 py-1.5 rounded-full text-xs font-medium border transition-colors', selected ? 'bg-primary text-white border-primary' : 'bg-surface border-border text-muted hover:border-primary/40')}>
                      <input type="checkbox" className="sr-only" checked={selected} onChange={() => toggleInList('mainCategoryIds', c.id)} /> {c.name}
                    </label>
                  );
                })}
              </div>
            )}
            {fieldError('mainCategoryIds') && <p className="text-xs text-danger mt-1" role="alert">{fieldError('mainCategoryIds')}</p>}
          </fieldset>

          {hasShop && (
            <fieldset>
              <legend className="block text-sm font-medium text-text mb-1.5">Produits mis en avant <span className="text-xs font-normal text-muted">(8 max., affichés en tête de votre vitrine)</span></legend>
              {myProductsQuery.isPending ? <LoadingState variant="inline" label="Chargement de vos produits..." /> : myProductsQuery.isError ? <ErrorState error={myProductsQuery.error} onRetry={() => void myProductsQuery.refetch()} compact /> : myProducts.length === 0 ? (
                <p className="text-xs text-muted">Publiez d'abord des produits pour pouvoir les mettre en avant.</p>
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                  {myProducts.map((p) => {
                    const selected = form.featuredProductIds.includes(p.id);
                    return (
                      <li key={p.id}>
                        <label className={clsx('flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-sm transition-colors', selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40')}>
                          <input type="checkbox" checked={selected} onChange={() => toggleInList('featuredProductIds', p.id)} className="accent-primary" />
                          <span className="truncate text-text">{p.name}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
              {fieldError('featuredProductIds') && <p className="text-xs text-danger mt-1" role="alert">{fieldError('featuredProductIds')}</p>}
            </fieldset>
          )}

          <div className="flex justify-end pt-2">
            <Button type="submit" loading={mutation.isPending} loadingLabel="Enregistrement..." data-testid="shop-save">{hasShop ? 'Enregistrer les modifications' : 'Créer ma boutique'}</Button>
          </div>
        </form>

        <aside className="lg:col-span-2 space-y-6">
          <section className="bg-surface rounded-xl border border-border p-5" aria-labelledby="level-heading">
            <h2 id="level-heading" className="font-semibold text-text flex items-center gap-2 mb-3"><TrendingUp size={18} className="text-primary" /> Niveau & éligibilité</h2>
            {!shop ? (
              <p className="text-sm text-muted">Créez votre boutique pour démarrer au niveau « {SHOP_LEVEL_LABELS.new} ».</p>
            ) : eligibilityQuery.isPending ? (
              <LoadingState variant="list" count={3} />
            ) : eligibilityQuery.isError ? (
              <ErrorState error={eligibilityQuery.error} onRetry={() => void eligibilityQuery.refetch()} compact />
            ) : eligibility ? (
              <div className="space-y-4">
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-surface-secondary/60 p-2"><dt className="text-muted">Ancienneté</dt><dd className="font-semibold text-text">{eligibility.performance.monthsActive} mois</dd></div>
                  <div className="rounded-lg bg-surface-secondary/60 p-2"><dt className="text-muted">Commandes terminées</dt><dd className="font-semibold text-text">{eligibility.performance.completedOrders}</dd></div>
                  <div className="rounded-lg bg-surface-secondary/60 p-2"><dt className="text-muted">Note moyenne</dt><dd className="font-semibold text-text">{eligibility.performance.reviewCount > 0 ? eligibility.performance.rating.toFixed(2) : '—'}</dd></div>
                  <div className="rounded-lg bg-surface-secondary/60 p-2"><dt className="text-muted">Taux d'incidents</dt><dd className="font-semibold text-text">{eligibility.performance.incidentRate.toFixed(1)} %</dd></div>
                </dl>
                <ul className="space-y-2" data-testid="shop-eligibility">
                  {eligibility.levels.map((entry) => {
                    const isCurrent = entry.level === shop.level;
                    return (
                      <li key={entry.level} className={clsx('rounded-lg border p-3', isCurrent ? 'border-primary bg-primary/5' : entry.eligible ? 'border-emerald-200 dark:border-emerald-500/30' : 'border-border')}>
                        <details>
                          <summary className="flex items-center justify-between gap-2 cursor-pointer list-none">
                            <span className="flex items-center gap-2"><ShopLevelBadge level={entry.level as ShopLevel} label={entry.levelLabel} /> {isCurrent && <span className="text-[11px] text-primary font-medium">Niveau actuel</span>}</span>
                            <span className={clsx('text-[11px] font-medium', entry.eligible ? 'text-emerald-600' : 'text-muted')}>{entry.eligible ? 'Critères remplis' : `${entry.checks.filter((c) => c.met).length}/${entry.checks.length} critères`}</span>
                          </summary>
                          <ul className="mt-2 space-y-1">
                            {entry.checks.map((check) => (
                              <li key={check.key} className="flex items-start gap-2 text-xs">
                                {check.met ? <CheckCircle2 size={13} className="text-emerald-600 shrink-0 mt-0.5" /> : <XCircle size={13} className="text-muted shrink-0 mt-0.5" />}
                                <span className="text-text">{check.label} <span className="text-muted">— requis : {check.required} · actuel : {check.current}</span></span>
                              </li>
                            ))}
                          </ul>
                        </details>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-[11px] text-muted">Les niveaux Gold et Premium s'obtiennent via un <Link to="/dashboard/vendeur/abonnement" className="text-primary hover:underline inline-flex items-center gap-1"><Crown size={11} /> abonnement vendeur</Link>, sous réserve des critères ci-dessus. Le niveau Fondateur est attribué par l'administration.</p>
              </div>
            ) : null}
          </section>

          <section className="bg-surface rounded-xl border border-border p-5" aria-labelledby="badges-heading">
            <h2 id="badges-heading" className="font-semibold text-text flex items-center gap-2 mb-3"><Award size={18} className="text-primary" /> Badges de réputation</h2>
            {badges.isPending ? <LoadingState variant="inline" label="Chargement..." /> : badges.isError ? <p className="text-sm text-danger">Badges indisponibles</p> : activeBadges.length === 0 ? (
              <p className="text-sm text-muted">Aucun badge pour le moment — ils sont attribués automatiquement selon vos ventes et vos avis.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {activeBadges.map((ub) => (
                  <li key={ub.id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/20 text-primary text-xs font-medium" title={ub.badge?.description ?? undefined}>
                    {ub.badge?.iconUrl ? <img src={resolveMediaUrl(ub.badge.iconUrl)} alt="" className="w-3.5 h-3.5" /> : <Award size={12} />} {ub.badge?.name}
                  </li>
                ))}
              </ul>
            )}
            {shop?.activatedAt && <p className="text-[11px] text-muted mt-3">Boutique active depuis le {formatDate(shop.activatedAt)}.</p>}
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={submitConfirm.isOpen}
        title="Soumettre la boutique pour vérification ?"
        description="L'équipe Tsena vérifiera les informations de votre boutique. Pendant la vérification, vous ne pourrez plus modifier son nom. Assurez-vous que le logo, la description et les conditions de livraison sont complets."
        confirmLabel="Soumettre"
        loadingLabel="Envoi..."
        loading={submitShop.isPending}
        onConfirm={() => void submitConfirm.run(() => submitShop.mutateAsync())}
        onCancel={submitConfirm.cancel}
      />
    </div>
  );
}

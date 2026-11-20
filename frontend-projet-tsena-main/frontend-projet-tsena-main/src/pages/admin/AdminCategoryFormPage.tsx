import { useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Folder, ImagePlus, Trash2 } from 'lucide-react';
import { useTitle } from '../../hooks';
import { useCategories, useCategory } from '../../hooks/queries/useCategories';
import { useCreateCategory, useUpdateCategory, useUploadCategoryImage } from '../../hooks/mutations/useCategoryMutations';
import { Button, EmptyState, ErrorState, LoadingState } from '../../components/common';
import { FormError, FormField } from '../../components/form';
import PageHeader from '../../shared/components/PageHeader';
import { getFieldErrors, isNotFoundError } from '../../lib/api-error';
import { slugify } from '../../lib/utils';
import type { ApiCategory, CreateCategoryDto } from '../../types/api';
import { resolveMediaUrl } from '../../lib/media';

const BACK = '/dashboard/admin/categories';
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const IMAGE_MAX_MB = 5;

interface FormState { name: string; slug: string; description: string; parentId: string; sortOrder: string; isActive: boolean }

function CategoryForm({ category, onSaved }: { category?: ApiCategory; onSaved: () => void }) {
  const isEdit = !!category;
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const uploadImage = useUploadCategoryImage();
  const parentsQuery = useCategories({ limit: 100, includeInactive: true });
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState>({
    name: category?.name ?? '',
    slug: category?.slug ?? '',
    description: category?.description ?? '',
    parentId: category?.parentId ?? '',
    sortOrder: String(category?.sortOrder ?? 0),
    isActive: category?.isActive ?? true,
  });
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(category?.imageUrl ?? null);
  const [removeImage, setRemoveImage] = useState(false);
  const [imageError, setImageError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const mutation = isEdit ? updateCategory : createCategory;
  const busy = mutation.isPending || uploadImage.isPending;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const clientErrors = {
    name: form.name.trim().length < 2 ? 'Le nom doit contenir au moins 2 caractères.' : form.name.trim().length > 100 ? 'Le nom ne peut pas dépasser 100 caractères.' : undefined,
    slug: form.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug) ? 'Le slug ne peut contenir que des lettres minuscules, chiffres et tirets.' : undefined,
    description: form.description.length > 500 ? 'La description ne peut pas dépasser 500 caractères.' : undefined,
    sortOrder: form.sortOrder !== '' && (!Number.isInteger(Number(form.sortOrder)) || Number(form.sortOrder) < 0) ? "L'ordre doit être un entier positif." : undefined,
    parentId: isEdit && form.parentId === category?.id ? 'Une catégorie ne peut pas être son propre parent.' : undefined,
  };
  const hasClientErrors = Object.values(clientErrors).some(Boolean);
  const errors = { ...getFieldErrors(mutation.error), ...(submitted ? Object.fromEntries(Object.entries(clientErrors).filter(([, v]) => v)) : {}) } as Record<string, string | undefined>;

  const onFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImageError('');
    if (!IMAGE_TYPES.includes(file.type)) { setImageError('Format non pris en charge (JPG, PNG ou WEBP).'); return; }
    if (file.size > IMAGE_MAX_MB * 1024 * 1024) { setImageError(`L'image dépasse ${IMAGE_MAX_MB} Mo.`); return; }
    setPendingFile(file);
    setRemoveImage(false);
    setPreview(URL.createObjectURL(file));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (hasClientErrors || busy) return;
    const dto: CreateCategoryDto = {
      name: form.name.trim(),
      slug: form.slug.trim() || undefined,
      description: form.description.trim() || undefined,
      parentId: form.parentId || undefined,
      sortOrder: form.sortOrder === '' ? undefined : Number(form.sortOrder),
      isActive: form.isActive,
      ...(removeImage ? { imageUrl: '' } : {}),
    };
    try {
      const saved = isEdit && category
        ? await updateCategory.mutateAsync({ id: category.id, dto })
        : await createCategory.mutateAsync(dto);
      if (pendingFile) await uploadImage.mutateAsync({ categoryId: saved.id, file: pendingFile });
      onSaved();
    } catch {
    }
  };

  const parentOptions = (parentsQuery.data?.items ?? []).filter((c) => c.id !== category?.id);

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="space-y-6" aria-busy={busy}>
      {mutation.isError && <FormError error={mutation.error} handledFields={Object.keys(errors)} />}

      <section className="bg-surface rounded-xl border border-border p-6 space-y-4">
        <h3 className="font-semibold text-text flex items-center gap-2"><Folder size={18} className="text-primary" /> Informations</h3>
        <FormField label="Nom" value={form.name} onChange={(e) => { set('name', e.target.value); if (!slugTouched) set('slug', slugify(e.target.value)); }} error={errors.name} maxLength={100} required />
        <FormField label="Slug (URL)" value={form.slug} onChange={(e) => { setSlugTouched(true); set('slug', e.target.value.toLowerCase()); }} error={errors.slug} hint="Généré automatiquement à partir du nom si laissé vide." maxLength={100} />
        <FormField as="textarea" label="Description" value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} maxLength={500} error={errors.description} hint={`${form.description.length}/500`} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="category-parent" className="block text-sm font-medium text-text mb-1">Catégorie parente</label>
            <select id="category-parent" value={form.parentId} onChange={(e) => set('parentId', e.target.value)} disabled={parentsQuery.isPending} className="w-full px-3 py-2 border border-input-border bg-input-bg rounded-lg text-sm text-text focus:outline-none focus:border-primary disabled:opacity-60">
              <option value="">Aucune (catégorie racine)</option>
              {parentOptions.map((c) => <option key={c.id} value={c.id}>{c.parent ? `${c.parent.name} › ` : ''}{c.name}</option>)}
            </select>
            {parentsQuery.isError && <p className="text-xs text-danger mt-1">Impossible de charger les catégories parentes.</p>}
            {errors.parentId && <p className="text-xs text-danger mt-1" role="alert">{errors.parentId}</p>}
          </div>
          <FormField label="Ordre d'affichage" type="number" inputMode="numeric" min={0} value={form.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} error={errors.sortOrder} />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-text cursor-pointer select-none">
          <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} className="accent-primary" /> Catégorie active (visible dans la boutique)
        </label>
      </section>

      <section className="bg-surface rounded-xl border border-border p-6 space-y-3">
        <h3 className="font-semibold text-text flex items-center gap-2"><ImagePlus size={18} className="text-primary" /> Image</h3>
        <div className="flex items-center gap-4">
          <div className="w-24 h-24 rounded-xl bg-surface-secondary border border-border overflow-hidden flex items-center justify-center text-muted shrink-0">
            {preview && !removeImage ? <img src={resolveMediaUrl(preview)} alt="" className="w-full h-full object-cover" /> : <Folder size={28} />}
          </div>
          <div className="space-y-2">
            <input ref={fileRef} type="file" accept={IMAGE_TYPES.join(',')} className="hidden" onChange={onFile} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" icon={ImagePlus} onClick={() => fileRef.current?.click()} disabled={busy}>{preview && !removeImage ? "Changer l'image" : 'Ajouter une image'}</Button>
              {preview && !removeImage && isEdit && !pendingFile && (
                <Button type="button" variant="ghost" size="sm" icon={Trash2} onClick={() => setRemoveImage(true)} disabled={busy}>Retirer</Button>
              )}
            </div>
            <p className="text-xs text-muted">JPG, PNG ou WEBP · {IMAGE_MAX_MB} Mo max. {pendingFile && <span className="text-primary">Sera téléversée à l'enregistrement.</span>}</p>
            {imageError && <p className="text-xs text-danger" role="alert">{imageError}</p>}
          </div>
        </div>
      </section>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onSaved} disabled={busy}>Annuler</Button>
        <Button type="submit" icon={Save} loading={busy} loadingLabel={uploadImage.isPending ? "Téléversement de l'image..." : isEdit ? 'Enregistrement...' : 'Création...'} data-testid="category-form-submit">{isEdit ? 'Enregistrer les modifications' : 'Créer la catégorie'}</Button>
      </div>
    </form>
  );
}

export default function AdminCategoryFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  useTitle(isEdit ? 'Modifier la catégorie | Administration' : 'Nouvelle catégorie | Administration');
  const navigate = useNavigate();
  const categoryQuery = useCategory(id);

  if (isEdit && categoryQuery.isPending) return <LoadingState variant="detail" label="Chargement de la catégorie..." />;
  if (isEdit && categoryQuery.isError) {
    return isNotFoundError(categoryQuery.error)
      ? <EmptyState title="Catégorie introuvable" description="Cette catégorie n'existe pas ou a été supprimée." action={{ label: 'Retour aux catégories', to: BACK }} />
      : <ErrorState error={categoryQuery.error} onRetry={() => void categoryQuery.refetch()} retrying={categoryQuery.isFetching} />;
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={isEdit ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
        subtitle={isEdit ? categoryQuery.data?.name : 'Structurez le catalogue de la marketplace'}
        breadcrumb={[{ label: 'Catégories', href: BACK }, { label: isEdit ? 'Modifier' : 'Nouvelle' }]}
      />
      <CategoryForm key={categoryQuery.data?.id ?? 'new'} category={categoryQuery.data} onSaved={() => navigate(BACK)} />
    </div>
  );
}

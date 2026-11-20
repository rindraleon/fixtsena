import { useMemo, useState, type SyntheticEvent } from 'react';
import { Link } from 'react-router-dom';
import { Save, ArrowLeft, Star, Trash2, ImageOff, ChevronLeft, ChevronRight, Images } from 'lucide-react';
import Button from '../common/Button';
import ConfirmDialog from '../common/ConfirmDialog';
import MediaImage from '../common/MediaImage';
import ProductImageUploader, { type ImageFile } from '../common/ProductImageUploader';
import { FormError, FormField } from '../form';
import FormStepProgress from '../form/FormStepProgress';
import { useCategories } from '../../hooks/queries/useCategories';
import {
  useCreateProduct,
  useDeleteProductImage,
  useReorderProductImages,
  useSetPrimaryProductImage,
  useUpdateProduct,
  useUploadProductImage,
  useUploadProductImages,
} from '../../hooks/mutations/useProductMutations';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import { getFieldErrors } from '../../lib/api-error';
import { toast } from '../../lib/toast';
import { compactErrors, hasErrors, VALIDATION_MESSAGES } from '../../lib/validation';
import { PRODUCT_STATUS_LABELS, sortedProductImages, toNumber } from '../../lib/format';
import type { ApiProduct, ApiProductImage, CreateProductDto, ProductStatus } from '../../types/api';

const MAX_PRODUCT_IMAGES = 10;
const UPLOAD_BATCH_SIZE = 10;

interface ProductFormProps {
  readonly product?: ApiProduct;
  readonly backHref: string;
  readonly allowedStatuses?: readonly ProductStatus[];
  readonly onSaved: (product: ApiProduct) => void;
}

interface FormState {
  name: string;
  shortDescription: string;
  description: string;
  price: string;
  compareAtPrice: string;
  categoryId: string;
  sku: string;
  stockQuantity: string;
  lowStockThreshold: string;
  tags: string;
  isFeatured: boolean;
  status: ProductStatus;
}

const FORM_STEPS = ['Informations', 'Description', 'Images', 'Publication'] as const;
const STEP_FIELDS: readonly (readonly (keyof ReturnType<typeof validateProductForm>)[])[] = [
  ['name', 'price', 'compareAtPrice', 'categoryId', 'stockQuantity'],
  ['shortDescription'],
  [],
  [],
];

const SELLER_STATUSES: readonly ProductStatus[] = ['draft', 'active', 'unavailable', 'archived'];

function toFormState(product?: ApiProduct): FormState {
  return {
    name: product?.name ?? '',
    shortDescription: product?.shortDescription ?? '',
    description: product?.description ?? '',
    price: product ? String(toNumber(product.price)) : '',
    compareAtPrice: product?.compareAtPrice ? String(toNumber(product.compareAtPrice)) : '',
    categoryId: product?.categoryId ?? '',
    sku: product?.sku ?? '',
    stockQuantity: product ? String(product.stockQuantity) : '0',
    lowStockThreshold: product ? String(product.lowStockThreshold ?? 5) : '5',
    tags: product?.tags?.join(', ') ?? '',
    isFeatured: product?.isFeatured ?? false,
    status: product?.status ?? 'draft',
  };
}

export function validateProductForm(form: FormState) {
  const price = Number(form.price);
  const compareAt = form.compareAtPrice ? Number(form.compareAtPrice) : undefined;
  const stock = Number(form.stockQuantity);
  const trimmedName = form.name.trim();

  let nameError: string | undefined;
  if (!trimmedName) {
    nameError = VALIDATION_MESSAGES.required;
  } else if (trimmedName.length < 3) {
    nameError = VALIDATION_MESSAGES.minLength(3);
  } else if (trimmedName.length > 200) {
    nameError = VALIDATION_MESSAGES.maxLength(200);
  }

  let priceError: string | undefined;
  if (form.price === '') {
    priceError = VALIDATION_MESSAGES.required;
  } else if (Number.isNaN(price) || price < 0) {
    priceError = 'Le prix doit être un nombre positif.';
  }

  let compareAtPriceError: string | undefined;
  if (compareAt !== undefined) {
    if (Number.isNaN(compareAt) || compareAt < 0) {
      compareAtPriceError = 'Le prix barré doit être un nombre positif.';
    } else if (compareAt <= price) {
      compareAtPriceError = 'Le prix barré doit être supérieur au prix de vente.';
    }
  }

  return compactErrors({
    name: nameError,
    price: priceError,
    compareAtPrice: compareAtPriceError,
    categoryId: form.categoryId ? undefined : 'Sélectionnez une catégorie.',
    stockQuantity: Number.isNaN(stock) || stock < 0 || !Number.isInteger(stock) ? 'Le stock doit être un entier positif.' : undefined,
    shortDescription: form.shortDescription.length > 500 ? VALIDATION_MESSAGES.maxLength(500) : undefined,
  });
}

export function toProductDto(form: FormState): CreateProductDto {
  const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
  return {
    name: form.name.trim(),
    shortDescription: form.shortDescription.trim() || undefined,
    description: form.description.trim() || undefined,
    price: Number(form.price),
    compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : undefined,
    categoryId: form.categoryId,
    sku: form.sku.trim() || undefined,
    stockQuantity: Number(form.stockQuantity),
    lowStockThreshold: form.lowStockThreshold ? Number(form.lowStockThreshold) : undefined,
    tags,
    isFeatured: form.isFeatured,
    status: form.status,
  };
}

export default function ProductForm({ product, backHref, allowedStatuses = SELLER_STATUSES, onSaved }: ProductFormProps) {
  const isEdit = !!product;
  const [form, setForm] = useState<FormState>(() => toFormState(product));
  const [newCover, setNewCover] = useState<ImageFile[]>([]);
  const [newImages, setNewImages] = useState<ImageFile[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);

  const categoriesQuery = useCategories({ limit: 100 });
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const uploadImage = useUploadProductImage();
  const uploadImages = useUploadProductImages();
  const deleteImage = useDeleteProductImage();
  const setPrimaryImage = useSetPrimaryProductImage();
  const reorderImages = useReorderProductImages();
  const confirmDeleteImage = useConfirmAction<ApiProductImage>();

  const clientErrors = validateProductForm(form);
  const mutationError = isEdit ? updateProduct.error : createProduct.error;
  const serverErrors = getFieldErrors(mutationError);
  const errors: Record<string, string | undefined> = { ...serverErrors, ...(submitted ? clientErrors : {}) };
  const saving = createProduct.isPending || updateProduct.isPending || uploadImage.isPending || uploadImages.isPending;
  const imageActionPending = deleteImage.isPending || setPrimaryImage.isPending || reorderImages.isPending;

  const statusOptions = useMemo(() => {
    const options = new Set<ProductStatus>(allowedStatuses);
    if (product?.status) options.add(product.status);
    return [...options];
  }, [allowedStatuses, product?.status]);

  const existingImages = useMemo(() => sortedProductImages(product?.images), [product?.images]);
  const existingCover = existingImages.find((img) => img.isPrimary) ?? null;
  const existingGallery = existingImages.filter((img) => img.id !== existingCover?.id);
  const coverSlot = existingCover || newCover.length > 0 ? 1 : 0;
  const galleryCapacity = Math.max(0, MAX_PRODUCT_IMAGES - coverSlot - existingGallery.length);

  const moveGalleryImage = (imageId: string, direction: -1 | 1) => {
    if (!product) return;
    const ids = existingGallery.map((img) => img.id);
    const index = ids.indexOf(imageId);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderImages.mutate({ productId: product.id, imageIds: ids });
  };

  const update = <K extends keyof FormState>(field: K) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const target = event.target;
    const value = target instanceof HTMLInputElement && target.type === 'checkbox' ? target.checked : target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const goToNextStep = () => {
    setSubmitted(true);
    if (STEP_FIELDS[currentStep].some((field) => clientErrors[field])) return;
    setCurrentStep((step) => Math.min(step + 1, FORM_STEPS.length - 1));
  };

  const validateFormForSubmit = () => {
    if (!hasErrors(clientErrors)) return false;
    const invalidStep = STEP_FIELDS.findIndex((fields) => fields.some((field) => clientErrors[field]));
    if (invalidStep !== -1) setCurrentStep(invalidStep);
    return true;
  };

  const saveProduct = async (dto: CreateProductDto) => {
    try {
      return isEdit ? await updateProduct.mutateAsync({ id: product.id, dto }) : await createProduct.mutateAsync(dto);
    } catch {
      return null;
    }
  };

  const uploadSelectedImages = async (saved: ApiProduct) => {
    const total = newCover.length + newImages.length;
    if (total === 0) return 0;

    let done = 0;
    let failures = 0;
    setUploadProgress({ done, total });

    if (newCover[0]) {
      try {
        await uploadImage.mutateAsync({ productId: saved.id, file: newCover[0].file, isPrimary: true });
        setNewCover([]);
      } catch {
        failures += 1;
      }
      done += 1;
      setUploadProgress({ done, total });
    }

    if (newImages.length > 0) {
      const remaining = [...newImages];
      const batches = Array.from(
        { length: Math.ceil(newImages.length / UPLOAD_BATCH_SIZE) },
        (_, index) => newImages.slice(index * UPLOAD_BATCH_SIZE, (index + 1) * UPLOAD_BATCH_SIZE),
      );

      const batchResults = await Promise.all(
        batches.map(async (batch) => {
          try {
            await uploadImages.mutateAsync({ productId: saved.id, files: batch.map((image) => image.file) });
            batch.forEach((image) => {
              const index = remaining.findIndex((item) => item.id === image.id);
              if (index !== -1) remaining.splice(index, 1);
            });
            return { failed: false, batchLength: batch.length };
          } catch {
            return { failed: true, batchLength: batch.length };
          }
        }),
      );

      failures += batchResults
        .filter((result) => result.failed)
        .reduce((sum, result) => sum + result.batchLength, 0);

      done += newImages.length;
      setUploadProgress({ done, total });
      setNewImages(remaining);
    }

    setUploadProgress(null);
    return failures;
  };

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (currentStep < FORM_STEPS.length - 1) {
      goToNextStep();
      return;
    }

    setSubmitted(true);
    if (validateFormForSubmit()) return;
    if (saving) return;

    const dto = toProductDto(form);
    const saved = await saveProduct(dto);
    if (!saved) return;

    const failures = await uploadSelectedImages(saved);
    if (failures > 0) {
      toast.warning(`${failures} image(s) n'ont pas pu être téléversées`, {
        id: 'product-images-partial',
        description: 'Le produit est enregistré ; les images non envoyées restent sélectionnées pour réessayer.',
      });
    }

    onSaved(saved);
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} noValidate className="mx-auto w-full max-w-3xl space-y-5" aria-busy={saving}>
      <Link to={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary transition-colors">
        <ArrowLeft size={16} /> Retour aux produits
      </Link>

      {mutationError && <FormError error={mutationError} handledFields={Object.keys(errors)} />}

      <FormStepProgress steps={FORM_STEPS} currentStep={currentStep} />

      {currentStep === 0 && (
      <section className="bg-surface rounded-xl border border-border p-6 space-y-4">
        <h3 className="font-semibold text-text">Informations du produit</h3>
        <FormField label="Nom du produit" value={form.name} onChange={update('name')} placeholder="Ex. Riz makalioka 5 kg" error={errors.name} maxLength={200} required />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Prix de vente (Ar)" type="number" inputMode="decimal" min={0} step="1" value={form.price} onChange={update('price')} placeholder="0" error={errors.price} required />
          <FormField label="Prix barré (Ar)" type="number" inputMode="decimal" min={0} step="1" value={form.compareAtPrice} onChange={update('compareAtPrice')} placeholder="Optionnel" error={errors.compareAtPrice} hint="Affiche une remise si supérieur au prix de vente." />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField as="select" label="Catégorie" value={form.categoryId} onChange={update('categoryId')} error={errors.categoryId ?? (categoriesQuery.isError ? 'Impossible de charger les catégories.' : undefined)} disabled={categoriesQuery.isPending} required>
            <option value="">{categoriesQuery.isPending ? 'Chargement…' : 'Sélectionner une catégorie'}</option>
            {(categoriesQuery.data?.items ?? []).map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </FormField>
          <FormField label="Référence (SKU)" value={form.sku} onChange={update('sku')} placeholder="Optionnel" error={errors.sku} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Quantité en stock" type="number" inputMode="numeric" min={0} step="1" value={form.stockQuantity} onChange={update('stockQuantity')} error={errors.stockQuantity} required />
          <FormField label="Seuil de stock faible" type="number" inputMode="numeric" min={0} step="1" value={form.lowStockThreshold} onChange={update('lowStockThreshold')} error={errors.lowStockThreshold} hint="Alerte lorsque le stock passe sous ce seuil." />
        </div>
      </section>
      )}

      {currentStep === 1 && (
      <section className="bg-surface rounded-xl border border-border p-6 space-y-4">
        <h3 className="font-semibold text-text">Description du produit</h3>
        <FormField label="Résumé" value={form.shortDescription} onChange={update('shortDescription')} placeholder="Une phrase qui donne envie (max. 500 caractères)" error={errors.shortDescription} maxLength={500} />
        <FormField as="textarea" label="Description détaillée" value={form.description} onChange={update('description')} placeholder="Caractéristiques, composition, conseils d'utilisation…" error={errors.description} rows={5} />
        <FormField label="Mots-clés" value={form.tags} onChange={update('tags')} placeholder="riz, épicerie, local" hint="Séparés par des virgules." error={errors.tags} />
      </section>
      )}

      {currentStep === 3 && (
      <section className="bg-surface rounded-xl border border-border p-6 space-y-4">
        <h3 className="font-semibold text-text">Publication</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          <FormField as="select" label="Statut" value={form.status} onChange={update('status')} error={errors.status}>
            {statusOptions.map((status) => (
              <option key={status} value={status}>{PRODUCT_STATUS_LABELS[status]}</option>
            ))}
          </FormField>
          <label htmlFor="product-featured" className="flex items-center gap-3 text-sm text-text cursor-pointer py-2.5">
            <input id="product-featured" type="checkbox" checked={form.isFeatured} onChange={update('isFeatured')} className="w-4 h-4 accent-primary rounded" aria-label="Mettre en avant" />
            <span>
              <span className="font-medium flex items-center gap-1"><Star size={14} className="text-accent" aria-hidden="true" /> Mettre en avant</span>
              <span className="block text-xs text-muted">Apparaît dans la sélection de la page d'accueil.</span>
            </span>
          </label>
        </div>
      </section>
      )}

      {currentStep === 2 && (
      <section className="bg-surface rounded-xl border border-border p-6 space-y-6" aria-labelledby="product-images-heading">
        <div>
          <h3 id="product-images-heading" className="font-semibold text-text flex items-center gap-2"><Images size={18} aria-hidden="true" /> Images du produit</h3>
          <p className="text-xs text-muted mt-1">
            Jusqu'à {MAX_PRODUCT_IMAGES} images : 1 image de couverture (affichée dans le catalogue, le panier et les commandes) et {MAX_PRODUCT_IMAGES - 1} images de présentation (galerie de la fiche produit).
          </p>
        </div>

        <div className="space-y-3" data-testid="product-cover-section">
          <h4 className="text-sm font-semibold text-text flex items-center gap-1.5"><Star size={14} className="text-accent" aria-hidden="true" /> Image de couverture</h4>
          {isEdit && existingCover && newCover.length === 0 && (
            <div className="flex items-start gap-4">
              <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-xl overflow-hidden border border-border bg-surface-secondary shrink-0" data-testid="product-cover-current">
                <MediaImage src={existingCover.url} alt={existingCover.alt ?? 'Image de couverture actuelle'} className="w-full h-full object-cover" />
                <span className="absolute top-2 left-2 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-md">Couverture</span>
              </div>
              <div className="text-sm text-muted space-y-2">
                <p>Couverture actuelle. Sélectionnez un nouveau fichier ci-dessous pour la remplacer, ou choisissez « Définir comme couverture » sur une image de présentation.</p>
                <button
                  type="button"
                  onClick={() => confirmDeleteImage.request(existingCover)}
                  disabled={imageActionPending}
                  className="inline-flex items-center gap-1.5 text-danger font-medium hover:underline disabled:opacity-50"
                  data-testid="product-cover-delete"
                >
                  <Trash2 size={14} aria-hidden="true" /> Supprimer la couverture
                </button>
              </div>
            </div>
          )}
          <ProductImageUploader
            mode="cover"
            value={newCover}
            onChange={setNewCover}
            label={existingCover ? 'Remplacer la couverture' : 'Choisir la couverture'}
            hint="Une seule image, idéalement carrée (ex. 1200 × 1200 px), nette et sur fond neutre."
            disabled={saving}
            testId="product-cover-uploader"
          />
          {!existingCover && newCover.length === 0 && (
            <p className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400"><ImageOff size={14} aria-hidden="true" /> Sans couverture, le produit apparaîtra sans visuel dans le catalogue.</p>
          )}
        </div>

        <div className="space-y-3 border-t border-border pt-5" data-testid="product-gallery-section">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-text">Images de présentation</h4>
            <span className="text-xs text-muted">{existingGallery.length + newImages.length}/{MAX_PRODUCT_IMAGES - 1} images</span>
          </div>

          {isEdit && existingGallery.length > 0 && (
            <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3" aria-label="Images de présentation actuelles" data-testid="product-gallery-current">
              {existingGallery.map((image, index) => (
                <li key={image.id} className="relative group rounded-xl overflow-hidden border border-border bg-surface-secondary">
                  <MediaImage src={image.url} alt={image.alt ?? `Image de présentation ${index + 1}`} className="w-full aspect-square object-cover" />
                  <span className="absolute top-2 left-2 bg-black/55 text-white text-[10px] font-semibold px-2 py-0.5 rounded-md">{index + 1}</span>
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 p-1.5 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => moveGalleryImage(image.id, -1)} disabled={index === 0 || imageActionPending} className="w-7 h-7 rounded-md bg-white/90 text-text flex items-center justify-center disabled:opacity-40" aria-label="Déplacer vers la gauche">
                        <ChevronLeft size={14} />
                      </button>
                      <button type="button" onClick={() => moveGalleryImage(image.id, 1)} disabled={index === existingGallery.length - 1 || imageActionPending} className="w-7 h-7 rounded-md bg-white/90 text-text flex items-center justify-center disabled:opacity-40" aria-label="Déplacer vers la droite">
                        <ChevronRight size={14} />
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPrimaryImage.mutate({ productId: product!.id, imageId: image.id })}
                        disabled={imageActionPending}
                        className="h-7 px-2 rounded-md bg-white/90 text-[11px] font-medium text-text flex items-center gap-1 disabled:opacity-40"
                        title="Définir comme couverture"
                        aria-label="Définir comme image de couverture"
                        data-testid="product-image-set-cover"
                      >
                        <Star size={12} aria-hidden="true" /> Couverture
                      </button>
                      <button
                        type="button"
                        onClick={() => confirmDeleteImage.request(image)}
                        disabled={imageActionPending}
                        className="w-7 h-7 rounded-md bg-white/90 text-danger flex items-center justify-center disabled:opacity-40"
                        aria-label="Supprimer cette image"
                        data-testid="product-image-delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {isEdit && existingGallery.length === 0 && newImages.length === 0 && (
            <p className="flex items-center gap-2 text-sm text-muted"><ImageOff size={16} aria-hidden="true" /> Aucune image de présentation pour le moment.</p>
          )}

          <ProductImageUploader
            mode="gallery"
            value={newImages}
            onChange={setNewImages}
            maxImages={galleryCapacity}
            label={existingGallery.length > 0 ? 'Ajouter des images de présentation' : 'Images de présentation'}
            hint="Plusieurs fichiers acceptés (détails, angles, mise en situation). Vous pourrez les réordonner après l'enregistrement."
            disabled={saving || galleryCapacity === 0}
            testId="product-gallery-uploader"
          />
          {galleryCapacity === 0 && <p className="text-xs text-muted">Limite de {MAX_PRODUCT_IMAGES} images atteinte : supprimez une image pour en ajouter une autre.</p>}
        </div>

        {uploadProgress && (
          <p className="text-sm text-primary" role="status" aria-live="polite">Téléversement des images… {uploadProgress.done}/{uploadProgress.total}</p>
        )}
      </section>
      )}

      <div className="flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <Link to={backHref} className="text-sm font-medium text-muted hover:text-text px-4 py-2.5">Annuler</Link>
        <div className="flex justify-end gap-3">
          {currentStep > 0 && (
            <Button type="button" variant="secondary" icon={ChevronLeft} onClick={() => setCurrentStep((step) => Math.max(step - 1, 0))}>
              Précédent
            </Button>
          )}
          {currentStep < FORM_STEPS.length - 1 ? (
            <Button type="button" icon={ChevronRight} onClick={goToNextStep}>
              Suivant
            </Button>
          ) : (
            <Button type="submit" icon={Save} loading={saving} loadingLabel={uploadProgress ? 'Téléversement...' : 'Enregistrement...'} data-testid="product-form-submit">
              {isEdit ? 'Enregistrer les modifications' : 'Créer le produit'}
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDeleteImage.isOpen}
        variant="destructive"
        title={confirmDeleteImage.target?.isPrimary ? 'Supprimer l\'image de couverture ?' : 'Supprimer cette image ?'}
        description={confirmDeleteImage.target?.isPrimary
          ? 'La couverture sera définitivement retirée ; la première image de présentation deviendra la nouvelle couverture.'
          : 'L\'image sera définitivement retirée du produit.'}
        confirmLabel="Supprimer"
        loadingLabel="Suppression..."
        loading={deleteImage.isPending}
        onConfirm={() => void confirmDeleteImage.run((image) => deleteImage.mutateAsync({ productId: product!.id, imageId: image.id }))}
        onCancel={confirmDeleteImage.cancel}
      />
    </form>
  );
}

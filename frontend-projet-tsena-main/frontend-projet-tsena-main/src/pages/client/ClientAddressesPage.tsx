import { useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, Plus, Star, Pencil, Trash2, X, Phone, User } from 'lucide-react';
import clsx from 'clsx';
import { useTitle } from '../../hooks';
import { useAddresses } from '../../hooks/queries/useAddresses';
import { useCreateAddress, useRemoveAddress, useSetDefaultAddress, useUpdateAddress } from '../../hooks/mutations/useAddressMutations';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import { Button, ConfirmDialog, EmptyState, ErrorState, LoadingState } from '../../components/common';
import { FormError, FormField } from '../../components/form';
import PageHeader from '../../shared/components/PageHeader';
import { getFieldErrors } from '../../lib/api-error';
import type { AddressDto, ApiAddress } from '../../types/api';

const PHONE_PATTERN = /^\+?[0-9 ]{9,15}$/;

type AddressFormState = Required<Pick<AddressDto, 'label' | 'recipientName' | 'phone' | 'street' | 'complement' | 'city' | 'state' | 'postalCode' | 'instructions'>> & { isDefault: boolean };

const EMPTY_FORM: AddressFormState = { label: '', recipientName: '', phone: '', street: '', complement: '', city: '', state: '', postalCode: '', instructions: '', isDefault: false };

export function validateAddress(form: AddressFormState): Partial<Record<keyof AddressFormState, string>> {
  const errors: Partial<Record<keyof AddressFormState, string>> = {};
  if (form.label.trim().length < 2) errors.label = 'Donnez un libellé à cette adresse (ex. Domicile, Bureau).';
  if (form.recipientName.trim().length < 3) errors.recipientName = 'Indiquez le nom complet du destinataire.';
  if (!PHONE_PATTERN.test(form.phone.trim())) errors.phone = 'Numéro de téléphone invalide (ex. 034 00 000 00).';
  if (form.street.trim().length < 5) errors.street = 'Indiquez une adresse complète (lot, rue, quartier).';
  if (form.city.trim().length < 2) errors.city = 'Indiquez la ville.';
  if (form.instructions.length > 300) errors.instructions = '300 caractères maximum.';
  return errors;
}

function toDto(form: AddressFormState): AddressDto {
  const clean = (v: string) => (v.trim() ? v.trim() : undefined);
  return {
    label: form.label.trim(),
    recipientName: form.recipientName.trim(),
    phone: form.phone.trim(),
    street: form.street.trim(),
    complement: clean(form.complement),
    city: form.city.trim(),
    state: clean(form.state),
    postalCode: clean(form.postalCode),
    instructions: clean(form.instructions),
    isDefault: form.isDefault,
  };
}

interface AddressDialogProps {
  readonly open: boolean;
  readonly address: ApiAddress | null;
  readonly isFirst: boolean;
  readonly onClose: () => void;
}

function AddressDialog({ open, address, isFirst, onClose }: AddressDialogProps) {
  const create = useCreateAddress();
  const update = useUpdateAddress();
  const mutation = address ? update : create;
  const [form, setForm] = useState<AddressFormState>(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    create.reset();
    update.reset();
    setForm(address
      ? { label: address.label, recipientName: address.recipientName ?? '', phone: address.phone ?? '', street: address.street, complement: address.complement ?? '', city: address.city, state: address.state ?? '', postalCode: address.postalCode ?? '', instructions: address.instructions ?? '', isDefault: address.isDefault }
      : { ...EMPTY_FORM, isDefault: isFirst });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !mutation.isPending) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, address?.id]);

  if (!open) return null;

  const clientErrors = validateAddress(form);
  const serverErrors = getFieldErrors(mutation.error);
  const errorFor = (field: keyof AddressFormState) => serverErrors[field] ?? (submitted ? clientErrors[field] : undefined);
  const set = (field: keyof AddressFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(clientErrors).length > 0 || mutation.isPending) return;
    const dto = toDto(form);
    if (address) update.mutate({ id: address.id, dto }, { onSuccess: onClose });
    else create.mutate(dto, { onSuccess: onClose });
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="address-dialog-title">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => !mutation.isPending && onClose()} aria-hidden="true" />
      <form onSubmit={submit} noValidate className="relative w-full sm:max-w-xl max-h-[92vh] overflow-y-auto bg-surface rounded-t-2xl sm:rounded-2xl shadow-2xl border border-border animate-scale-in" aria-busy={mutation.isPending}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-surface z-10">
          <h2 id="address-dialog-title" className="font-semibold text-text flex items-center gap-2"><MapPin size={18} className="text-primary" /> {address ? "Modifier l'adresse" : 'Nouvelle adresse'}</h2>
          <button type="button" onClick={onClose} disabled={mutation.isPending} className="p-2 rounded-lg hover:bg-surface-tertiary text-muted" aria-label="Fermer"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {mutation.isError && <FormError error={mutation.error} handledFields={Object.keys(EMPTY_FORM)} />}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Libellé" value={form.label} onChange={set('label')} placeholder="Domicile, Bureau…" error={errorFor('label')} required data-testid="address-label" />
            <FormField label="Destinataire" icon={User} value={form.recipientName} onChange={set('recipientName')} autoComplete="name" error={errorFor('recipientName')} required data-testid="address-recipient" />
            <FormField label="Téléphone" icon={Phone} type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" placeholder="034 00 000 00" error={errorFor('phone')} required data-testid="address-phone" />
            <FormField label="Ville" value={form.city} onChange={set('city')} autoComplete="address-level2" placeholder="Antananarivo" error={errorFor('city')} required data-testid="address-city" />
          </div>
          <FormField label="Adresse" value={form.street} onChange={set('street')} autoComplete="street-address" placeholder="Lot, rue, quartier" error={errorFor('street')} required data-testid="address-street" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="Complément" value={form.complement} onChange={set('complement')} placeholder="Étage, porte…" error={errorFor('complement')} />
            <FormField label="Région" value={form.state} onChange={set('state')} placeholder="Analamanga" error={errorFor('state')} />
            <FormField label="Code postal" value={form.postalCode} onChange={set('postalCode')} placeholder="101" error={errorFor('postalCode')} />
          </div>
          <FormField as="textarea" label="Instructions pour le livreur" value={form.instructions} onChange={set('instructions')} rows={2} maxLength={300} placeholder="Point de repère, horaires de présence…" hint={`${form.instructions.length}/300`} error={errorFor('instructions')} />
          <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))} disabled={isFirst && !address} className="accent-primary" />
            Utiliser comme adresse par défaut
          </label>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border bg-surface-secondary/40 rounded-b-2xl">
          <Button type="button" variant="ghost" onClick={onClose} disabled={mutation.isPending}>Annuler</Button>
          <Button type="submit" loading={mutation.isPending} loadingLabel="Enregistrement..." data-testid="address-submit">{address ? 'Enregistrer' : "Ajouter l'adresse"}</Button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

export default function ClientAddressesPage() {
  useTitle('Mes adresses | Mon compte');
  const query = useAddresses();
  const setDefault = useSetDefaultAddress();
  const remove = useRemoveAddress();
  const [dialog, setDialog] = useState<{ open: boolean; address: ApiAddress | null }>({ open: false, address: null });
  const confirmDelete = useConfirmAction<ApiAddress>();
  const addresses = query.data ?? [];

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Mes adresses"
        subtitle="Vos adresses de livraison enregistrées — l'adresse par défaut est proposée automatiquement lors de la commande"
        actions={<Button icon={Plus} onClick={() => setDialog({ open: true, address: null })} data-testid="address-add">Ajouter une adresse</Button>}
      />

      {query.isPending ? (
        <LoadingState variant="cards" count={3} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />
      ) : addresses.length === 0 ? (
        <EmptyState icon={MapPin} title="Aucune adresse enregistrée" description="Ajoutez une adresse pour accélérer vos prochaines commandes." action={{ label: 'Ajouter une adresse', onClick: () => setDialog({ open: true, address: null }), icon: Plus }} />
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="addresses-list">
          {addresses.map((address) => (
            <li key={address.id} className={clsx('relative bg-surface rounded-2xl border p-5 flex flex-col gap-3 transition-shadow hover:shadow-md', address.isDefault ? 'border-primary/60 ring-1 ring-primary/20' : 'border-border')} data-testid={`address-card-${address.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-text flex items-center gap-2">
                    <MapPin size={16} className="text-primary shrink-0" /> <span className="truncate">{address.label}</span>
                    {address.isDefault && <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/15 px-2 py-0.5 rounded-full"><Star size={10} className="fill-current" /> Par défaut</span>}
                  </p>
                  <p className="text-sm text-muted mt-1">{address.recipientName}{address.phone ? ` · ${address.phone}` : ''}</p>
                </div>
              </div>
              <address className="not-italic text-sm text-text leading-relaxed">
                {address.street}{address.complement ? `, ${address.complement}` : ''}<br />
                {[address.postalCode, address.city, address.state].filter(Boolean).join(' ')}{address.country ? ` — ${address.country}` : ''}
                {address.instructions && <span className="block text-xs text-muted italic mt-1">« {address.instructions} »</span>}
              </address>
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border mt-auto">
                {!address.isDefault && (
                  <Button size="sm" variant="ghost" icon={Star} onClick={() => setDefault.mutate(address.id)} loading={setDefault.isPending && setDefault.variables === address.id} loadingLabel="Mise à jour...">Définir par défaut</Button>
                )}
                <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setDialog({ open: true, address })}>Modifier</Button>
                <Button size="sm" variant="ghost" icon={Trash2} className="text-danger hover:text-danger ml-auto" onClick={() => confirmDelete.request(address)} data-testid={`address-delete-${address.id}`}>Supprimer</Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AddressDialog open={dialog.open} address={dialog.address} isFirst={addresses.length === 0} onClose={() => setDialog({ open: false, address: null })} />

      <ConfirmDialog
        open={confirmDelete.target !== null}
        title="Supprimer cette adresse ?"
        description={confirmDelete.target ? <>L'adresse <strong>{confirmDelete.target.label}</strong> sera retirée de votre carnet. Les commandes déjà passées conservent leur adresse de livraison.</> : null}
        confirmLabel="Supprimer"
        loadingLabel="Suppression..."
        variant="destructive"
        loading={remove.isPending}
        onCancel={confirmDelete.cancel}
        onConfirm={() => void confirmDelete.run((address) => remove.mutateAsync(address.id))}
      />
    </div>
  );
}

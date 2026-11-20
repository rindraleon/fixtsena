import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, CreditCard, ClipboardCheck, ArrowLeft, ArrowRight, ShoppingCart, Store, Smartphone, Banknote, Info, Truck, BookUser, Plus, Star, RefreshCw, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { useTitle } from '../../hooks';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../hooks/queries/useCart';
import { useCreateOrder } from '../../hooks/mutations/useOrderMutations';
import { useInitiatePayment } from '../../hooks/mutations/usePaymentMutations';
import { useCheckoutQuote, useDeliveryZones } from '../../hooks/queries/useCommissions';
import { useAddresses } from '../../hooks/queries/useAddresses';
import { useCreateAddress } from '../../hooks/mutations/useAddressMutations';
import { Button, EmptyState, ErrorState, LoadingState } from '../../components/common';
import { formatPrice, primaryImageUrl, PAYMENT_METHOD_LABELS } from '../../lib/format';
import { getApiErrorMessage, getFieldErrors, isPriceChangeError } from '../../lib/api-error';
import { toast, TOAST_MESSAGES } from '../../lib/toast';
import type { ApiAddress, CartItem, PaymentMethod } from '../../types/api';
import type { OrderSuccessState } from './OrderSuccessPage';

type Step = 'address' | 'payment' | 'confirm';

interface DeliveryForm {
  fullName: string;
  phone: string;
  city: string;
  address: string;
  instructions: string;
}

const STEPS: { key: Step; label: string; icon: React.ElementType }[] = [
  { key: 'address', label: 'Livraison', icon: MapPin },
  { key: 'payment', label: 'Paiement', icon: CreditCard },
  { key: 'confirm', label: 'Confirmation', icon: ClipboardCheck },
];

const PAYMENT_OPTIONS: { value: PaymentMethod; description: string; icon: React.ElementType }[] = [
  { value: 'mvola', description: 'Paiement mobile MVola — fonds conservés en séquestre jusqu’à la réception', icon: Smartphone },
  { value: 'orange_money', description: 'Paiement mobile Orange Money — fonds conservés en séquestre jusqu’à la réception', icon: Smartphone },
  { value: 'airtel_money', description: 'Paiement mobile Airtel Money — fonds conservés en séquestre jusqu’à la réception', icon: Smartphone },
  { value: 'cash_on_delivery', description: 'Réglez en espèces à la réception du colis (sans séquestre)', icon: Banknote },
];

const NOTES_MAX_LENGTH = 500;
const PHONE_PATTERN = /^\+?[0-9 ]{9,15}$/;

const NEW_ADDRESS = 'new';

export function formFromAddress(address: ApiAddress): DeliveryForm {
  return {
    fullName: address.recipientName ?? '',
    phone: address.phone ?? '',
    city: address.city,
    address: [address.street, address.complement].filter(Boolean).join(', '),
    instructions: address.instructions ?? '',
  };
}

export function buildOrderNotes(form: DeliveryForm): string {
  const parts = [
    `Livraison : ${form.fullName.trim()} — ${form.phone.trim()}`,
    `${form.address.trim()}, ${form.city.trim()}`,
    form.instructions.trim() ? `Instructions : ${form.instructions.trim()}` : null,
  ].filter(Boolean);
  return parts.join(' | ').slice(0, NOTES_MAX_LENGTH);
}

export function validateDelivery(form: DeliveryForm, options: { zoneRequired?: boolean; zoneId?: string } = {}): Partial<Record<keyof DeliveryForm | 'deliveryZoneId', string>> {
  const errors: Partial<Record<keyof DeliveryForm | 'deliveryZoneId', string>> = {};
  if (options.zoneRequired && !options.zoneId) errors.deliveryZoneId = 'Choisissez votre zone de livraison.';
  if (form.fullName.trim().length < 3) errors.fullName = 'Indiquez le nom complet du destinataire.';
  if (!PHONE_PATTERN.test(form.phone.trim())) errors.phone = 'Numéro de téléphone invalide (ex. 034 00 000 00).';
  if (form.city.trim().length < 2) errors.city = 'Indiquez la ville de livraison.';
  if (form.address.trim().length < 5) errors.address = 'Indiquez une adresse complète.';
  if (form.instructions.length > 200) errors.instructions = '200 caractères maximum.';
  return errors;
}

interface SellerGroup {
  sellerId: string;
  label: string;
  items: CartItem[];
  subtotal: number;
}

export function groupBySeller(items: CartItem[]): SellerGroup[] {
  const groups = new Map<string, SellerGroup>();
  for (const item of items) {
    const sellerId = item.product?.sellerId ?? 'unknown';
    const group = groups.get(sellerId) ?? { sellerId, label: `Vendeur ${groups.size + 1}`, items: [], subtotal: 0 };
    group.items.push(item);
    group.subtotal += Number(item.unitPrice) * item.quantity;
    groups.set(sellerId, group);
  }
  return [...groups.values()];
}

export default function CheckoutPage() {
  useTitle('Validation de la commande');
  const navigate = useNavigate();
  const { user } = useAuth();
  const cartQuery = useCart();
  const createOrder = useCreateOrder();
  const createAddress = useCreateAddress();
  const initiatePayment = useInitiatePayment();
  const addressesQuery = useAddresses();
  const savedAddresses = addressesQuery.data ?? [];
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [saveNewAddress, setSaveNewAddress] = useState(true);
  const [priceChangeAccepted, setPriceChangeAccepted] = useState(false);
  const defaultAddress = savedAddresses.find((a) => a.isDefault) ?? savedAddresses[0] ?? null;
  const activeAddressId = selectedAddressId ?? (defaultAddress ? defaultAddress.id : NEW_ADDRESS);
  const activeAddress = activeAddressId === NEW_ADDRESS ? null : savedAddresses.find((a) => a.id === activeAddressId) ?? null;

  const [step, setStep] = useState<Step>('address');
  const [form, setForm] = useState<DeliveryForm>({
    fullName: user?.fullName ?? '',
    phone: user?.phone ?? '',
    city: '',
    address: '',
    instructions: '',
  });
  const [touched, setTouched] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>('mvola');
  const [deliveryZoneId, setDeliveryZoneId] = useState('');
  const zonesQuery = useDeliveryZones();
  const zones = zonesQuery.data ?? [];
  const zonesAvailable = zonesQuery.isSuccess && zones.length > 0;
  const [submitting, setSubmitting] = useState(false);
  const quoteQuery = useCheckoutQuote(deliveryZoneId || undefined, { enabled: !!cartQuery.data && cartQuery.data.items.length > 0 && !submitting });
  const quoteError = quoteQuery.isError ? quoteQuery.error : null;
  useEffect(() => {
    if (!quoteError) return;
    toast.error(TOAST_MESSAGES.orders.quoteError, { id: 'checkout-quote-error', description: getApiErrorMessage(quoteError) });
  }, [quoteError]);

  const cartItems = cartQuery.data?.items;
  const items = cartItems ?? [];
  const sellerGroups = useMemo(() => groupBySeller(cartItems ?? []), [cartItems]);
  const subtotal = cartQuery.data?.summary.totalAmount ?? 0;
  const effectiveForm = activeAddress ? { ...formFromAddress(activeAddress), instructions: form.instructions } : form;
  const errors = validateDelivery(effectiveForm, { zoneRequired: zonesAvailable, zoneId: deliveryZoneId });
  const isAddressValid = Object.keys(errors).length === 0;
  const priceChanged = createOrder.isError && isPriceChangeError(createOrder.error);
  const serverFieldErrors = getFieldErrors(createOrder.error);
  const selectedZone = zones.find((z) => z.id === deliveryZoneId) ?? null;
  const quote = quoteQuery.data;
  const shippingTotal = quote?.shippingAmount ?? (selectedZone ? selectedZone.price * sellerGroups.length : 0);
  const grandTotal = quote?.totalAmount ?? subtotal + shippingTotal;

  if (cartQuery.isPending) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <LoadingState variant="page" label="Préparation de votre commande..." />
      </div>
    );
  }

  if (cartQuery.isError) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <ErrorState error={cartQuery.error} onRetry={() => void cartQuery.refetch()} retrying={cartQuery.isFetching} />
      </div>
    );
  }

  if (items.length === 0 && !submitting) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 animate-fade-in-up">
        <EmptyState titleAs="h1"
          icon={ShoppingCart}
          title="Panier vide"
          description="Ajoutez des articles à votre panier avant de passer commande."
          action={{ label: 'Continuer mes achats', to: '/produits', icon: ArrowRight }}
        />
      </div>
    );
  }

  const updateField = (field: keyof DeliveryForm) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const handleAddressSubmit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (isAddressValid) setStep('payment');
  };

  const handleConfirm = async (acceptPriceChanges = false) => {
    if (submitting || createOrder.isPending) return;
    if (quoteQuery.isError) {
      toast.error(TOAST_MESSAGES.orders.quoteError, { id: 'checkout-quote-error', description: getApiErrorMessage(quoteQuery.error) });
      return;
    }
    setSubmitting(true);
    try {
      let addressId = activeAddress?.id;
      if (!addressId && saveNewAddress) {
        try {
          const created = await createAddress.mutateAsync({
            label: savedAddresses.length === 0 ? 'Domicile' : `Adresse ${savedAddresses.length + 1}`,
            recipientName: form.fullName.trim(),
            phone: form.phone.trim(),
            street: form.address.trim(),
            city: form.city.trim(),
            instructions: form.instructions.trim() || undefined,
            isDefault: savedAddresses.length === 0,
          });
          addressId = created.id;
          setSelectedAddressId(created.id);
        } catch {
          toast.info('La commande continue avec l’adresse saisie', { id: 'address-not-saved', description: 'L’adresse n’a pas pu être ajoutée à votre carnet, mais elle est bien transmise au vendeur.' });
        }
      }
      const orders = await createOrder.mutateAsync({
        notes: buildOrderNotes(effectiveForm),
        deliveryZoneId: deliveryZoneId || undefined,
        addressId,
        acceptPriceChanges: acceptPriceChanges || undefined,
      });

      const paymentFailures: OrderSuccessState['paymentFailures'] = [];
      for (const order of orders) {
        try {
          await initiatePayment.mutateAsync({ orderId: order.id, method });
        } catch (error) {
          paymentFailures.push({ orderId: order.id, orderNumber: order.orderNumber, message: getApiErrorMessage(error) });
        }
      }

      const state: OrderSuccessState = { orders, method, paymentFailures };
      navigate('/commande/succes', { replace: true, state });
    } catch {
      setPriceChangeAccepted(false);
      setSubmitting(false);
      void cartQuery.refetch().then(() => quoteQuery.refetch());
    }
  };

  const currentIndex = STEPS.findIndex((s) => s.key === step);
  const inputClass = (hasError: boolean) =>
    clsx(
      'w-full px-3 py-2.5 border rounded-lg text-sm bg-input-bg text-text focus:outline-none focus:ring-2 transition-colors',
      hasError ? 'border-danger focus:ring-danger/20' : 'border-input-border focus:border-primary focus:ring-primary/20',
    );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in-up">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-primary">Valider ma commande</h1>
        <Link to="/panier" className="text-sm text-primary font-medium hover:underline inline-flex items-center gap-1">
          <ArrowLeft size={14} /> Retour au panier
        </Link>
      </div>

      {quoteQuery.isError && (
        <div role="alert" data-testid="quote-error" className="mb-6 bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 rounded-xl p-4 text-sm text-amber-900 dark:text-amber-100 flex flex-col sm:flex-row sm:items-center gap-3">
          <AlertTriangle size={18} className="shrink-0" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold">Votre commande ne peut pas être validée en l’état</p>
            <p className="text-xs mt-0.5">{getApiErrorMessage(quoteQuery.error)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" icon={RefreshCw} onClick={() => void cartQuery.refetch().then(() => quoteQuery.refetch())} loading={quoteQuery.isFetching} loadingLabel="Vérification...">Réessayer</Button>
            <Button size="sm" icon={ShoppingCart} onClick={() => navigate('/panier')}>Ajuster mon panier</Button>
          </div>
        </div>
      )}

      <ol className="flex items-center justify-center gap-2 mb-8" aria-label="Étapes de la commande">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = s.key === step;
          const isPast = currentIndex > i;
          return (
            <li key={s.key} className="flex items-center gap-2" aria-current={isActive ? 'step' : undefined}>
              {i > 0 && <div className={clsx('w-6 sm:w-10 h-0.5 rounded', isPast ? 'bg-primary' : 'bg-border')} aria-hidden="true" />}
              <button
                type="button"
                disabled={!isPast || submitting}
                onClick={() => setStep(s.key)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  isActive ? 'bg-primary text-white' : isPast ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'bg-surface-secondary text-muted cursor-default',
                )}
              >
                <Icon size={16} /> <span className="hidden sm:inline">{s.label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {step === 'address' && (
            <form onSubmit={handleAddressSubmit} noValidate className="bg-surface rounded-2xl border border-border p-6 space-y-4">
              <h2 className="font-bold text-text flex items-center gap-2"><MapPin size={18} className="text-primary" /> Informations de livraison</h2>

              {addressesQuery.isPending ? (
                <LoadingState variant="inline" label="Chargement de vos adresses..." />
              ) : addressesQuery.isError ? (
                <ErrorState error={addressesQuery.error} onRetry={() => void addressesQuery.refetch()} retrying={addressesQuery.isFetching} compact />
              ) : savedAddresses.length > 0 ? (
                <fieldset>
                  <legend className="block text-sm font-medium text-text mb-2 flex items-center gap-1.5"><BookUser size={14} className="text-primary" /> Mes adresses enregistrées</legend>
                  <div role="radiogroup" aria-label="Adresse de livraison" className="grid grid-cols-1 sm:grid-cols-2 gap-2" data-testid="saved-addresses">
                    {savedAddresses.map((address) => {
                      const selected = activeAddressId === address.id;
                      return (
                        <label key={address.id} className={clsx('flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all', selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40')}>
                          <input type="radio" name="saved-address" value={address.id} checked={selected} onChange={() => setSelectedAddressId(address.id)} className="accent-primary mt-1" data-testid={`saved-address-${address.id}`} />
                          <span className="flex-1 min-w-0 text-sm">
                            <span className="flex items-center gap-1.5 font-semibold text-text">{address.label}{address.isDefault && <Star size={12} className="text-amber-500 fill-amber-500" aria-label="Adresse par défaut" />}</span>
                            <span className="block text-xs text-muted">{address.recipientName} · {address.phone}</span>
                            <span className="block text-xs text-muted truncate">{address.street}{address.complement ? `, ${address.complement}` : ''}, {address.city}</span>
                          </span>
                        </label>
                      );
                    })}
                    <label className={clsx('flex items-center gap-3 p-3 rounded-xl border-2 border-dashed cursor-pointer transition-all', activeAddressId === NEW_ADDRESS ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40')}>
                      <input type="radio" name="saved-address" value={NEW_ADDRESS} checked={activeAddressId === NEW_ADDRESS} onChange={() => setSelectedAddressId(NEW_ADDRESS)} className="accent-primary" data-testid="saved-address-new" />
                      <span className="text-sm font-medium text-text inline-flex items-center gap-1.5"><Plus size={14} /> Livrer à une nouvelle adresse</span>
                    </label>
                  </div>
                  <p className="text-[11px] text-muted mt-1.5">Gérez votre carnet depuis <Link to="/dashboard/client/mes-adresses" className="text-primary hover:underline">Mes adresses</Link>.</p>
                </fieldset>
              ) : null}

              {activeAddress ? null : (<>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium text-text mb-1">Nom complet *</label>
                  <input id="fullName" value={form.fullName} onChange={updateField('fullName')} autoComplete="name" className={inputClass(touched && !!errors.fullName)} aria-invalid={touched && !!errors.fullName} />
                  {touched && errors.fullName && <p className="text-xs text-danger mt-1">{errors.fullName}</p>}
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-text mb-1">Téléphone *</label>
                  <input id="phone" type="tel" value={form.phone} onChange={updateField('phone')} autoComplete="tel" placeholder="034 00 000 00" className={inputClass(touched && !!errors.phone)} aria-invalid={touched && !!errors.phone} />
                  {touched && errors.phone && <p className="text-xs text-danger mt-1">{errors.phone}</p>}
                </div>
              </div>

              <div>
                <label htmlFor="city" className="block text-sm font-medium text-text mb-1">Ville *</label>
                <input id="city" value={form.city} onChange={updateField('city')} autoComplete="address-level2" placeholder="Antananarivo" className={inputClass(touched && !!errors.city)} aria-invalid={touched && !!errors.city} />
                {touched && errors.city && <p className="text-xs text-danger mt-1">{errors.city}</p>}
              </div>

              <div>
                <label htmlFor="address" className="block text-sm font-medium text-text mb-1">Adresse complète *</label>
                <input id="address" value={form.address} onChange={updateField('address')} autoComplete="street-address" placeholder="Lot, rue, quartier" className={inputClass(touched && !!errors.address)} aria-invalid={touched && !!errors.address} />
                {touched && errors.address && <p className="text-xs text-danger mt-1">{errors.address}</p>}
              </div>

              <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
                <input type="checkbox" checked={saveNewAddress} onChange={(e) => setSaveNewAddress(e.target.checked)} className="accent-primary" data-testid="save-address" />
                Enregistrer cette adresse dans mon carnet pour mes prochaines commandes
              </label>
              </>)}

              <fieldset>
                <legend className="block text-sm font-medium text-text mb-2 flex items-center gap-1.5"><Truck size={14} className="text-primary" /> Zone de livraison {zonesAvailable && '*'}</legend>
                {zonesQuery.isPending ? (
                  <LoadingState variant="inline" label="Chargement des zones..." />
                ) : zonesQuery.isError ? (
                  <ErrorState error={zonesQuery.error} onRetry={() => void zonesQuery.refetch()} retrying={zonesQuery.isFetching} compact />
                ) : zones.length === 0 ? (
                  <p className="text-xs text-muted bg-surface-secondary rounded-lg px-3 py-2">Aucune zone tarifée n'est configurée : la livraison est offerte sur cette commande.</p>
                ) : (
                  <div role="radiogroup" aria-label="Zone de livraison" className="grid grid-cols-1 sm:grid-cols-2 gap-2" data-testid="delivery-zones">
                    {zones.map((zone) => {
                      const selected = deliveryZoneId === zone.id;
                      return (
                        <label key={zone.id} className={clsx('flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all', selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40')}>
                          <input type="radio" name="delivery-zone" value={zone.id} checked={selected} onChange={() => setDeliveryZoneId(zone.id)} className="accent-primary mt-1" data-testid={`delivery-zone-${zone.id}`} />
                          <span className="flex-1 min-w-0">
                            <span className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-sm text-text">{zone.name}</span>
                              <span className="text-sm font-bold text-primary shrink-0">{formatPrice(zone.price)}</span>
                            </span>
                            {zone.description && <span className="block text-xs text-muted mt-0.5">{zone.description}</span>}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
                {touched && errors.deliveryZoneId && <p className="text-xs text-danger mt-1" role="alert">{errors.deliveryZoneId}</p>}
                {sellerGroups.length > 1 && selectedZone && (
                  <p className="text-xs text-muted mt-2">Les frais de zone s'appliquent à chaque vendeur ({sellerGroups.length} expéditions) : {formatPrice(selectedZone.price)} × {sellerGroups.length}.</p>
                )}
              </fieldset>

              <div>
                <label htmlFor="instructions" className="block text-sm font-medium text-text mb-1">Instructions pour le livreur (optionnel)</label>
                <textarea id="instructions" value={form.instructions} onChange={updateField('instructions')} rows={2} maxLength={200} className={inputClass(!!errors.instructions)} placeholder="Étage, point de repère, horaires..." />
                <p className="text-xs text-muted mt-1 text-right">{form.instructions.length}/200</p>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" icon={ArrowRight} iconPosition="right">Continuer vers le paiement</Button>
              </div>
            </form>
          )}

          {step === 'payment' && (
            <div className="bg-surface rounded-2xl border border-border p-6 space-y-4">
              <h2 className="font-bold text-text flex items-center gap-2"><CreditCard size={18} className="text-primary" /> Mode de paiement</h2>
              <div role="radiogroup" aria-label="Mode de paiement" className="space-y-3">
                {PAYMENT_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const selected = method === option.value;
                  return (
                    <label key={option.value} className={clsx('flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all', selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40')}>
                      <input type="radio" name="payment-method" value={option.value} checked={selected} onChange={() => setMethod(option.value)} className="accent-primary" />
                      <span className={clsx('w-10 h-10 rounded-lg flex items-center justify-center', selected ? 'bg-primary text-white' : 'bg-surface-secondary text-muted')}><Icon size={20} /></span>
                      <span className="flex-1">
                        <span className="block font-semibold text-sm text-text">{PAYMENT_METHOD_LABELS[option.value]}</span>
                        <span className="block text-xs text-muted">{option.description}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" icon={ArrowLeft} onClick={() => setStep('address')}>Retour</Button>
                <Button icon={ArrowRight} iconPosition="right" onClick={() => setStep('confirm')}>Vérifier ma commande</Button>
              </div>
            </div>
          )}

          {step === 'confirm' && (
            <div className="space-y-4">
              <div className="bg-surface rounded-2xl border border-border p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-semibold text-text mb-1 flex items-center gap-1.5"><MapPin size={14} className="text-primary" /> Livraison</p>
                  {activeAddress && <p className="text-xs font-medium text-primary">{activeAddress.label}</p>}
                  <p className="text-muted">{effectiveForm.fullName} · {effectiveForm.phone}</p>
                  <p className="text-muted">{effectiveForm.address}, {effectiveForm.city}</p>
                  {selectedZone && <p className="text-muted flex items-center gap-1"><Truck size={12} /> Zone {selectedZone.name} · {formatPrice(selectedZone.price)} par vendeur</p>}
                  {form.instructions && <p className="text-muted italic">« {form.instructions} »</p>}
                  <button type="button" onClick={() => setStep('address')} className="text-primary text-xs font-medium hover:underline mt-1">Modifier</button>
                </div>
                <div>
                  <p className="font-semibold text-text mb-1 flex items-center gap-1.5"><CreditCard size={14} className="text-primary" /> Paiement</p>
                  <p className="text-muted">{PAYMENT_METHOD_LABELS[method]}</p>
                  <button type="button" onClick={() => setStep('payment')} className="text-primary text-xs font-medium hover:underline mt-1">Modifier</button>
                </div>
              </div>

              {sellerGroups.length > 1 && (
                <p className="flex items-start gap-2 text-xs text-muted bg-surface-secondary rounded-lg px-3 py-2">
                  <Info size={14} className="shrink-0 mt-0.5 text-primary" />
                  Votre panier contient des articles de {sellerGroups.length} vendeurs : {sellerGroups.length} commandes distinctes seront créées, chacune expédiée par son vendeur.
                </p>
              )}

              {sellerGroups.map((group) => (
                <section key={group.sellerId} className="bg-surface rounded-2xl border border-border overflow-hidden" aria-label={`Articles — ${group.label}`}>
                  <header className="flex items-center justify-between px-5 py-3 bg-surface-secondary text-sm">
                    <span className="font-semibold text-text flex items-center gap-2"><Store size={14} className="text-primary" /> {sellerGroups.length > 1 ? group.label : 'Vos articles'}</span>
                    <span className="text-muted">{group.items.length} article{group.items.length > 1 ? 's' : ''} · {formatPrice(group.subtotal)}</span>
                  </header>
                  <ul className="divide-y divide-border">
                    {group.items.map((item) => {
                      const imageUrl = item.product ? primaryImageUrl(item.product) : undefined;
                      return (
                        <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                          <div className="w-12 h-12 rounded-lg bg-surface-secondary overflow-hidden shrink-0">
                            {imageUrl && <img src={imageUrl} alt="" className="w-full h-full object-cover" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-text truncate">{item.product?.name ?? 'Produit'}</p>
                            <p className="text-xs text-muted">{item.quantity} × {formatPrice(item.unitPrice)}</p>
                          </div>
                          <span className="text-sm font-semibold text-text">{formatPrice(Number(item.unitPrice) * item.quantity)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}

              {createOrder.isError && priceChanged && (
                <div role="alert" data-testid="price-change-alert" className="bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 rounded-xl p-4 text-sm text-amber-900 dark:text-amber-100 space-y-2">
                  <p className="font-semibold flex items-center gap-2"><RefreshCw size={16} /> Le prix d'un ou plusieurs articles a changé</p>
                  <p className="text-xs">{getApiErrorMessage(createOrder.error)}</p>
                  <ul className="text-xs list-disc pl-5">
                    {Object.entries(serverFieldErrors).map(([field, message]) => <li key={field}>{message}</li>)}
                  </ul>
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer pt-1">
                    <input type="checkbox" checked={priceChangeAccepted} onChange={(e) => setPriceChangeAccepted(e.target.checked)} className="accent-primary" data-testid="accept-price-change" />
                    J'ai pris connaissance des nouveaux prix et je souhaite poursuivre la commande.
                  </label>
                </div>
              )}
              {createOrder.isError && !priceChanged && (
                <div role="alert" className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-4 text-sm text-danger">
                  <p className="font-semibold">{getApiErrorMessage(createOrder.error)}</p>
                  {Object.entries(serverFieldErrors).map(([field, message]) => (
                    <p key={field} className="text-xs mt-1">• {message}</p>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between">
                <Button variant="outline" icon={ArrowLeft} onClick={() => setStep('payment')} disabled={submitting}>Retour</Button>
                {priceChanged ? (
                  <Button size="lg" icon={ClipboardCheck} onClick={() => void handleConfirm(true)} disabled={!priceChangeAccepted || quoteQuery.isError} loading={submitting} loadingLabel="Création de la commande..." data-testid="confirm-order">
                    Confirmer au nouveau prix
                  </Button>
                ) : (
                  <Button size="lg" icon={ClipboardCheck} onClick={() => void handleConfirm()} disabled={quoteQuery.isError || quoteQuery.isPending} loading={submitting} loadingLabel="Création de la commande..." data-testid="confirm-order">
                    Confirmer la commande
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <aside className="bg-surface rounded-2xl border border-border p-5 h-fit lg:sticky lg:top-24 space-y-3">
          <h2 className="font-bold text-text">Récapitulatif</h2>
          <p className="text-sm text-muted">{cartQuery.data.summary.totalQuantity} article{cartQuery.data.summary.totalQuantity > 1 ? 's' : ''}</p>
          <div className="flex justify-between text-sm"><span className="text-muted">Sous-total</span><span className="font-medium text-text">{formatPrice(quote?.subtotalAmount ?? subtotal)}</span></div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Livraison{selectedZone ? <span className="block text-[11px]">{selectedZone.name}{sellerGroups.length > 1 ? ` × ${sellerGroups.length} vendeurs` : ''}</span> : null}</span>
            <span className={clsx('font-medium', shippingTotal > 0 ? 'text-text' : zonesAvailable ? 'text-muted' : 'text-success')} data-testid="checkout-shipping">
              {shippingTotal > 0 ? formatPrice(shippingTotal) : zonesAvailable ? 'Selon la zone' : 'Offerte'}
            </span>
          </div>
          <div className="border-t border-border pt-3 flex justify-between text-base font-bold"><span className="text-text">Total</span><span className="text-primary" data-testid="checkout-total">{formatPrice(grandTotal)}</span></div>
          {quoteQuery.isFetching && <p className="text-[11px] text-muted">Mise à jour du récapitulatif…</p>}
          {quoteQuery.isError && !quoteQuery.isFetching && <p className="text-[11px] text-amber-700 dark:text-amber-300">Montants indicatifs : le récapitulatif n’a pas pu être vérifié.</p>}
          <p className="text-[11px] text-muted pt-1">En confirmant, vous acceptez nos conditions générales de vente.</p>
        </aside>
      </div>
    </div>
  );
}

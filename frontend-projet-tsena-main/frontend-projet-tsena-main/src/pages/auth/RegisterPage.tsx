import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, User, Phone, Store, ShieldCheck, type LucideIcon } from 'lucide-react';
import { useTitle } from '../../hooks';
import { useRegister } from '../../hooks/mutations/useAuthMutations';
import { useRegisterOptions } from '../../hooks/queries/useAuthQueries';
import AuthShell from '../../components/auth/AuthShell';
import AccountTypeSelector from '../../components/auth/AccountTypeSelector';
import { FormError, FormField } from '../../components/form';
import RegistrationConsentFields, { EMPTY_CONSENT, toRegisterConsentPayload, validateConsent, type RegistrationConsent } from '../../components/auth/RegistrationConsentFields';
import Button from '../../components/common/Button';
import { compactErrors, hasErrors, validateEmail, validateName, validatePassword, validatePhone, VALIDATION_MESSAGES } from '../../lib/validation';
import { getApiErrorMessage, getFieldErrors } from '../../lib/api-error';
import { toast } from '../../lib/toast';
import { getDashboardRoute } from '../../shared/data/permissions';
import type { RegistrationAccountType } from '../../types/api';

interface RegisterPageProps {
  readonly defaultAccountType?: RegistrationAccountType;
}

const TYPE_FROM_QUERY: Record<string, RegistrationAccountType> = {
  client: 'client',
  vendeur: 'seller',
  seller: 'seller',
  admin: 'admin',
  administrateur: 'admin',
};

interface Copy {
  readonly title: string;
  readonly subtitle: string;
  readonly panelTitle: string;
  readonly panelText: string;
  readonly submitLabel: string;
  readonly submitIcon?: LucideIcon;
  readonly seo: string;
}

const COPY: Record<RegistrationAccountType, Copy> = {
  client: {
    title: 'Créer un compte',
    subtitle: 'Rejoignez Tsena en quelques secondes',
    panelTitle: 'Rejoignez Tsena',
    panelText: 'Créez votre compte et découvrez des milliers de produits de qualité. Achetez en toute confiance.',
    submitLabel: 'Créer mon compte',
    seo: 'Créez votre compte Tsena gratuitement et achetez en toute confiance auprès de vendeurs vérifiés à Madagascar.',
  },
  seller: {
    title: 'Ouvrir une boutique',
    subtitle: 'Créez votre compte vendeur sur Tsena',
    panelTitle: 'Vendez sur Tsena',
    panelText: "Touchez des milliers d'acheteurs, gérez vos produits et vos commandes depuis un tableau de bord dédié. Votre demande est validée par notre équipe sous 48 h.",
    submitLabel: 'Créer mon compte vendeur',
    submitIcon: Store,
    seo: 'Devenez vendeur sur Tsena : publiez vos produits, vendez partout à Madagascar et soyez payé dès la réception confirmée.',
  },
  admin: {
    title: 'Créer le compte administrateur',
    subtitle: 'Initialisation de la plateforme Tsena',
    panelTitle: 'Administration Tsena',
    panelText: "Ce premier compte dispose de tous les droits : validation des vendeurs, modération, litiges, paramètres. Il ne peut être créé qu'une seule fois depuis ce formulaire.",
    submitLabel: 'Créer le compte administrateur',
    submitIcon: ShieldCheck,
    seo: 'Création du premier compte administrateur de la plateforme Tsena.',
  },
};

export default function RegisterPage({ defaultAccountType = 'client' }: RegisterPageProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const register = useRegister();
  const options = useRegisterOptions();

  const initialType = TYPE_FROM_QUERY[(searchParams.get('type') ?? '').toLowerCase()] ?? defaultAccountType;
  const [requestedType, setAccountType] = useState<RegistrationAccountType>(initialType);
  const adminOpen = options.data?.adminRegistrationOpen === true;
  const accountType: RegistrationAccountType = requestedType === 'admin' && !adminOpen ? 'client' : requestedType;
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [submitted, setSubmitted] = useState(false);
  const [consent, setConsent] = useState<RegistrationConsent>(EMPTY_CONSENT);
  const update = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const copy = COPY[accountType];
  useTitle(copy.title, { description: copy.seo });

  const isSeller = accountType === 'seller';
  const isAdmin = accountType === 'admin';

  const clientErrors = compactErrors({
    firstName: validateName(form.firstName),
    lastName: isSeller || form.lastName ? validateName(form.lastName) : undefined,
    email: validateEmail(form.email),
    phone: validatePhone(form.phone, isSeller),
    password: validatePassword(form.password),
    confirmPassword: form.confirmPassword === form.password ? undefined : VALIDATION_MESSAGES.passwordMismatch,
    ...validateConsent(consent),
  });
  const serverErrors = getFieldErrors(register.error);
  const errors: Record<string, string | undefined> = { ...serverErrors, ...(submitted ? clientErrors : {}) };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (hasErrors(clientErrors) || register.isPending) return;
    register.mutate(
      {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim() || undefined,
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || undefined,
        password: form.password,
        accountType,
        ...toRegisterConsentPayload(consent),
      },
      {
        onSuccess: (user) => {
          if (isSeller) {
            toast.info('Demande vendeur enregistrée', {
              id: 'seller-request-pending',
              description: "Un administrateur va l'examiner. Vous pouvez acheter dès maintenant ; l'espace vendeur s'activera après validation.",
            });
          }
          navigate(getDashboardRoute(user.role), { replace: true });
        },
      },
    );
  };

  return (
    <AuthShell
      title={copy.title}
      subtitle={copy.subtitle}
      panelTitle={copy.panelTitle}
      panelText={copy.panelText}
      footer={
        <>
          <p>Déjà un compte ? <Link to="/connexion" className="text-primary font-semibold hover:underline">Se connecter</Link></p>
          {isSeller ? (
            <p>Simple acheteur ? <button type="button" onClick={() => setAccountType('client')} className="text-primary font-semibold hover:underline">Créer un compte client</button></p>
          ) : (
            <p>Vous êtes vendeur ? <button type="button" onClick={() => setAccountType('seller')} className="text-primary font-semibold hover:underline">Ouvrir une boutique</button></p>
          )}
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4" aria-busy={register.isPending}>
        {register.isError && <FormError error={register.error} handledFields={Object.keys(errors)} />}

        <AccountTypeSelector
          value={accountType}
          onChange={(type) => { setAccountType(type); register.reset(); }}
          options={options.data}
          optionsError={options.isError}
          optionsErrorMessage={options.isError ? getApiErrorMessage(options.error) : undefined}
          onRetryOptions={() => void options.refetch()}
          error={errors.accountType}
          disabled={register.isPending}
        />

        {isSeller && (
          <div className="flex items-start gap-3 bg-primary/5 border border-primary/15 rounded-xl px-4 py-3 text-sm" data-testid="seller-approval-notice">
            <ShieldCheck size={18} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-muted">
              <span className="font-semibold text-text">Validation par un administrateur.</span> Vous pourrez acheter immédiatement ; l'espace vendeur sera activé dès l'approbation de votre demande.
            </p>
          </div>
        )}
        {isAdmin && (
          <div className="flex items-start gap-3 bg-primary/5 border border-primary/15 rounded-xl px-4 py-3 text-sm" data-testid="admin-first-account-notice">
            <ShieldCheck size={18} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-muted">
              <span className="font-semibold text-text">Premier administrateur.</span> Ce compte obtient tous les droits sur la plateforme ; utilisez une adresse e-mail que vous contrôlez et un mot de passe robuste. Les administrateurs suivants seront créés depuis l'espace d'administration.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Prénom" icon={User} value={form.firstName} onChange={update('firstName')} autoComplete="given-name" error={errors.firstName} required />
          <FormField label="Nom" icon={User} value={form.lastName} onChange={update('lastName')} autoComplete="family-name" error={errors.lastName} required={isSeller} />
        </div>
        <FormField label={isSeller ? 'Email professionnel' : 'Email'} type="email" icon={Mail} value={form.email} onChange={update('email')} placeholder={isSeller ? 'boutique@email.com' : 'votre@email.com'} autoComplete="email" error={errors.email} required />
        <FormField
          label="Téléphone"
          type="tel"
          icon={Phone}
          value={form.phone}
          onChange={update('phone')}
          placeholder="034 00 000 00"
          autoComplete="tel"
          error={errors.phone}
          hint={isSeller ? 'Utilisé pour la validation de votre boutique et le suivi des commandes.' : undefined}
          required={isSeller}
        />
        <FormField label="Mot de passe" type="password" icon={Lock} value={form.password} onChange={update('password')} autoComplete="new-password" error={errors.password} hint={VALIDATION_MESSAGES.password} required />
        <FormField label="Confirmer le mot de passe" type="password" icon={Lock} value={form.confirmPassword} onChange={update('confirmPassword')} autoComplete="new-password" error={errors.confirmPassword} required />
        <RegistrationConsentFields value={consent} onChange={setConsent} errors={{ birthDate: errors.birthDate, acceptTerms: errors.acceptTerms }} disabled={register.isPending} />

        <Button
          type="submit"
          size="lg"
          fullWidth
          icon={copy.submitIcon}
          loading={register.isPending}
          loadingLabel="Création du compte..."
          data-testid="register-submit"
        >
          {copy.submitLabel}
        </Button>
      </form>
    </AuthShell>
  );
}

import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Camera, Save, Lock, Mail, MailCheck, MailWarning, Store, Phone, User, Clock, Cake, BellRing, ShieldCheck } from 'lucide-react';
import { useTitle } from '../../hooks';
import { useAuth } from '../../context/AuthContext';
import { useChangePassword, useRequestSellerAccount, useResendVerification, useUpdateProfile, useUploadAvatar } from '../../hooks/mutations/useAuthMutations';
import { Button, ConfirmDialog } from '../../components/common';
import { FormError, FormField } from '../../components/form';
import PageHeader from '../../shared/components/PageHeader';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import { compactErrors, hasErrors, validateName, validatePassword, validatePhone, VALIDATION_MESSAGES } from '../../lib/validation';
import { getFieldErrors } from '../../lib/api-error';
import { formatDate, ROLE_LABELS } from '../../lib/format';
import { resolveMediaUrl } from '../../lib/media';
import { usePublicSettings } from '../../hooks/queries/useNotifications';
import { GENDER_LABELS, type Gender } from '../../types/api';

const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const AVATAR_MAX_MB = 5;

interface ProfilePageProps {
  readonly title?: string;
  readonly subtitle?: string;
  readonly children?: ReactNode;
}

export default function ClientProfilePage({ title = 'Mon profil', subtitle = 'Gérez vos informations personnelles et la sécurité de votre compte', children }: ProfilePageProps = {}) {
  useTitle(title);
  const { user } = useAuth();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const uploadAvatar = useUploadAvatar();
  const resendVerification = useResendVerification();
  const requestSeller = useRequestSellerAccount();
  const confirmSellerRequest = useConfirmAction<true>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarError, setAvatarError] = useState('');

  const [profile, setProfile] = useState({ firstName: user?.firstName ?? '', lastName: user?.lastName ?? '', phone: user?.phone ?? '' });
  const [profileSubmitted, setProfileSubmitted] = useState(false);
  const [personal, setPersonal] = useState({ birthDate: user?.birthDate ?? '', gender: (user?.gender ?? 'unspecified') as Gender });
  const [prefs, setPrefs] = useState({
    marketingOptIn: user?.marketingOptIn ?? false,
    notifyFollowedShopProducts: user?.notifyFollowedShopProducts ?? true,
    notifyFollowedShopPromotions: user?.notifyFollowedShopPromotions ?? true,
    notifyMessagesByEmail: user?.notifyMessagesByEmail ?? true,
  });
  const publicSettings = usePublicSettings();
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordSubmitted, setPasswordSubmitted] = useState(false);

  if (!user) return null;

  const profileClientErrors = compactErrors({
    firstName: validateName(profile.firstName),
    lastName: profile.lastName ? validateName(profile.lastName) : undefined,
    phone: validatePhone(profile.phone),
  });
  const profileErrors = { ...getFieldErrors(updateProfile.error), ...(profileSubmitted ? profileClientErrors : {}) };
  const profileDirty = profile.firstName !== (user.firstName ?? '') || profile.lastName !== (user.lastName ?? '') || profile.phone !== (user.phone ?? '');

  const passwordClientErrors = compactErrors({
    currentPassword: password.currentPassword ? undefined : VALIDATION_MESSAGES.required,
    newPassword: validatePassword(password.newPassword) ?? (password.newPassword === password.currentPassword ? "Le nouveau mot de passe doit être différent de l'actuel." : undefined),
    confirmPassword: password.confirmPassword === password.newPassword ? undefined : VALIDATION_MESSAGES.passwordMismatch,
  });
  const passwordErrors = { ...getFieldErrors(changePassword.error), ...(passwordSubmitted ? passwordClientErrors : {}) };

  const submitProfile = (event: FormEvent) => {
    event.preventDefault();
    setProfileSubmitted(true);
    if (hasErrors(profileClientErrors) || updateProfile.isPending || !profileDirty) return;
    updateProfile.mutate(
      { firstName: profile.firstName.trim(), lastName: profile.lastName.trim() || undefined, phone: profile.phone.trim() || undefined },
      { onSuccess: () => setProfileSubmitted(false) },
    );
  };

  const submitPassword = (event: FormEvent) => {
    event.preventDefault();
    setPasswordSubmitted(true);
    if (hasErrors(passwordClientErrors) || changePassword.isPending) return;
    changePassword.mutate(
      { currentPassword: password.currentPassword, newPassword: password.newPassword },
      { onSuccess: () => { setPassword({ currentPassword: '', newPassword: '', confirmPassword: '' }); setPasswordSubmitted(false); } },
    );
  };

  const today = new Date().toISOString().slice(0, 10);
  const birthDateError = personal.birthDate && personal.birthDate > today ? 'La date de naissance ne peut pas être dans le futur.' : undefined;
  const personalDirty = personal.birthDate !== (user.birthDate ?? '') || personal.gender !== (user.gender ?? 'unspecified');
  const prefsDirty =
    prefs.marketingOptIn !== (user.marketingOptIn ?? false) ||
    prefs.notifyFollowedShopProducts !== (user.notifyFollowedShopProducts ?? true) ||
    prefs.notifyFollowedShopPromotions !== (user.notifyFollowedShopPromotions ?? true) ||
    prefs.notifyMessagesByEmail !== (user.notifyMessagesByEmail ?? true);

  const submitPersonal = (event: FormEvent) => {
    event.preventDefault();
    if (birthDateError || updateProfile.isPending || !personalDirty) return;
    updateProfile.mutate({ birthDate: personal.birthDate, gender: personal.gender });
  };

  const submitPrefs = (event: FormEvent) => {
    event.preventDefault();
    if (updateProfile.isPending || !prefsDirty) return;
    updateProfile.mutate(prefs);
  };

  const majorityAge = publicSettings.data?.majorityAge ?? 18;

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setAvatarError('');
    if (!AVATAR_TYPES.includes(file.type)) { setAvatarError('Format non pris en charge (JPG, PNG ou WEBP).'); return; }
    if (file.size > AVATAR_MAX_MB * 1024 * 1024) { setAvatarError(`L'image dépasse ${AVATAR_MAX_MB} Mo.`); return; }
    uploadAvatar.mutate(file);
  };

  const canRequestSeller = user.role === 'client' && !user.sellerRequestedAt;
  const sellerRequestPending = user.role === 'client' && !!user.sellerRequestedAt;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={title} subtitle={subtitle} />
      {children}

      <section className="bg-surface rounded-xl border border-border p-6" aria-labelledby="identity-heading">
        <div className="flex items-center gap-5">
          <div className="relative">
            {user.avatarUrl ? (
              <img src={resolveMediaUrl(user.avatarUrl)} alt="" className="w-20 h-20 rounded-full object-cover border-2 border-border" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary text-white flex items-center justify-center text-2xl font-bold">{user.initials}</div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadAvatar.isPending}
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-surface border border-border shadow flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-colors disabled:opacity-60"
              aria-label="Changer la photo de profil"
            >
              <Camera size={14} />
            </button>
            <input ref={fileInputRef} type="file" accept={AVATAR_TYPES.join(',')} className="hidden" onChange={handleAvatarChange} aria-label="Choisir une photo de profil" />
          </div>
          <div className="min-w-0">
            <h2 id="identity-heading" className="font-semibold text-lg text-text truncate">{user.fullName}</h2>
            <p className="text-sm text-muted truncate">{user.email}</p>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">{ROLE_LABELS[user.role]}</span>
              <span className="text-xs text-muted">Membre depuis {formatDate(user.createdAt)}</span>
            </div>
            {uploadAvatar.isPending && <p className="text-xs text-primary mt-1">Téléversement de la photo…</p>}
            {avatarError && <p className="text-xs text-danger mt-1" role="alert">{avatarError}</p>}
          </div>
        </div>
      </section>

      <section className={`rounded-xl border p-5 flex flex-col sm:flex-row sm:items-center gap-4 ${user.emailVerified ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30' : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30'}`} aria-live="polite">
        {user.emailVerified ? <MailCheck size={22} className="text-emerald-600 shrink-0" /> : <MailWarning size={22} className="text-amber-600 shrink-0" />}
        <div className="flex-1">
          <p className="font-semibold text-sm text-text">{user.emailVerified ? 'Adresse e-mail vérifiée' : 'Adresse e-mail non vérifiée'}</p>
          <p className="text-xs text-muted">{user.emailVerified ? 'Votre compte est pleinement actif.' : 'Vérifiez votre boîte de réception pour confirmer votre adresse e-mail.'}</p>
        </div>
        {!user.emailVerified && (
          <Button size="sm" variant="outline" icon={Mail} onClick={() => resendVerification.mutate()} loading={resendVerification.isPending} loadingLabel="Envoi..." disabled={resendVerification.isSuccess}>
            {resendVerification.isSuccess ? 'E-mail envoyé' : "Renvoyer l'e-mail"}
          </Button>
        )}
      </section>

      <form onSubmit={submitProfile} noValidate className="bg-surface rounded-xl border border-border p-6 space-y-4" aria-busy={updateProfile.isPending}>
        <h3 className="font-semibold text-text flex items-center gap-2"><User size={18} className="text-primary" /> Informations personnelles</h3>
        {updateProfile.isError && <FormError error={updateProfile.error} handledFields={Object.keys(profileErrors)} />}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Prénom" value={profile.firstName} onChange={(e) => setProfile((p) => ({ ...p, firstName: e.target.value }))} autoComplete="given-name" error={profileErrors.firstName} required />
          <FormField label="Nom" value={profile.lastName} onChange={(e) => setProfile((p) => ({ ...p, lastName: e.target.value }))} autoComplete="family-name" error={profileErrors.lastName} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Email" type="email" icon={Mail} value={user.email} disabled readOnly hint="L'adresse e-mail ne peut pas être modifiée." />
          <FormField label="Téléphone" type="tel" icon={Phone} value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} placeholder="034 00 000 00" autoComplete="tel" error={profileErrors.phone} />
        </div>
        <div className="flex justify-end">
          <Button type="submit" icon={Save} loading={updateProfile.isPending} loadingLabel="Enregistrement..." disabled={!profileDirty}>Enregistrer</Button>
        </div>
      </form>

      <form onSubmit={submitPersonal} noValidate className="bg-surface rounded-xl border border-border p-6 space-y-4" aria-busy={updateProfile.isPending} data-testid="profile-personal-form">
        <div>
          <h3 className="font-semibold text-text flex items-center gap-2"><Cake size={18} className="text-primary" /> Données personnelles</h3>
          <p className="text-xs text-muted mt-1">Facultatives. Elles servent uniquement à adapter votre expérience et à appliquer les règles liées à l'âge ; elles ne sont jamais utilisées pour vous discriminer.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="Date de naissance"
            type="date"
            max={today}
            value={personal.birthDate}
            onChange={(e) => setPersonal((p) => ({ ...p, birthDate: e.target.value }))}
            error={birthDateError}
            hint={user.age != null ? `${user.age} ans — ${user.isAdult ? 'majeur(e)' : `mineur(e) (majorité à ${majorityAge} ans)`}` : `Recommandée : certaines catégories sont réservées aux personnes de ${majorityAge} ans et plus.`}
            autoComplete="bday"
          />
          <FormField label="Sexe" as="select" value={personal.gender} onChange={(e) => setPersonal((p) => ({ ...p, gender: e.target.value as Gender }))} hint="Vous pouvez ne pas répondre.">
            {(Object.keys(GENDER_LABELS) as Gender[]).map((value) => (
              <option key={value} value={value}>{GENDER_LABELS[value]}</option>
            ))}
          </FormField>
        </div>
        <div className="flex items-start gap-2 text-xs text-muted bg-surface-secondary/60 rounded-lg p-3">
          <ShieldCheck size={14} className="text-primary shrink-0 mt-0.5" />
          <p>Ces informations restent privées : elles ne sont jamais affichées aux vendeurs ni aux autres membres. Vous pouvez les effacer à tout moment en vidant le champ.</p>
        </div>
        <div className="flex justify-end">
          <Button type="submit" icon={Save} loading={updateProfile.isPending} loadingLabel="Enregistrement..." disabled={!personalDirty || !!birthDateError}>Enregistrer</Button>
        </div>
      </form>

      <form onSubmit={submitPrefs} noValidate className="bg-surface rounded-xl border border-border p-6 space-y-4" aria-busy={updateProfile.isPending} data-testid="profile-prefs-form">
        <div>
          <h3 className="font-semibold text-text flex items-center gap-2"><BellRing size={18} className="text-primary" /> Préférences de communication</h3>
          <p className="text-xs text-muted mt-1">Les e-mails liés à vos commandes, paiements, litiges et à la sécurité du compte sont toujours envoyés. Les communications marketing nécessitent votre accord.</p>
        </div>
        <div className="space-y-3">
          {([
            { key: 'marketingOptIn', label: 'Recevoir des offres et actualités marketing', hint: user.marketingOptInAt && prefs.marketingOptIn ? `Consentement donné le ${formatDate(user.marketingOptInAt)}` : 'Consentement explicite, révocable à tout moment.' },
            { key: 'notifyFollowedShopProducts', label: 'Nouveaux produits des boutiques que je suis', hint: 'Nécessite le consentement marketing.' },
            { key: 'notifyFollowedShopPromotions', label: 'Promotions des boutiques que je suis', hint: 'Nécessite le consentement marketing.' },
            { key: 'notifyMessagesByEmail', label: 'Nouveaux messages par e-mail', hint: 'Notification transactionnelle : une copie des messages reçus dans la messagerie.' },
          ] as const).map(({ key, label, hint }) => (
            <label key={key} className="flex items-start gap-3 rounded-lg border border-border p-3 hover:bg-surface-hover transition-colors cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 w-4 h-4 accent-primary"
                checked={prefs[key]}
                onChange={(e) => setPrefs((p) => ({ ...p, [key]: e.target.checked }))}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-text">{label}</span>
                <span className="block text-xs text-muted">{hint}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="flex justify-end">
          <Button type="submit" icon={Save} loading={updateProfile.isPending} loadingLabel="Enregistrement..." disabled={!prefsDirty}>Enregistrer mes préférences</Button>
        </div>
      </form>

      <form onSubmit={submitPassword} noValidate className="bg-surface rounded-xl border border-border p-6 space-y-4" aria-busy={changePassword.isPending}>
        <h3 className="font-semibold text-text flex items-center gap-2"><Lock size={18} className="text-primary" /> Changer le mot de passe</h3>
        {changePassword.isError && <FormError error={changePassword.error} handledFields={Object.keys(passwordErrors)} />}
        <FormField label="Mot de passe actuel" type="password" value={password.currentPassword} onChange={(e) => setPassword((p) => ({ ...p, currentPassword: e.target.value }))} autoComplete="current-password" error={passwordErrors.currentPassword} required />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Nouveau mot de passe" type="password" value={password.newPassword} onChange={(e) => setPassword((p) => ({ ...p, newPassword: e.target.value }))} autoComplete="new-password" error={passwordErrors.newPassword} hint={VALIDATION_MESSAGES.password} required />
          <FormField label="Confirmer" type="password" value={password.confirmPassword} onChange={(e) => setPassword((p) => ({ ...p, confirmPassword: e.target.value }))} autoComplete="new-password" error={passwordErrors.confirmPassword} required />
        </div>
        <div className="flex justify-end">
          <Button type="submit" variant="outline" icon={Lock} loading={changePassword.isPending} loadingLabel="Modification...">Mettre à jour le mot de passe</Button>
        </div>
      </form>

      {(canRequestSeller || sellerRequestPending) && (
        <section className="bg-surface rounded-xl border border-border p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent/20 text-primary flex items-center justify-center shrink-0"><Store size={22} /></div>
          <div className="flex-1">
            <h3 className="font-semibold text-text">Vendre sur Tsena</h3>
            {sellerRequestPending ? (
              <p className="text-sm text-muted flex items-center gap-1.5 mt-0.5"><Clock size={14} /> Demande envoyée le {formatDate(user.sellerRequestedAt)} — en attente de validation par un administrateur.</p>
            ) : (
              <p className="text-sm text-muted mt-0.5">Ouvrez votre boutique et touchez des milliers d'acheteurs. Votre demande est validée par notre équipe.</p>
            )}
          </div>
          {canRequestSeller && (
            <Button variant="secondary" icon={Store} onClick={() => confirmSellerRequest.request(true)} loading={requestSeller.isPending} loadingLabel="Envoi...">
              Devenir vendeur
            </Button>
          )}
        </section>
      )}

      <ConfirmDialog
        open={confirmSellerRequest.isOpen}
        title="Demander l'ouverture d'une boutique ?"
        description="Un administrateur examinera votre demande. Vous serez notifié dès l'activation de votre espace vendeur."
        confirmLabel="Envoyer la demande"
        loadingLabel="Envoi..."
        loading={requestSeller.isPending}
        onConfirm={() => void confirmSellerRequest.run(() => requestSeller.mutateAsync())}
        onCancel={confirmSellerRequest.cancel}
      />
    </div>
  );
}

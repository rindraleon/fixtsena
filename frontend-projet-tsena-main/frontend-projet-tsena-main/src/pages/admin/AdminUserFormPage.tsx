import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Mail, Phone, Lock, User as UserIcon, Shield } from 'lucide-react';
import { useTitle } from '../../hooks';
import { useAuth } from '../../context/AuthContext';
import { useUser } from '../../hooks/queries/useUsers';
import { useCreateUser, useUpdateUser } from '../../hooks/mutations/useUserMutations';
import { Button, EmptyState, ErrorState, LoadingState } from '../../components/common';
import { FormError, FormField } from '../../components/form';
import PageHeader from '../../shared/components/PageHeader';
import { getFieldErrors, isNotFoundError } from '../../lib/api-error';
import { compactErrors, hasErrors, validateEmail, validateName, validatePassword, validatePhone, VALIDATION_MESSAGES } from '../../lib/validation';
import { ACCOUNT_STATUS_LABELS, ROLE_LABELS } from '../../lib/format';
import type { AccountStatus, ApiUser, UserRole } from '../../types/api';

const BACK = '/dashboard/admin/utilisateurs';
const ROLE_OPTIONS: UserRole[] = ['client', 'seller', 'admin'];
const STATUS_OPTIONS: AccountStatus[] = ['active', 'suspended', 'disabled', 'pending_verification'];

interface FormState { firstName: string; lastName: string; email: string; password: string; phone: string; roles: UserRole[]; status: AccountStatus }

function initialState(user?: ApiUser): FormState {
  return {
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    email: user?.email ?? '',
    password: '',
    phone: user?.phone ?? '',
    roles: user?.roles.filter((r): r is UserRole => r !== 'buyer') ?? ['client'],
    status: user?.status ?? 'active',
  };
}

function UserForm({ user, onSaved }: { user?: ApiUser; onSaved: () => void }) {
  const isEdit = !!user;
  const { user: me } = useAuth();
  const isSelf = !!user && user.id === me?.id;
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const mutation = isEdit ? updateUser : createUser;
  const [form, setForm] = useState<FormState>(() => initialState(user));
  const [submitted, setSubmitted] = useState(false);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const clientErrors = compactErrors({
    firstName: validateName(form.firstName),
    lastName: form.lastName ? validateName(form.lastName) : undefined,
    email: isEdit ? undefined : validateEmail(form.email),
    password: isEdit ? undefined : validatePassword(form.password),
    phone: validatePhone(form.phone),
    roles: form.roles.length === 0 ? 'Sélectionnez au moins un rôle.' : undefined,
  });
  const errors: Record<string, string | undefined> = { ...getFieldErrors(mutation.error), ...(submitted ? clientErrors : {}) };

  const toggleRole = (role: UserRole) => set('roles', form.roles.includes(role) ? form.roles.filter((r) => r !== role) : [...form.roles, role]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (hasErrors(clientErrors) || mutation.isPending) return;
    const base = { firstName: form.firstName.trim(), lastName: form.lastName.trim() || undefined, phone: form.phone.trim() || undefined, roles: form.roles, status: form.status };
    if (isEdit && user) {
      updateUser.mutate({ id: user.id, dto: base }, { onSuccess: onSaved });
    } else {
      createUser.mutate({ ...base, email: form.email.trim().toLowerCase(), password: form.password }, { onSuccess: onSaved });
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-6" aria-busy={mutation.isPending}>
      {mutation.isError && <FormError error={mutation.error} handledFields={Object.keys(errors)} />}

      <section className="bg-surface rounded-xl border border-border p-6 space-y-4">
        <h3 className="font-semibold text-text flex items-center gap-2"><UserIcon size={18} className="text-primary" /> Identité</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Prénom" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} error={errors.firstName} autoComplete="off" required />
          <FormField label="Nom" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} error={errors.lastName} autoComplete="off" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Email" type="email" icon={Mail} value={form.email} onChange={(e) => set('email', e.target.value)} error={errors.email} disabled={isEdit} readOnly={isEdit} hint={isEdit ? "L'adresse e-mail ne peut pas être modifiée." : undefined} autoComplete="off" required={!isEdit} />
          <FormField label="Téléphone" type="tel" icon={Phone} value={form.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} placeholder="034 00 000 00" autoComplete="off" />
        </div>
        {!isEdit && (
          <FormField label="Mot de passe initial" type="password" icon={Lock} value={form.password} onChange={(e) => set('password', e.target.value)} error={errors.password} hint={VALIDATION_MESSAGES.password} autoComplete="new-password" required />
        )}
      </section>

      <section className="bg-surface rounded-xl border border-border p-6 space-y-4">
        <h3 className="font-semibold text-text flex items-center gap-2"><Shield size={18} className="text-primary" /> Rôles et statut</h3>
        <fieldset>
          <legend className="block text-sm font-medium text-text mb-2">Rôles <span className="text-danger">*</span></legend>
          <div className="flex flex-wrap gap-2">
            {ROLE_OPTIONS.map((role) => {
              const checked = form.roles.includes(role);
              const locked = isSelf && role === 'admin';
              return (
                <label key={role} className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${checked ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted hover:border-primary/40'} ${locked ? 'opacity-60 cursor-not-allowed' : ''}`}>
                  <input type="checkbox" checked={checked} disabled={locked} onChange={() => toggleRole(role)} className="accent-primary" />
                  {ROLE_LABELS[role]}
                </label>
              );
            })}
          </div>
          {errors.roles && <p className="text-xs text-danger mt-1" role="alert">{errors.roles}</p>}
          {isSelf && <p className="text-xs text-muted mt-1">Vous ne pouvez pas retirer votre propre rôle administrateur.</p>}
        </fieldset>
        <div>
          <label htmlFor="user-status" className="block text-sm font-medium text-text mb-1">Statut du compte</label>
          <select id="user-status" value={form.status} onChange={(e) => set('status', e.target.value as AccountStatus)} disabled={isSelf} className="w-full sm:max-w-xs px-3 py-2 border border-input-border bg-input-bg rounded-lg text-sm text-text focus:outline-none focus:border-primary disabled:opacity-60">
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{ACCOUNT_STATUS_LABELS[s]}</option>)}
          </select>
          {errors.status && <p className="text-xs text-danger mt-1" role="alert">{errors.status}</p>}
        </div>
      </section>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onSaved} disabled={mutation.isPending}>Annuler</Button>
        <Button type="submit" icon={Save} loading={mutation.isPending} loadingLabel={isEdit ? 'Enregistrement...' : 'Création...'} data-testid="user-form-submit">{isEdit ? 'Enregistrer les modifications' : "Créer l'utilisateur"}</Button>
      </div>
    </form>
  );
}

export default function AdminUserFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  useTitle(isEdit ? "Modifier l'utilisateur | Administration" : 'Nouvel utilisateur | Administration');
  const navigate = useNavigate();
  const userQuery = useUser(id);

  if (isEdit && userQuery.isPending) return <LoadingState variant="detail" label="Chargement de l'utilisateur..." />;
  if (isEdit && userQuery.isError) {
    return isNotFoundError(userQuery.error)
      ? <EmptyState title="Utilisateur introuvable" description="Ce compte n'existe pas ou a été supprimé." action={{ label: 'Retour aux utilisateurs', to: BACK }} />
      : <ErrorState error={userQuery.error} onRetry={() => void userQuery.refetch()} retrying={userQuery.isFetching} />;
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={isEdit ? "Modifier l'utilisateur" : 'Nouvel utilisateur'}
        subtitle={isEdit ? userQuery.data?.email : 'Créez un compte et attribuez-lui ses rôles'}
        breadcrumb={[{ label: 'Utilisateurs', href: BACK }, { label: isEdit ? 'Modifier' : 'Nouveau' }]}
      />
      <UserForm key={userQuery.data?.id ?? 'new'} user={userQuery.data} onSaved={() => navigate(BACK)} />
    </div>
  );
}

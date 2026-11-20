import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, KeyRound } from 'lucide-react';
import { useTitle } from '../../hooks';
import { useResetPassword } from '../../hooks/mutations/useAuthMutations';
import AuthShell from '../../components/auth/AuthShell';
import { FormError, FormField } from '../../components/form';
import Button from '../../components/common/Button';
import { EmptyState } from '../../components/common';
import { compactErrors, hasErrors, validatePassword, VALIDATION_MESSAGES } from '../../lib/validation';
import { getFieldErrors } from '../../lib/api-error';

export default function ResetPasswordPage() {
  useTitle('Réinitialiser le mot de passe');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const resetPassword = useResetPassword();

  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [submitted, setSubmitted] = useState(false);

  const clientErrors = compactErrors({
    password: validatePassword(form.password),
    confirmPassword: form.confirmPassword === form.password ? undefined : VALIDATION_MESSAGES.passwordMismatch,
  });
  const serverErrors = getFieldErrors(resetPassword.error);
  const errors = { ...serverErrors, ...(submitted ? clientErrors : {}) };

  if (!token) {
    return (
      <AuthShell title="Lien invalide" panelTitle="Réinitialisation" panelText="Ce lien de réinitialisation est incomplet ou a expiré.">
        <EmptyState
          icon={KeyRound}
          title="Lien de réinitialisation invalide"
          description="Demandez un nouveau lien depuis la page « Mot de passe oublié »."
          action={{ label: 'Demander un nouveau lien', to: '/mot-de-passe-oublie' }}
          secondaryAction={{ label: 'Retour à la connexion', to: '/connexion' }}
          compact
        />
      </AuthShell>
    );
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (hasErrors(clientErrors) || resetPassword.isPending) return;
    resetPassword.mutate(
      { token, newPassword: form.password },
      { onSuccess: () => navigate('/connexion', { replace: true }) },
    );
  };

  return (
    <AuthShell
      title="Nouveau mot de passe"
      subtitle="Choisissez un mot de passe sécurisé pour votre compte."
      panelTitle="Sécurisez votre compte"
      panelText="Choisissez un mot de passe unique que vous n'utilisez sur aucun autre site."
      footer={<p><Link to="/connexion" className="text-primary font-semibold hover:underline">Retour à la connexion</Link></p>}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4" aria-busy={resetPassword.isPending}>
        {resetPassword.isError && <FormError error={resetPassword.error} handledFields={Object.keys(errors)} />}
        <FormField label="Nouveau mot de passe" type="password" icon={Lock} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} autoComplete="new-password" error={errors.password} hint={VALIDATION_MESSAGES.password} required />
        <FormField label="Confirmer le mot de passe" type="password" icon={Lock} value={form.confirmPassword} onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))} autoComplete="new-password" error={errors.confirmPassword} required />
        <Button type="submit" size="lg" fullWidth loading={resetPassword.isPending} loadingLabel="Réinitialisation...">
          Réinitialiser le mot de passe
        </Button>
      </form>
    </AuthShell>
  );
}

import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Mail, Lock } from 'lucide-react';
import { useTitle } from '../../hooks';
import { useLogin } from '../../hooks/mutations/useAuthMutations';
import { getDashboardRoute } from '../../shared/data/permissions';
import AuthShell from '../../components/auth/AuthShell';
import { FormError, FormField } from '../../components/form';
import Button from '../../components/common/Button';
import { compactErrors, hasErrors, validateEmail, VALIDATION_MESSAGES } from '../../lib/validation';
import { getFieldErrors } from '../../lib/api-error';

export default function LoginPage() {
  useTitle('Connexion', { description: 'Connectez-vous à votre compte Tsena pour suivre vos commandes, gérer votre boutique ou votre panier.' });
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const login = useLogin();

  const [form, setForm] = useState({ email: '', password: '' });
  const [submitted, setSubmitted] = useState(false);

  const clientErrors = compactErrors({
    email: validateEmail(form.email),
    password: form.password ? undefined : VALIDATION_MESSAGES.required,
  });
  const serverErrors = getFieldErrors(login.error);
  const errors = { ...serverErrors, ...(submitted ? clientErrors : {}) };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (hasErrors(clientErrors) || login.isPending) return;
    login.mutate(
      { email: form.email.trim().toLowerCase(), password: form.password },
      { onSuccess: (user) => navigate(from ?? getDashboardRoute(user.role), { replace: true }) },
    );
  };

  return (
    <AuthShell
      title="Connexion"
      subtitle="Entrez vos identifiants pour accéder à votre compte"
      panelTitle="Bienvenue sur Tsena"
      panelText="Votre marketplace de confiance. Des milliers de produits de qualité aux meilleurs prix, livrés chez vous."
      footer={
        <>
          <p>Pas encore de compte ? <Link to="/inscription" className="text-primary font-semibold hover:underline">Créer un compte</Link></p>
          <p>Vous êtes vendeur ? <Link to="/inscription/vendeur" className="text-primary font-semibold hover:underline">Ouvrir une boutique</Link></p>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4" aria-busy={login.isPending}>
        {login.isError && Object.keys(serverErrors).length === 0 && <FormError error={login.error} />}

        <FormField
          label="Email"
          type="email"
          icon={Mail}
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          placeholder="votre@email.com"
          autoComplete="email"
          error={errors.email}
          required
        />
        <FormField
          label="Mot de passe"
          type="password"
          icon={Lock}
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          placeholder="••••••••"
          autoComplete="current-password"
          error={errors.password}
          required
        />

        <div className="flex items-center justify-end">
          <Link to="/mot-de-passe-oublie" className="text-sm text-primary font-medium hover:underline">Mot de passe oublié ?</Link>
        </div>

        <Button type="submit" size="lg" fullWidth loading={login.isPending} loadingLabel="Connexion..." data-testid="login-submit">
          Se connecter
        </Button>
      </form>
    </AuthShell>
  );
}

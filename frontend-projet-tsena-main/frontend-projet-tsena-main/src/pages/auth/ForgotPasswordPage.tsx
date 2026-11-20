import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MailCheck } from 'lucide-react';
import { useTitle } from '../../hooks';
import { useForgotPassword } from '../../hooks/mutations/useAuthMutations';
import AuthShell from '../../components/auth/AuthShell';
import { FormError, FormField } from '../../components/form';
import Button from '../../components/common/Button';
import { validateEmail } from '../../lib/validation';

export default function ForgotPasswordPage() {
  useTitle('Mot de passe oublié', { noindex: true });
  const forgotPassword = useForgotPassword();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const clientError = validateEmail(email);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (clientError || forgotPassword.isPending) return;
    forgotPassword.mutate(email.trim().toLowerCase());
  };

  return (
    <AuthShell
      title="Mot de passe oublié"
      subtitle="Indiquez votre e-mail : nous vous enverrons un lien de réinitialisation."
      panelTitle="Récupérez votre accès"
      panelText="Pas d'inquiétude, cela arrive. Saisissez l'adresse e-mail associée à votre compte et suivez le lien reçu."
      footer={<p><Link to="/connexion" className="text-primary font-semibold hover:underline">Retour à la connexion</Link></p>}
    >
      {forgotPassword.isSuccess ? (
        <div className="bg-surface border border-border rounded-2xl p-6 text-center" role="status">
          <div className="mx-auto w-14 h-14 rounded-full bg-success/10 text-success flex items-center justify-center mb-4"><MailCheck size={28} /></div>
          <h3 className="font-bold text-text mb-2">E-mail envoyé</h3>
          <p className="text-sm text-muted">
            Si un compte existe pour <span className="font-medium text-text">{email}</span>, un lien de réinitialisation vient d'être envoyé. Pensez à vérifier vos courriers indésirables.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-4" aria-busy={forgotPassword.isPending}>
          {forgotPassword.isError && <FormError error={forgotPassword.error} />}
          <FormField label="Email" type="email" icon={Mail} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.com" autoComplete="email" error={submitted ? clientError : undefined} required />
          <Button type="submit" size="lg" fullWidth loading={forgotPassword.isPending} loadingLabel="Envoi...">
            Envoyer le lien
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

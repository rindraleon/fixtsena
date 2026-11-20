import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, RotateCcw, MailWarning } from 'lucide-react';
import { useTitle } from '../../hooks';
import { useResendVerification, useVerifyEmail } from '../../hooks/mutations/useAuthMutations';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/common/Button';
import TsenaLogo from '../../components/layout/TsenaLogo';
import { getApiErrorMessage, normalizeApiError } from '../../lib/api-error';
import { getDashboardRoute } from '../../shared/data/permissions';

type Status = 'verifying' | 'success' | 'error' | 'expired' | 'already' | 'missing';

export default function VerifyEmailPage() {
  useTitle("Vérification de l'adresse e-mail");
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { user, isAuthenticated, refreshSession } = useAuth();
  const verifyEmail = useVerifyEmail();
  const resend = useResendVerification();
  const [status, setStatus] = useState<Status>(token ? 'verifying' : 'missing');
  const [errorMessage, setErrorMessage] = useState('');
  const startedRef = useRef(false);

  useEffect(() => {
    if (!token || startedRef.current) return;
    startedRef.current = true;
    verifyEmail.mutate(token, {
      onSuccess: () => {
        setStatus('success');
        if (isAuthenticated) void refreshSession();
      },
      onError: (error) => {
        const message = normalizeApiError(error).serverMessage?.toLowerCase() ?? '';
        if (message.includes('expir')) setStatus('expired');
        else if (message.includes('déjà')) setStatus('already');
        else {
          setStatus('error');
          setErrorMessage(getApiErrorMessage(error, 'Lien de vérification invalide.'));
        }
      },
    });
  }, [token, verifyEmail, isAuthenticated, refreshSession]);

  const continueHref = user ? getDashboardRoute(user.role) : '/connexion';

  return (
    <main id="main-content" className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md animate-fade-in-up">
        <div className="flex justify-center mb-6"><TsenaLogo size="md" /></div>
        <div className="bg-surface rounded-2xl border border-border p-8 text-center" role="status" aria-live="polite">
          {status === 'verifying' && (
            <>
              <Loader2 size={44} className="mx-auto text-primary animate-spin mb-4" />
              <h1 className="text-xl font-bold text-primary mb-2">Vérification en cours…</h1>
              <p className="text-muted text-sm">Merci de patienter quelques instants.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle size={48} className="mx-auto text-success mb-4" />
              <h1 className="text-xl font-bold text-primary mb-2">Adresse e-mail vérifiée !</h1>
              <p className="text-muted text-sm mb-6">Votre compte est maintenant pleinement actif.</p>
              <Link to={continueHref} className="block w-full bg-primary text-white py-2.5 rounded-lg font-semibold hover:bg-primary-dark transition-colors">
                {user ? 'Accéder à mon espace' : 'Se connecter'}
              </Link>
            </>
          )}

          {status === 'already' && (
            <>
              <CheckCircle size={48} className="mx-auto text-success mb-4" />
              <h1 className="text-xl font-bold text-primary mb-2">Adresse déjà vérifiée</h1>
              <p className="text-muted text-sm mb-6">Cette adresse e-mail a déjà été confirmée. Vous pouvez vous connecter normalement.</p>
              <Link to={continueHref} className="block w-full bg-primary text-white py-2.5 rounded-lg font-semibold hover:bg-primary-dark transition-colors">
                Continuer
              </Link>
            </>
          )}

          {(status === 'expired' || status === 'error' || status === 'missing') && (
            <>
              {status === 'expired' ? <MailWarning size={48} className="mx-auto text-amber-500 mb-4" /> : <XCircle size={48} className="mx-auto text-danger mb-4" />}
              <h1 className="text-xl font-bold text-primary mb-2">
                {status === 'expired' ? 'Lien expiré' : 'Lien de vérification invalide'}
              </h1>
              <p className="text-muted text-sm mb-6">
                {status === 'expired'
                  ? 'Ce lien de vérification a expiré. Demandez un nouveau lien pour finaliser la vérification.'
                  : status === 'missing'
                    ? 'Le lien est incomplet. Utilisez le bouton contenu dans l’e-mail que vous avez reçu.'
                    : errorMessage}
              </p>
              {isAuthenticated ? (
                <div className="space-y-3">
                  <Button fullWidth icon={RotateCcw} onClick={() => resend.mutate()} loading={resend.isPending} loadingLabel="Envoi..." disabled={resend.isSuccess}>
                    {resend.isSuccess ? 'E-mail renvoyé' : 'Renvoyer un e-mail de vérification'}
                  </Button>
                  <Link to={continueHref} className="block text-sm text-primary font-medium hover:underline">Retour à mon espace</Link>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted">Connectez-vous pour demander un nouveau lien de vérification.</p>
                  <Link to="/connexion" className="block w-full bg-primary text-white py-2.5 rounded-lg font-semibold hover:bg-primary-dark transition-colors">Se connecter</Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

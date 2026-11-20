import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, WifiOff, ShieldAlert, Lock, Bug, ServerCrash, RefreshCw, Home } from 'lucide-react';
import { ApiError, getApiErrorMessage, isTransportError, normalizeApiError, type ApiErrorKind } from '../../lib/api-error';
import { tokenStorage } from '../../lib/token-storage';

interface Props {
  readonly children: ReactNode;
  readonly fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: unknown;
}

export type BoundaryErrorKind = 'react' | 'network' | 'auth' | 'forbidden' | 'api' | 'business';

interface Presentation {
  readonly kind: BoundaryErrorKind;
  readonly title: string;
  readonly message: string;
  readonly icon: typeof AlertTriangle;
  readonly primaryAction: 'retry' | 'login' | 'home';
}

const API_KINDS: ReadonlySet<ApiErrorKind> = new Set(['not_found', 'rate_limit', 'server', 'unknown']);

export function classifyBoundaryError(error: unknown): Presentation {
  const isApiLike = error instanceof ApiError || isTransportError(error);
  if (!isApiLike) {
    return {
      kind: 'react',
      title: "Une erreur inattendue s'est produite",
      message: "L'affichage de cette page a échoué. Rechargez la page ; si le problème persiste, contactez le support.",
      icon: Bug,
      primaryAction: 'retry',
    };
  }
  const apiError = normalizeApiError(error);
  const message = getApiErrorMessage(apiError);
  switch (apiError.kind) {
    case 'network':
    case 'timeout':
    case 'canceled':
      return { kind: 'network', title: 'Serveur injoignable', message, icon: WifiOff, primaryAction: 'retry' };
    case 'auth':
      return { kind: 'auth', title: 'Session expirée', message, icon: Lock, primaryAction: 'login' };
    case 'forbidden':
      return { kind: 'forbidden', title: 'Accès refusé', message, icon: ShieldAlert, primaryAction: 'home' };
    case 'business':
    case 'conflict':
    case 'validation':
      return { kind: 'business', title: 'Action impossible', message, icon: AlertTriangle, primaryAction: 'home' };
    default:
      return {
        kind: 'api',
        title: API_KINDS.has(apiError.kind) ? 'Le service a rencontré un problème' : 'Erreur',
        message,
        icon: ServerCrash,
        primaryAction: 'retry',
      };
  }
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    const presentation = classifyBoundaryError(error);
    console.error(`[ErrorBoundary] ${presentation.kind}`, error, errorInfo.componentStack);
  }

  private reset = () => this.setState({ hasError: false, error: null });

  private retry = () => {
    this.reset();
    window.location.reload();
  };

  private goHome = () => {
    this.reset();
    window.location.hash = '/';
  };

  private goLogin = () => {
    tokenStorage.clear();
    this.reset();
    window.location.hash = '/connexion';
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    const presentation = classifyBoundaryError(this.state.error);
    const Icon = presentation.icon;
    const primary = presentation.primaryAction === 'retry'
      ? { label: 'Réessayer', icon: RefreshCw, onClick: this.retry }
      : presentation.primaryAction === 'login'
        ? { label: 'Se reconnecter', icon: Lock, onClick: this.goLogin }
        : { label: "Retour à l'accueil", icon: Home, onClick: this.goHome };

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="bg-surface rounded-xl border border-border p-8 max-w-md w-full text-center" role="alert" data-testid="error-boundary" data-error-kind={presentation.kind}>
          <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-red-50 dark:bg-red-500/10 text-danger flex items-center justify-center"><Icon size={28} /></div>
          <h1 className="text-xl font-bold text-text mb-2">{presentation.title}</h1>
          <p className="text-muted text-sm mb-6">{presentation.message}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button type="button" onClick={primary.onClick} className="inline-flex items-center justify-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-primary-dark transition-colors">
              <primary.icon size={16} /> {primary.label}
            </button>
            {presentation.primaryAction !== 'home' && (
              <button type="button" onClick={this.goHome} className="inline-flex items-center justify-center gap-2 border border-border text-text px-5 py-2.5 rounded-lg font-semibold hover:bg-surface-hover transition-colors">
                <Home size={16} /> Accueil
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}

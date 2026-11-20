import { AlertTriangle, Lock, RefreshCw, SearchX, WifiOff } from 'lucide-react';
import clsx from 'clsx';
import Button from './Button';
import { normalizeApiError } from '../../lib/api-error';

interface ErrorStateProps {
  readonly error?: unknown;
  readonly title?: string;
  readonly message?: string;
  readonly onRetry?: () => void;
  readonly retryLabel?: string;
  readonly retrying?: boolean;
  readonly compact?: boolean;
  readonly className?: string;
}

export default function ErrorState({
  error,
  title,
  message,
  onRetry,
  retryLabel = 'Réessayer',
  retrying = false,
  compact = false,
  className,
}: ErrorStateProps) {
  const normalized = error ? normalizeApiError(error) : null;
  const kind = normalized?.kind ?? 'unknown';

  const Icon =
    kind === 'network' || kind === 'timeout'
      ? WifiOff
      : kind === 'forbidden' || kind === 'auth'
        ? Lock
        : kind === 'not_found'
          ? SearchX
          : AlertTriangle;

  const resolvedTitle =
    title ??
    (kind === 'network' || kind === 'timeout'
      ? 'Connexion impossible'
      : kind === 'forbidden'
        ? 'Accès refusé'
        : kind === 'not_found'
          ? 'Introuvable'
          : kind === 'server'
            ? 'Serveur indisponible'
            : 'Une erreur est survenue');

  const resolvedMessage = message ?? normalized?.message ?? 'Impossible de charger les données.';

  return (
    <div
      role="alert"
      className={clsx(
        'rounded-2xl border border-red-200 bg-red-50/60 dark:border-red-500/20 dark:bg-red-950/30 text-center',
        compact ? 'p-5' : 'p-8 sm:p-10',
        className,
      )}
    >
      <div className={clsx('mx-auto rounded-full bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center', compact ? 'w-10 h-10 mb-3' : 'w-14 h-14 mb-4')}>
        <Icon size={compact ? 20 : 26} aria-hidden="true" />
      </div>
      <h3 className={clsx('font-bold text-text', compact ? 'text-base' : 'text-lg')}>{resolvedTitle}</h3>
      <p className="text-sm text-muted mt-1.5 max-w-md mx-auto leading-relaxed">{resolvedMessage}</p>
      {onRetry && (
        <Button variant="outline" size="sm" icon={RefreshCw} onClick={onRetry} loading={retrying} loadingLabel="Nouvelle tentative..." className="mt-4">
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

import clsx from 'clsx';

interface AppLoaderProps {
  readonly label?: string;
  /** Occupe tout l'écran (amorçage de l'application) plutôt que la zone de contenu. */
  readonly fullscreen?: boolean;
  readonly className?: string;
}

/**
 * Indicateur de chargement unique (amorçage, session, routes différées), animé par `.tsena-spinner`.
 */
export default function AppLoader({
  label = 'Chargement…',
  fullscreen = false,
  className,
}: AppLoaderProps) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center gap-4 bg-background',
        fullscreen ? 'min-h-svh w-full' : 'min-h-[60vh] w-full flex-1',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="app-loader"
    >
      <span
        className="tsena-spinner block h-11 w-11 rounded-full border-[3px] border-primary/15 border-r-primary-lighter border-t-primary"
        aria-hidden="true"
      />
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
    </div>
  );
}

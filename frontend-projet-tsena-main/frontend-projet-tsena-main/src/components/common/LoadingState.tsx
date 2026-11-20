import clsx from 'clsx';
import { Spinner } from './Button';
import Skeleton, { ProductCardSkeleton, StatCardSkeleton, TableSkeleton } from './Skeleton';

interface LoadingStateProps {
  readonly label?: string;
  readonly variant?: 'spinner' | 'page' | 'inline' | 'table' | 'cards' | 'detail' | 'stats' | 'list';
  readonly count?: number;
  readonly className?: string;
}

export default function LoadingState({ label = 'Chargement...', variant = 'spinner', count, className }: LoadingStateProps) {
  if (variant === 'table') {
    return (
      <div className={className} role="status" aria-live="polite" aria-busy="true">
        <TableSkeleton rows={count ?? 5} />
        <span className="sr-only">{label}</span>
      </div>
    );
  }

  if (variant === 'cards') {
    return (
      <div
        className={clsx('grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6', className)}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        {Array.from({ length: count ?? 8 }, (_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
        <span className="sr-only">{label}</span>
      </div>
    );
  }

  if (variant === 'stats') {
    return (
      <div className={clsx('grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4', className)} role="status" aria-busy="true">
        {Array.from({ length: count ?? 4 }, (_, i) => (
          <StatCardSkeleton key={i} />
        ))}
        <span className="sr-only">{label}</span>
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className={clsx('space-y-3', className)} role="status" aria-busy="true">
        {Array.from({ length: count ?? 4 }, (_, i) => (
          <div key={i} className="bg-surface rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton circle width="40px" height="40px" />
              <div className="flex-1 space-y-2">
                <Skeleton height="14px" width="40%" />
                <Skeleton height="12px" width="25%" />
              </div>
            </div>
            <Skeleton height="12px" width="90%" />
            <Skeleton height="12px" width="70%" />
          </div>
        ))}
        <span className="sr-only">{label}</span>
      </div>
    );
  }

  if (variant === 'detail') {
    return (
      <div className={clsx('grid grid-cols-1 lg:grid-cols-2 gap-8', className)} role="status" aria-busy="true">
        <Skeleton height="420px" rounded="lg" />
        <div className="space-y-4">
          <Skeleton height="28px" width="70%" />
          <Skeleton height="16px" width="40%" />
          <Skeleton height="36px" width="50%" />
          <Skeleton height="80px" />
          <Skeleton height="48px" width="60%" rounded="lg" />
        </div>
        <span className="sr-only">{label}</span>
      </div>
    );
  }

  if (variant === 'page') {
    return (
      <div className={clsx('min-h-[60vh] flex items-center justify-center', className)} role="status" aria-live="polite">
        <div className="text-center">
          <Spinner className="h-8 w-8 text-primary mx-auto mb-3" />
          <p className="text-sm text-muted">{label}</p>
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <span className={clsx('inline-flex items-center gap-2 text-sm text-muted', className)} role="status">
        <Spinner className="text-primary" />
        {label}
      </span>
    );
  }

  return (
    <div className={clsx('flex items-center justify-center py-12', className)} role="status" aria-live="polite">
      <div className="text-center">
        <Spinner className="h-7 w-7 text-primary mx-auto mb-2" />
        <p className="text-sm text-muted">{label}</p>
      </div>
    </div>
  );
}

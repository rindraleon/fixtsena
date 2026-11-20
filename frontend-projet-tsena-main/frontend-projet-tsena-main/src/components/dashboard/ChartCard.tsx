import type { ReactNode } from 'react';
import { ResponsiveContainer } from 'recharts';
import { LoadingState, ErrorState, EmptyState } from '../common';

interface ChartCardProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly isLoading?: boolean;
  readonly error?: unknown;
  readonly onRetry?: () => void;
  readonly isEmpty?: boolean;
  readonly emptyLabel?: string;
  readonly height?: number;
  readonly children: ReactNode;
}

export default function ChartCard({ title, subtitle, isLoading, error, onRetry, isEmpty, emptyLabel = 'Pas encore de données à afficher.', height = 240, children }: ChartCardProps) {
  return (
    <section className="bg-surface rounded-xl border border-border p-5" aria-label={title}>
      <div className="mb-4">
        <h3 className="font-semibold text-text">{title}</h3>
        {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
      </div>
      <div style={{ height }}>
        {isLoading ? (
          <LoadingState variant="inline" label="Chargement des données..." className="h-full" />
        ) : error ? (
          <ErrorState error={error} onRetry={onRetry} compact />
        ) : isEmpty ? (
          <EmptyState compact title={emptyLabel} />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {children as React.ReactElement}
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

import { type ReactNode } from 'react';
import { type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import LoadingState from './LoadingState';
import ErrorState from './ErrorState';
import EmptyState from './EmptyState';
import Pagination from './Pagination';

export interface DataTableColumn<T> {
  readonly header: string;
  readonly cell: (row: T) => ReactNode;
  readonly className?: string;
  readonly mobile?: boolean;
  readonly primary?: boolean;
}

export interface DataTablePagination {
  readonly page: number;
  readonly totalPages: number;
  readonly total: number;
  readonly onPageChange: (page: number) => void;
}

interface DataTableProps<T extends { id: string }> {
  readonly data: readonly T[];
  readonly columns: readonly DataTableColumn<T>[];
  readonly isLoading?: boolean;
  readonly isFetching?: boolean;
  readonly error?: unknown;
  readonly onRetry?: () => void;
  readonly pagination?: DataTablePagination;
  readonly actions?: (row: T) => ReactNode;
  readonly onRowClick?: (row: T) => void;
  readonly rowClassName?: (row: T) => string | undefined;
  readonly toolbar?: ReactNode;
  readonly emptyTitle?: string;
  readonly emptyDescription?: string;
  readonly emptyIcon?: LucideIcon;
  readonly emptyAction?: { label: string; to?: string; onClick?: () => void; icon?: LucideIcon };
  readonly className?: string;
  readonly 'data-testid'?: string;
}

export default function DataTable<T extends { id: string }>({
  data,
  columns,
  isLoading = false,
  isFetching = false,
  error,
  onRetry,
  pagination,
  actions,
  onRowClick,
  rowClassName,
  toolbar,
  emptyTitle = 'Aucun résultat',
  emptyDescription,
  emptyIcon,
  emptyAction,
  className,
  'data-testid': testId,
}: DataTableProps<T>) {
  const mobileColumns = columns.filter((column) => column.mobile || column.primary);
  const primaryColumn = columns.find((column) => column.primary) ?? columns[0];

  let body: ReactNode;
  if (isLoading) {
    body = <LoadingState variant="table" count={6} />;
  } else if (error) {
    body = <ErrorState error={error} onRetry={onRetry} retrying={isFetching} />;
  } else if (data.length === 0) {
    body = <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} action={emptyAction} compact />;
  } else {
    body = (
      <div className={cn('transition-opacity', isFetching && 'opacity-60 pointer-events-none')} aria-busy={isFetching || undefined}>
        <div className="hidden md:block bg-surface rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-secondary border-b border-border">
                <tr>
                  {columns.map((column) => (
                    <th key={column.header} scope="col" className={cn('px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap', column.className)}>
                      {column.header}
                    </th>
                  ))}
                  {actions && <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wider">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((row) => (
                  <tr
                    key={row.id}
                    className={cn('transition-colors', onRowClick && 'cursor-pointer hover:bg-surface-secondary/60', rowClassName?.(row))}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    onKeyDown={onRowClick ? (event) => { if (event.key === 'Enter') onRowClick(row); } : undefined}
                  >
                    {columns.map((column) => (
                      <td key={column.header} className={cn('px-4 py-3 text-sm text-text align-middle', column.className)}>
                        {column.cell(row)}
                      </td>
                    ))}
                    {actions && (
                      <td className="px-4 py-3 text-right align-middle" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">{actions(row)}</div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <ul className="md:hidden space-y-3" aria-label="Liste">
          {data.map((row) => (
            <li
              key={row.id}
              className={cn('bg-surface rounded-xl border border-border p-4 transition-shadow', onRowClick && 'cursor-pointer active:bg-surface-secondary', rowClassName?.(row))}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {primaryColumn && <div className="font-semibold text-sm text-text mb-2">{primaryColumn.cell(row)}</div>}
              <dl className="space-y-1.5">
                {mobileColumns
                  .filter((column) => column !== primaryColumn)
                  .map((column) => (
                    <div key={column.header} className="flex items-center justify-between gap-3 text-xs">
                      <dt className="text-muted shrink-0">{column.header}</dt>
                      <dd className="text-text font-medium text-right min-w-0">{column.cell(row)}</dd>
                    </div>
                  ))}
              </dl>
              {actions && (
                <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-border" onClick={(event) => event.stopPropagation()}>
                  {actions(row)}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <section className={cn('space-y-4', className)} data-testid={testId}>
      {toolbar && <div className="bg-surface rounded-xl border border-border p-3 flex flex-col sm:flex-row sm:items-center gap-3">{toolbar}</div>}
      {body}
      {pagination && !isLoading && !error && data.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted">
            {pagination.total} résultat{pagination.total > 1 ? 's' : ''} · page {pagination.page} sur {Math.max(1, pagination.totalPages)}
          </p>
          <Pagination currentPage={pagination.page} totalPages={pagination.totalPages} onPageChange={pagination.onPageChange} />
        </div>
      )}
    </section>
  );
}

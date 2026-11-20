import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, type LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import Button from './Button';

interface EmptyStateAction {
  readonly label: string;
  readonly to?: string;
  readonly onClick?: () => void;
  readonly icon?: LucideIcon;
  readonly variant?: 'primary' | 'outline' | 'secondary';
}

interface EmptyStateProps {
  readonly icon?: LucideIcon;
  readonly title: string;
  readonly description?: ReactNode;
  readonly action?: EmptyStateAction;
  readonly secondaryAction?: EmptyStateAction;
  readonly compact?: boolean;
  readonly className?: string;
  readonly titleAs?: 'h1' | 'h2' | 'h3';
}

function ActionButton({ action, fallbackVariant }: { action: EmptyStateAction; fallbackVariant: 'primary' | 'outline' }) {
  const variant = action.variant ?? fallbackVariant;
  if (action.to) {
    return (
      <Link to={action.to} className="inline-flex">
        <Button variant={variant} icon={action.icon} tabIndex={-1}>
          {action.label}
        </Button>
      </Link>
    );
  }
  return (
    <Button variant={variant} icon={action.icon} onClick={action.onClick}>
      {action.label}
    </Button>
  );
}

export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  secondaryAction,
  compact = false,
  className,
  titleAs: TitleTag = 'h3',
}: EmptyStateProps) {
  return (
    <div
      className={clsx(
        'rounded-2xl border border-dashed border-border bg-surface text-center',
        compact ? 'p-6' : 'p-10 sm:p-14',
        className,
      )}
    >
      <div className={clsx('mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center', compact ? 'w-12 h-12 mb-3' : 'w-16 h-16 mb-4')}>
        <Icon size={compact ? 22 : 28} aria-hidden="true" />
      </div>
      <TitleTag className={clsx('font-bold text-text', compact ? 'text-base' : 'text-lg')}>{title}</TitleTag>
      {description && <p className="text-sm text-muted mt-1.5 max-w-md mx-auto leading-relaxed">{description}</p>}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-5">
          {action && <ActionButton action={action} fallbackVariant="primary" />}
          {secondaryAction && <ActionButton action={secondaryAction} fallbackVariant="outline" />}
        </div>
      )}
    </div>
  );
}

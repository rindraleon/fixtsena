import { forwardRef } from 'react';
import { type LucideIcon } from 'lucide-react';
import clsx from 'clsx';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly icon?: LucideIcon;
  readonly iconPosition?: 'left' | 'right';
  readonly children: React.ReactNode;
  readonly loading?: boolean;
  readonly loadingLabel?: string;
  readonly fullWidth?: boolean;
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-dark focus-visible:ring-primary-light shadow-sm hover:shadow-md',
  secondary: 'bg-accent text-primary hover:bg-accent-light focus-visible:ring-accent shadow-sm',
  outline: 'border-2 border-primary text-primary hover:bg-primary hover:text-white focus-visible:ring-primary-light',
  ghost: 'text-primary hover:bg-primary/10 focus-visible:ring-primary-light',
  danger: 'bg-danger text-white hover:bg-red-700 focus-visible:ring-red-400 shadow-sm',
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-5 py-2.5 text-sm gap-2',
  lg: 'px-8 py-3.5 text-base gap-2.5',
};

export function Spinner({ className }: { readonly className?: string }) {
  return (
    <svg className={clsx('animate-spin h-4 w-4', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      icon: Icon,
      iconPosition = 'left',
      children,
      loading = false,
      loadingLabel,
      fullWidth,
      className,
      disabled,
      type = 'button',
      onClick,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        className={clsx(
          'inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-200',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed',
          'cursor-pointer active:scale-[0.98]',
          buttonVariants[variant],
          buttonSizes[size],
          fullWidth && 'w-full',
          className,
        )}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        aria-disabled={disabled || loading || undefined}
        onClick={(event) => {
          if (loading || disabled) {
            event.preventDefault();
            return;
          }
          onClick?.(event);
        }}
        {...props}
      >
        {loading ? <Spinner /> : Icon && iconPosition === 'left' ? <Icon size={18} aria-hidden="true" /> : null}
        {loading && loadingLabel ? loadingLabel : children}
        {!loading && Icon && iconPosition === 'right' ? <Icon size={18} aria-hidden="true" /> : null}
      </button>
    );
  },
);

Button.displayName = 'Button';

export default Button;

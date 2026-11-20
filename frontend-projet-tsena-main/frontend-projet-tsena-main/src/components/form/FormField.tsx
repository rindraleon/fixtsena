import { useId, useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react';
import { Eye, EyeOff, type LucideIcon } from 'lucide-react';
import clsx from 'clsx';

interface BaseProps {
  readonly label: string;
  readonly error?: string;
  readonly hint?: ReactNode;
  readonly icon?: LucideIcon;
  readonly required?: boolean;
  readonly className?: string;
}

type InputProps = BaseProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'required'> & { readonly as?: 'input' };
type TextareaProps = BaseProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className' | 'required'> & { readonly as: 'textarea' };
type SelectProps = BaseProps & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'required'> & { readonly as: 'select'; readonly children: ReactNode };

export type FormFieldProps = InputProps | TextareaProps | SelectProps;

export const inputClassName = (hasError: boolean, withIcon = false, extra?: string) =>
  clsx(
    'w-full py-2.5 pr-4 border rounded-lg text-sm bg-input-bg text-text placeholder:text-muted/70 transition-colors',
    'focus:outline-none focus:ring-2 disabled:opacity-60 disabled:cursor-not-allowed',
    withIcon ? 'pl-10' : 'pl-3.5',
    hasError ? 'border-danger focus:border-danger focus:ring-danger/20' : 'border-input-border focus:border-primary focus:ring-primary/20',
    extra,
  );

export default function FormField(props: FormFieldProps) {
  const { label, error, hint, icon: Icon, required, className } = props;
  const generatedId = useId();
  const id = props.id ?? generatedId;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const [showPassword, setShowPassword] = useState(false);
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;

  let control: ReactNode;
  if (props.as === 'textarea') {
    const { as: _as, label: _l, error: _e, hint: _h, icon: _i, required: _r, className: _c, ...rest } = props;
    control = <textarea id={id} aria-invalid={!!error} aria-describedby={describedBy} required={required} className={inputClassName(!!error, false, 'min-h-[96px]')} {...rest} />;
  } else if (props.as === 'select') {
    const { as: _as, label: _l, error: _e, hint: _h, icon: _i, required: _r, className: _c, children, ...rest } = props;
    control = (
      <select id={id} aria-invalid={!!error} aria-describedby={describedBy} required={required} className={inputClassName(!!error, !!Icon)} {...rest}>
        {children}
      </select>
    );
  } else {
    const { as: _as, label: _l, error: _e, hint: _h, icon: _i, required: _r, className: _c, type, ...rest } = props;
    const isPassword = type === 'password';
    control = (
      <>
        <input
          id={id}
          type={isPassword && showPassword ? 'text' : type}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          required={required}
          className={inputClassName(!!error, !!Icon, isPassword ? 'pr-10' : undefined)}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text"
            aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </>
    );
  }

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-text mb-1.5">
        {label} {required && <span className="text-danger" aria-hidden="true">*</span>}
      </label>
      <div className="relative">
        {Icon && <Icon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden="true" />}
        {control}
      </div>
      {error ? (
        <p id={errorId} className="text-xs text-danger mt-1" role="alert">{error}</p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-muted mt-1">{hint}</p>
      ) : null}
    </div>
  );
}

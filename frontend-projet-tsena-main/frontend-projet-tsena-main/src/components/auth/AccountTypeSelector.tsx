import {
  Check,
  Lock,
  ShieldCheck,
  Store,
  User,
  type LucideIcon,
} from 'lucide-react';

import type {
  RegisterOptions,
  RegistrationAccountType,
} from '../../types/api';

interface AccountTypeSelectorProps {
  readonly value: RegistrationAccountType;
  readonly onChange: (value: RegistrationAccountType) => void;
  readonly options?: RegisterOptions;
  readonly optionsError?: boolean;
  readonly optionsErrorMessage?: string;
  readonly onRetryOptions?: () => void;
  readonly error?: string;
  readonly disabled?: boolean;
}

interface Choice {
  readonly type: RegistrationAccountType;
  readonly label: string;
  readonly icon: LucideIcon;
}

const CHOICES: readonly Choice[] = [
  {
    type: 'client',
    label: 'Client',
    icon: User,
  },
  {
    type: 'seller',
    label: 'Vendeur',
    icon: Store,
  },
  {
    type: 'admin',
    label: 'Administrateur',
    icon: ShieldCheck,
  },
];

const ADMIN_CHOICE_COPY = {
  open: {
    badge: 'Premier compte',
    note: "Aucun administrateur n'existe encore.",
  },
  closed: {
    badge: 'Réservé',
    note: "Un administrateur existe déjà.",
  },
  loading: {
    badge: 'Vérification…',
    note: 'Vérification en cours…',
  },
  unknown: {
    badge: 'Indisponible',
    note: "Impossible de vérifier la disponibilité.",
  },
} as const;

type AdminState = keyof typeof ADMIN_CHOICE_COPY;

function resolveAdminState(
  options: RegisterOptions | undefined,
  optionsError: boolean | undefined,
): AdminState {
  if (options) {
    return options.adminRegistrationOpen === true ? 'open' : 'closed';
  }

  return optionsError ? 'unknown' : 'loading';
}

export default function AccountTypeSelector({
  value,
  onChange,
  options,
  optionsError,
  optionsErrorMessage,
  onRetryOptions,
  error,
  disabled,
}: AccountTypeSelectorProps) {
  const adminState = resolveAdminState(options, optionsError);
  const adminOpen = adminState === 'open';

  return (
    <fieldset
      className="space-y-3"
      disabled={disabled}
      data-testid="account-type-selector"
    >
      <legend className="text-sm font-medium text-text">
        Type de compte{' '}
        <span className="text-danger" aria-hidden="true">
          *
        </span>
      </legend>

      <div
        role="radiogroup"
        aria-label="Type de compte"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'account-type-error' : undefined}
        className="grid grid-cols-3 gap-2"
      >
        {CHOICES.map(({ type, label, icon: Icon }) => {
          const isAdmin = type === 'admin';
          const locked = isAdmin && !adminOpen;
          const selected = value === type;

          return (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-disabled={locked || undefined}
              disabled={disabled || locked}
              onClick={() => onChange(type)}
              title={
                locked
                  ? options?.adminRegistrationReason ??
                    ADMIN_CHOICE_COPY[adminState].note
                  : label
              }
              data-testid={`account-type-${type}`}
              data-locked={locked ? 'true' : undefined}
              className={[
                'group relative flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border px-3 py-3 transition-all duration-200',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                selected
                  ? 'border-primary bg-primary/10 text-primary shadow-sm'
                  : 'border-border bg-surface text-text hover:border-primary/40 hover:bg-primary/5',
                locked
                  ? 'cursor-not-allowed border-dashed bg-surface-hover/60 opacity-50 grayscale'
                  : 'cursor-pointer',
              ].join(' ')}
            >
              <span
                className={[
                  'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
                  selected
                    ? 'bg-primary text-white'
                    : 'bg-primary/10 text-primary group-hover:bg-primary/15',
                ].join(' ')}
              >
                <Icon size={18} aria-hidden="true" />
              </span>

              <span className="text-sm font-semibold">{label}</span>

              {selected && (
                <span
                  className="absolute right-2 top-2"
                  aria-hidden="true"
                >
                  <Check size={15} className="text-primary" />
                </span>
              )}

              {locked && (
                <span
                  className="absolute right-2 top-2"
                  aria-hidden="true"
                >
                  <Lock size={14} className="text-muted" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {optionsError && !options && (
        <p
          className="flex flex-wrap items-center gap-2 text-xs text-muted"
          data-testid="account-type-options-error"
        >
          <span>
            {optionsErrorMessage
              ? `Options d'inscription indisponibles : ${optionsErrorMessage}`
              : "Les options d'inscription n'ont pas pu être vérifiées auprès du serveur."}
          </span>

          {onRetryOptions && (
            <button
              type="button"
              onClick={onRetryOptions}
              className="font-semibold text-primary hover:underline"
            >
              Réessayer
            </button>
          )}
        </p>
      )}

      {error && (
        <p
          id="account-type-error"
          role="alert"
          className="text-sm text-danger"
        >
          {error}
        </p>
      )}
    </fieldset>
  );
}
import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, ShieldCheck, Trash2, X, type LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import Button from './Button';

export type ConfirmDialogVariant = 'default' | 'destructive' | 'warning';

interface ConfirmDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly description?: ReactNode;
  readonly confirmLabel?: string;
  readonly loadingLabel?: string;
  readonly cancelLabel?: string;
  readonly variant?: ConfirmDialogVariant;
  readonly loading?: boolean;
  readonly children?: ReactNode;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

const VARIANT_STYLES: Record<ConfirmDialogVariant, { icon: LucideIcon; iconClass: string; button: 'primary' | 'danger' }> = {
  default: { icon: ShieldCheck, iconClass: 'bg-primary/10 text-primary', button: 'primary' },
  destructive: { icon: Trash2, iconClass: 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400', button: 'danger' },
  warning: { icon: LogOut, iconClass: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400', button: 'primary' },
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmer',
  loadingLabel,
  cancelLabel = 'Annuler',
  variant = 'default',
  loading = false,
  children,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const loadingRef = useRef(loading);
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => cancelRef.current?.focus(), 30);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loadingRef.current) onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  const styles = VARIANT_STYLES[variant];
  const Icon = styles.icon;

  const handleCancel = () => {
    if (!loading) onCancel();
  };

  const handleConfirm = () => {
    if (!loading) onConfirm();
  };

  return (
    <AnimatePresence>
      {open && (
        <div key="confirm-dialog" className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation">
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={handleCancel}
            aria-hidden="true"
          />

          <motion.div
            className="relative bg-surface rounded-2xl shadow-2xl border border-border max-w-md w-full p-6"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby={description ? 'confirm-dialog-description' : undefined}
            aria-busy={loading || undefined}
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-surface-tertiary text-muted transition-colors disabled:opacity-40"
              aria-label="Fermer"
            >
              <X size={18} />
            </button>

            <div className="flex items-start gap-4">
              <div className={clsx('w-11 h-11 rounded-full flex items-center justify-center shrink-0', styles.iconClass)}>
                <Icon size={20} aria-hidden="true" />
              </div>
              <div className="min-w-0 pr-6">
                <h2 id="confirm-dialog-title" className="text-lg font-bold text-text leading-snug">
                  {title}
                </h2>
                {description && (
                  <p id="confirm-dialog-description" className="text-sm text-muted mt-1.5 leading-relaxed">
                    {description}
                  </p>
                )}
                {children}
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-6">
              <Button ref={cancelRef} variant="outline" onClick={handleCancel} disabled={loading} data-testid="confirm-dialog-cancel">
                {cancelLabel}
              </Button>
              <Button
                variant={styles.button}
                onClick={handleConfirm}
                loading={loading}
                loadingLabel={loadingLabel ?? (variant === 'destructive' ? 'Suppression...' : undefined)}
                data-testid="confirm-dialog-confirm"
              >
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

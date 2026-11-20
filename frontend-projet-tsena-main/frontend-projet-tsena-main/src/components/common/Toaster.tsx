import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import clsx from 'clsx';
import { subscribe, dismiss, type ToastItem, type ToastType } from '../../lib/toast';

const ICONS: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const STYLES: Record<ToastType, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/80 dark:text-emerald-100',
  error: 'border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-950/80 dark:text-red-100',
  info: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-500/30 dark:bg-sky-950/80 dark:text-sky-100',
  warning: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/80 dark:text-amber-100',
};

const ICON_STYLES: Record<ToastType, string> = {
  success: 'text-emerald-600 dark:text-emerald-400',
  error: 'text-red-600 dark:text-red-400',
  info: 'text-sky-600 dark:text-sky-400',
  warning: 'text-amber-600 dark:text-amber-400',
};

export default function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => subscribe(setToasts), []);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-4 z-[200] flex flex-col items-center gap-2 px-4 sm:items-end sm:right-4 sm:inset-x-auto"
      aria-live="polite"
      aria-atomic="false"
      role="region"
      aria-label="Notifications"
    >
      <AnimatePresence initial={false}>
        {toasts.map((item) => {
          const Icon = ICONS[item.type];
          return (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              role={item.type === 'error' ? 'alert' : 'status'}
              data-testid={`toast-${item.type}`}
              className={clsx(
                'pointer-events-auto w-full sm:w-auto sm:min-w-[320px] sm:max-w-md rounded-xl border shadow-lg backdrop-blur px-4 py-3 flex items-start gap-3',
                STYLES[item.type],
              )}
            >
              <Icon size={20} className={clsx('mt-0.5 shrink-0', ICON_STYLES[item.type])} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug">{item.message}</p>
                {item.description && <p className="text-xs mt-0.5 opacity-80 leading-relaxed">{item.description}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="shrink-0 p-1 rounded-md opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition"
                aria-label="Fermer la notification"
              >
                <X size={16} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

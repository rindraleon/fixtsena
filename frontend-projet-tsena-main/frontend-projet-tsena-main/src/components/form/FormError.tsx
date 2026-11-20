import { AlertCircle } from 'lucide-react';
import { getApiErrorMessage, getFieldErrors } from '../../lib/api-error';

interface FormErrorProps {
  readonly error?: unknown;
  readonly message?: string;
  readonly handledFields?: readonly string[];
}

export default function FormError({ error, message, handledFields = [] }: FormErrorProps) {
  if (!error && !message) return null;
  const fieldErrors = error ? getFieldErrors(error) : {};
  const remaining = Object.entries(fieldErrors).filter(([field]) => !handledFields.includes(field));
  const text = message ?? getApiErrorMessage(error);

  return (
    <div role="alert" className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-danger text-sm px-4 py-3 rounded-lg flex gap-2">
      <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
      <div>
        <p className="font-medium">{text}</p>
        {remaining.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-xs">
            {remaining.map(([field, msg]) => <li key={field}>• {msg}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}

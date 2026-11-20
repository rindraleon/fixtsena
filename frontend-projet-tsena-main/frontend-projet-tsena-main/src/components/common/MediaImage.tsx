import { useState, type ImgHTMLAttributes, type ReactNode } from 'react';
import { ImageOff } from 'lucide-react';
import { clsx } from 'clsx';
import { resolveMediaUrl } from '../../lib/media';

interface MediaImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> {
  readonly src: string | null | undefined;
  readonly fallback?: ReactNode;
  readonly fallbackClassName?: string;
  readonly fallbackLabel?: string;
}

export default function MediaImage({ src, alt = '', fallback, fallbackClassName, fallbackLabel, className, loading = 'lazy', decoding = 'async', ...rest }: MediaImageProps) {
  const resolved = resolveMediaUrl(src);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!resolved || failedSrc === resolved) {
    return (
      <div
        className={clsx('w-full h-full flex flex-col items-center justify-center gap-1 text-muted bg-surface-secondary', fallbackClassName ?? className)}
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        data-testid="media-image-fallback"
      >
        {fallback ?? (
          <>
            <ImageOff size={22} aria-hidden="true" />
            {fallbackLabel && <span className="text-[11px]">{fallbackLabel}</span>}
          </>
        )}
      </div>
    );
  }

  return (
    <img
      src={resolved}
      alt={alt}
      className={className}
      loading={loading}
      decoding={decoding}
      onError={() => setFailedSrc(resolved)}
      {...rest}
    />
  );
}

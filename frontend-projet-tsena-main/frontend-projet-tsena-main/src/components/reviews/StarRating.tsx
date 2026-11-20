import { useState } from 'react';
import { Star } from 'lucide-react';
import clsx from 'clsx';

interface StarRatingProps {
  readonly value: number;
  readonly onChange?: (value: number) => void;
  readonly size?: number;
  readonly label?: string;
  readonly className?: string;
}

const RATING_LABELS: Record<number, string> = { 1: 'Très décevant', 2: 'Décevant', 3: 'Correct', 4: 'Bien', 5: 'Excellent' };

export default function StarRating({ value, onChange, size = 20, label = 'Note', className }: StarRatingProps) {
  const [hovered, setHovered] = useState(0);
  const interactive = !!onChange;
  const shown = hovered || value;

  return (
    <div className={clsx('inline-flex items-center gap-1', className)} role={interactive ? 'radiogroup' : 'img'} aria-label={interactive ? label : `${label} : ${value} sur 5`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= shown;
        const starEl = <Star size={size} className={clsx('transition-colors', filled ? 'text-amber-400' : 'text-border')} fill={filled ? 'currentColor' : 'none'} />;
        if (!interactive) return <span key={star}>{starEl}</span>;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} étoile${star > 1 ? 's' : ''} — ${RATING_LABELS[star]}`}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onFocus={() => setHovered(star)}
            onBlur={() => setHovered(0)}
            className="p-0.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 hover:scale-110 transition-transform"
          >
            {starEl}
          </button>
        );
      })}
      {interactive && <span className="ml-2 text-xs text-muted min-w-[6rem]">{shown ? RATING_LABELS[shown] : 'Choisissez une note'}</span>}
    </div>
  );
}

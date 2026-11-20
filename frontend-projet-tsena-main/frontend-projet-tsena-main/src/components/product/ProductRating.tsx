import { Star, StarHalf } from 'lucide-react';
import clsx from 'clsx';

interface ProductRatingProps {
  readonly rating: number | string;
  readonly reviews?: number;
  readonly size?: number;
  readonly className?: string;
}

export default function ProductRating({ rating, reviews, size = 14, className }: ProductRatingProps) {
  const value = Math.max(0, Math.min(5, Number(rating) || 0));
  const fullStars = Math.floor(value);
  const hasHalf = value - fullStars >= 0.5;

  return (
    <div className={clsx('flex items-center gap-1', className)}>
      <div className="flex items-center" role="img" aria-label={`Note : ${value.toFixed(1)} sur 5`}>
        {Array.from({ length: 5 }, (_, starIndex) => (
          <span key={starIndex} className="text-accent">
            {starIndex < fullStars ? (
              <Star size={size} fill="currentColor" aria-hidden="true" />
            ) : starIndex === fullStars && hasHalf ? (
              <StarHalf size={size} fill="currentColor" aria-hidden="true" />
            ) : (
              <Star size={size} className="text-gray-300 dark:text-gray-600" aria-hidden="true" />
            )}
          </span>
        ))}
      </div>
      {reviews !== undefined && <span className="text-xs text-muted">({reviews})</span>}
    </div>
  );
}

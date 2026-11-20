import clsx from 'clsx';
import { formatPrice, toNumber } from '../../lib/format';

interface ProductPriceProps {
  readonly price: string | number;
  readonly compareAtPrice?: string | number | null;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly className?: string;
}

const SIZES = {
  sm: { price: 'text-sm', old: 'text-xs' },
  md: { price: 'text-lg', old: 'text-sm' },
  lg: { price: 'text-3xl', old: 'text-lg' },
} as const;

export default function ProductPrice({ price, compareAtPrice, size = 'md', className }: ProductPriceProps) {
  const current = toNumber(price);
  const old = toNumber(compareAtPrice);
  const showOld = old > current;

  return (
    <div className={clsx('flex items-baseline gap-2 flex-wrap', className)}>
      <span className={clsx('font-bold text-primary', SIZES[size].price)}>{formatPrice(current)}</span>
      {showOld && <span className={clsx('text-muted line-through', SIZES[size].old)}>{formatPrice(old)}</span>}
    </div>
  );
}

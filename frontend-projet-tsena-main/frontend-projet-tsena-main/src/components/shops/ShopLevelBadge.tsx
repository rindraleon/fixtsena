import clsx from 'clsx';
import { BadgeCheck, Crown, Gem, Sparkles, Sprout } from 'lucide-react';
import { SHOP_LEVEL_LABELS, type ShopLevel } from '../../types/api';

const STYLES: Record<ShopLevel, { className: string; icon: typeof Crown }> = {
  new: { className: 'bg-surface-secondary text-muted border-border', icon: Sprout },
  verified: { className: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30', icon: BadgeCheck },
  gold: { className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30', icon: Crown },
  premium: { className: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/30', icon: Gem },
  founder: { className: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30', icon: Sparkles },
};

interface ShopLevelBadgeProps {
  readonly level: ShopLevel;
  readonly label?: string;
  readonly size?: 'xs' | 'sm';
  readonly className?: string;
}

export default function ShopLevelBadge({ level, label, size = 'xs', className }: ShopLevelBadgeProps) {
  const style = STYLES[level] ?? STYLES.new;
  const Icon = style.icon;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border font-semibold whitespace-nowrap',
        size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
        style.className,
        className,
      )}
      data-testid={`shop-level-${level}`}
    >
      <Icon size={size === 'xs' ? 11 : 13} aria-hidden="true" />
      {label ?? SHOP_LEVEL_LABELS[level] ?? level}
    </span>
  );
}

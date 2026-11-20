import { Heart } from 'lucide-react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { useFavorites } from '../../context/FavoritesContext';
import { toast } from '../../lib/toast';
import type { ApiProduct } from '../../types/api';

interface FavoriteButtonProps {
  readonly product: ApiProduct;
  readonly className?: string;
  readonly size?: number;
}

export default function FavoriteButton({ product, className, size = 18 }: FavoriteButtonProps) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const active = isFavorite(product.id);

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.85 }}
      onClick={(event) => {
        event.stopPropagation();
        event.preventDefault();
        const added = toggleFavorite(product);
        toast.info(added ? 'Ajouté à vos favoris' : 'Retiré de vos favoris', { id: `favorite-${product.id}`, duration: 2000 });
      }}
      className={clsx(
        'w-9 h-9 rounded-full flex items-center justify-center shadow-sm border transition-colors',
        active ? 'bg-red-50 border-red-200 text-red-500 dark:bg-red-500/15 dark:border-red-500/30' : 'bg-surface border-border text-muted hover:text-red-500',
        className,
      )}
      aria-pressed={active}
      aria-label={active ? 'Retirer des favoris' : 'Ajouter aux favoris'}
    >
      <Heart size={size} fill={active ? 'currentColor' : 'none'} />
    </motion.button>
  );
}

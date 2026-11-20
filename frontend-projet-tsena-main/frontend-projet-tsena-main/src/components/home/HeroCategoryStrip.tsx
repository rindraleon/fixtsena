import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { useCategoryTree } from '../../hooks/queries/useCategories';
import type { CategoryTreeNode } from '../../types/api';

/** Palette de dégradés pour les catégories sans visuel. */
const TILE_GRADIENTS = [
  'linear-gradient(135deg, #f0c040 0%, #d9a520 100%)',
  'linear-gradient(135deg, #2d8a6b 0%, #1a5c47 100%)',
  'linear-gradient(135deg, #e07a5f 0%, #b85c45 100%)',
  'linear-gradient(135deg, #3d7ea6 0%, #2a5a78 100%)',
  'linear-gradient(135deg, #8e6bbf 0%, #6a4c93 100%)',
  'linear-gradient(135deg, #5aa469 0%, #3f7d4d 100%)',
];

const TILE_SIZE = 'w-[122px] h-[148px] sm:w-[146px] sm:h-[176px] lg:w-[160px] lg:h-[186px]';

function CategoryTile({
  category,
  index,
}: {
  readonly category: CategoryTreeNode;
  readonly index: number;
}) {
  const image = category.imageUrl || category.iconUrl;
  return (
    <Link
      to={`/produits?categoryId=${category.id}`}
      className={cn(
        'block relative overflow-hidden shrink-0 rounded-2xl',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        TILE_SIZE,
      )}
      aria-label={`Voir les produits de la catégorie ${category.name}`}
    >
      {image ? (
        <img
          src={image}
          alt=""
          className="w-full h-full object-cover"
          width={160}
          height={186}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ background: TILE_GRADIENTS[index % TILE_GRADIENTS.length] }}
          aria-hidden="true"
        >
          <span className="text-white/90 font-extrabold text-4xl sm:text-5xl drop-shadow-sm">
            {category.name.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"
        aria-hidden="true"
      />
      <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
        <span className="text-white font-semibold text-xs sm:text-sm leading-tight block line-clamp-2">
          {category.name}
        </span>
        {category.productCount > 0 && (
          <span className="text-white/70 text-[11px]">
            {category.productCount} produit{category.productCount > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </Link>
  );
}

/**
 * Bandeau des catégories réelles (`/categories/tree`) : défilement natif, auto-défilement si animations autorisées.
 */
export default function HeroCategoryStrip({ className }: { readonly className?: string }) {
  const treeQuery = useCategoryTree();
  const reduceMotion = useReducedMotion();
  const roots = (treeQuery.data ?? []).slice(0, 8);

  if (treeQuery.isPending) {
    return (
      <div
        className={cn('flex gap-3 sm:gap-4 px-4 pb-5 overflow-hidden', className)}
        aria-hidden="true"
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={cn('shrink-0 rounded-2xl bg-white/10 animate-pulse', TILE_SIZE)}
          />
        ))}
      </div>
    );
  }
  // Erreur ou catalogue vide : le bandeau est omis (la sidebar affiche déjà l'état d'erreur).
  if (roots.length === 0) return null;

  const loop = !reduceMotion && roots.length >= 4;
  const items = loop ? [...roots, ...roots] : roots;

  return (
    <div className={cn('relative w-full overflow-hidden pb-5 pl-4', className)}>
      <div
        className="pointer-events-none absolute left-0 top-0 bottom-5 z-10 w-10 sm:w-16"
        style={{ background: 'linear-gradient(90deg, #2d8a6b 0%, transparent 100%)' }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute right-0 top-0 bottom-5 z-10 w-10 sm:w-16"
        style={{ background: 'linear-gradient(270deg, #2d8a6b 0%, transparent 100%)' }}
        aria-hidden="true"
      />
      {/* Liste dupliquée + translation de -50 % = boucle sans raccord visible */}
      <motion.ul
        className={cn(
          'flex items-center gap-3 sm:gap-4 pr-4 list-none m-0 p-0',
          !loop && 'overflow-x-auto pb-2 snap-x',
        )}
        animate={loop ? { x: ['0%', '-50%'] } : undefined}
        transition={
          loop
            ? {
                x: {
                  repeat: Infinity,
                  repeatType: 'loop',
                  duration: roots.length * 5,
                  ease: 'linear',
                },
              }
            : undefined
        }
        aria-label="Catégories principales"
      >
        {items.map((category, index) => (
          <li
            key={`${category.id}-${index}`}
            className="shrink-0 snap-start"
            aria-hidden={loop && index >= roots.length ? true : undefined}
          >
            <CategoryTile category={category} index={index % roots.length} />
          </li>
        ))}
      </motion.ul>
    </div>
  );
}

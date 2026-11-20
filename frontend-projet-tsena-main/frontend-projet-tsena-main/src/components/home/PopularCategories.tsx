import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Tag } from 'lucide-react';
import { useCategories } from '../../hooks/queries/useCategories';
import Skeleton from '../common/Skeleton';
import type { ApiCategory } from '../../types/api';

function CategoryTile({ category }: { readonly category: ApiCategory }) {
  const image = category.imageUrl || category.iconUrl;
  return (
    <Link to={`/produits?categoryId=${category.id}`} className="flex flex-col items-center gap-3 w-28 group" aria-label={`Voir les produits : ${category.name}`}>
      <div className="w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden bg-surface-secondary border-2 border-border group-hover:border-primary transition-colors flex items-center justify-center shadow-sm">
        {image ? (
          <img src={image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" width={112} height={112} />
        ) : (
          <Tag size={30} className="text-primary/60" aria-hidden="true" />
        )}
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-text group-hover:text-primary transition-colors line-clamp-2">{category.name}</p>
        {category.productCount > 0 && <p className="text-xs text-muted">{category.productCount} produit{category.productCount > 1 ? 's' : ''}</p>}
      </div>
    </Link>
  );
}

export default function PopularCategories() {
  const categoriesQuery = useCategories({ limit: 12, isActive: true });
  const categories = categoriesQuery.data?.items ?? [];

  if (categoriesQuery.isError || (categoriesQuery.isSuccess && categories.length === 0)) return null;

  return (
    <section className="py-8 md:py-12" aria-labelledby="popular-categories-heading">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-end justify-between mb-6">
          <h2 id="popular-categories-heading" className="text-xl md:text-2xl font-bold text-primary">Catégories populaires</h2>
          <Link to="/produits" className="text-sm font-semibold text-primary hover:underline">Tout voir</Link>
        </div>
        {categoriesQuery.isPending ? (
          <div className="flex gap-4 md:gap-6 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="shrink-0 w-28">
                <Skeleton className="w-28 h-28 rounded-full mx-auto" />
                <Skeleton className="h-4 w-20 mx-auto mt-3" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex overflow-x-auto gap-4 md:gap-6 pb-2 scrollbar-hide -mx-4 px-4">
            {categories.map((category, idx) => (
              <motion.div
                key={category.id}
                className="shrink-0"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: Math.min(idx, 6) * 0.06, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -4 }}
              >
                <CategoryTile category={category} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

import { Link } from 'react-router-dom';
import { ChevronRight, LayoutGrid, Tag } from 'lucide-react';
import { useCategoryTree } from '../../hooks/queries/useCategories';
import Skeleton from '../common/Skeleton';
import { resolveMediaUrl } from '../../lib/media';

const MAX_VISIBLE = 12;

export default function CategorySidebar() {
  const treeQuery = useCategoryTree();
  const categories = (treeQuery.data ?? []).slice(0, MAX_VISIBLE);
  let categoryContent;

  if (treeQuery.isPending) {
    categoryContent = (
      <ul className="divide-y divide-border" aria-busy="true" aria-label="Chargement des catégories">
        {Array.from({ length: 8 }).map((_, i) => (
          <li key={i} className="px-4 py-3"><Skeleton className="h-4 w-3/4" /></li>
        ))}
      </ul>
    );
  } else if (treeQuery.isError) {
    categoryContent = <p className="px-4 py-6 text-sm text-muted text-center">Catégories indisponibles pour le moment.</p>;
  } else if (categories.length === 0) {
    categoryContent = <p className="px-4 py-6 text-sm text-muted text-center">Aucune catégorie</p>;
  } else {
    categoryContent = (
      <ul className="divide-y divide-border">
        {categories.map((category) => (
          <li key={category.id}>
            <Link
              to={`/produits?categoryId=${category.id}`}
              className="flex items-center gap-3 px-4 py-3 text-sm text-text hover:bg-primary/5 hover:text-primary transition-colors group"
            >
              {category.iconUrl ? (
                <img src={resolveMediaUrl(category.iconUrl)} alt="" className="w-5 h-5 rounded object-cover shrink-0" loading="lazy" />
              ) : (
                <Tag size={16} className="text-muted shrink-0 group-hover:text-primary" aria-hidden="true" />
              )}
              <span className="flex-1 truncate">{category.name}</span>
              {(category.children?.length ?? 0) > 0 && <ChevronRight size={14} className="text-muted opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />}
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <aside className="hidden lg:block w-[240px] shrink-0" aria-label="Catégories de produits">
      <div className="flex items-center gap-2 bg-primary text-white font-semibold px-4 py-3 rounded-t-xl">
        <LayoutGrid size={18} aria-hidden="true" />
        Acheter par catégories
      </div>

      <nav className="bg-surface border border-t-0 border-border rounded-b-xl shadow-sm overflow-hidden">
        {categoryContent}
        <Link
          to="/produits"
          className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/5 transition-colors border-t border-border"
        >
          Voir tous les produits
          <ChevronRight size={14} aria-hidden="true" />
        </Link>
      </nav>
    </aside>
  );
}

import type { ReactNode } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Store, ArrowRight, ShieldCheck } from 'lucide-react';
import { useMyShop } from '../hooks/queries/useShops';
import { Button, ErrorState, LoadingState } from '../components/common';

const SHOP_HREF = '/dashboard/vendeur/boutique';

export function ShopRequiredNotice({ compact = false }: { readonly compact?: boolean }) {
  return (
    <div
      className="rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8 text-center"
      role="status"
      data-testid="seller-shop-required"
    >
      <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 text-primary mb-4" aria-hidden="true">
        <Store size={26} />
      </span>
      <h2 className="text-lg font-bold text-text">Créez votre boutique pour commencer à vendre</h2>
      <p className="text-sm text-muted mt-2 max-w-xl mx-auto">
        Chaque compte vendeur doit être associé à une boutique. Tant qu'elle n'existe pas, la gestion des produits,
        la publication des articles, le suivi des commandes, les promotions et les abonnements restent indisponibles.
      </p>
      {!compact && (
        <ul className="mt-4 mx-auto max-w-md text-left text-sm text-muted space-y-1.5">
          {[
            'Nom, description et localisation de la boutique',
            'Logo et image de couverture',
            'Soumission pour vérification par l’équipe Tsena',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <ShieldCheck size={15} className="text-primary mt-0.5 shrink-0" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-6 flex justify-center">
        <Link to={SHOP_HREF}>
          <Button icon={ArrowRight} tabIndex={-1}>Créer ma boutique</Button>
        </Link>
      </div>
    </div>
  );
}

interface SellerShopRouteProps {

  readonly children?: ReactNode;
}

export default function SellerShopRoute({ children }: SellerShopRouteProps) {
  const shopQuery = useMyShop();

  if (shopQuery.isPending) return <LoadingState variant="page" label="Vérification de votre boutique..." />;
  if (shopQuery.isError) {
    return <ErrorState error={shopQuery.error} onRetry={() => void shopQuery.refetch()} retrying={shopQuery.isFetching} />;
  }
  if (!shopQuery.data) return <ShopRequiredNotice />;

  return <>{children ?? <Outlet />}</>;
}

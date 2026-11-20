import { useSearchParams } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useTitle } from '../../hooks';
import { useFollowedShops } from '../../hooks/queries/useShops';
import { ShopCard } from '../../components/shops';
import { EmptyState, ErrorState, LoadingState, Pagination } from '../../components/common';
import PageHeader from '../../shared/components/PageHeader';

const PAGE_SIZE = 12;

export default function ClientFollowedShopsPage() {
  useTitle('Boutiques suivies | Mon compte');
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const query = useFollowedShops({ page, limit: PAGE_SIZE });
  const shops = query.data?.items ?? [];
  const meta = query.data?.meta;

  return (
    <div className="max-w-5xl">
      <PageHeader title="Boutiques suivies" subtitle="Recevez les nouveautés et promotions des boutiques que vous suivez, selon vos préférences de communication" />
      {query.isPending ? (
        <LoadingState variant="cards" count={6} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />
      ) : shops.length === 0 ? (
        <EmptyState icon={Heart} title="Vous ne suivez aucune boutique" description="Cliquez sur « Suivre la boutique » depuis une fiche produit ou la page d'une boutique." action={{ label: 'Découvrir les boutiques', to: '/boutiques' }} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="followed-shops">
            {shops.map((shop) => <ShopCard key={shop.id} shop={shop} />)}
          </div>
          {meta && meta.totalPages > 1 && <Pagination currentPage={page} totalPages={meta.totalPages} onPageChange={(p) => setSearchParams({ page: String(p) }, { replace: true })} />}
        </>
      )}
    </div>
  );
}

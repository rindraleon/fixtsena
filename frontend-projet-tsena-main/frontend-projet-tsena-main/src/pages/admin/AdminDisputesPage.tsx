import { Scale, FolderOpen, CheckCircle2, Percent } from 'lucide-react';
import { useTitle } from '../../hooks';
import { DisputesPage } from '../../components/disputes';
import { useDisputeStats } from '../../hooks/queries/useDisputes';
import StatCard from '../../shared/components/StatCard';
import { ErrorState, LoadingState } from '../../components/common';

export default function AdminDisputesPage() {
  useTitle('Litiges | Administration');
  const stats = useDisputeStats();

  return (
    <DisputesPage
      role="admin"
      title="Gestion des litiges"
      subtitle="Analysez les dossiers, consultez les preuves et appliquez une résolution (libération, remboursement total ou partiel)."
      orderHref={(dispute) => `/dashboard/admin/commandes?search=${encodeURIComponent(dispute.orderNumber ?? '')}`}
      header={
        stats.isPending ? (
          <LoadingState variant="stats" count={4} className="mb-6" />
        ) : stats.isError ? (
          <ErrorState error={stats.error} onRetry={() => void stats.refetch()} compact className="mb-6" />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard title="Litiges au total" value={stats.data.totalDisputes} icon={Scale} color="primary" index={0} />
            <StatCard title="Ouverts" value={stats.data.openDisputes} icon={FolderOpen} color="warning" index={1} />
            <StatCard title="Résolus" value={stats.data.resolvedDisputes} icon={CheckCircle2} color="success" index={2} />
            <StatCard title="Taux de résolution" value={`${stats.data.resolutionRate}%`} icon={Percent} color="info" index={3} />
          </div>
        )
      }
    />
  );
}

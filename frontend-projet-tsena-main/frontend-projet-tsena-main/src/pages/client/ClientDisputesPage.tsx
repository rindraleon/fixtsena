import { useTitle } from '../../hooks';
import { DisputesPage } from '../../components/disputes';

export default function ClientDisputesPage() {
  useTitle('Mes litiges');
  return (
    <DisputesPage
      role="client"
      title="Mes litiges"
      subtitle="Suivez les problèmes signalés sur vos commandes. Un administrateur tranche chaque litige."
      orderHref={(dispute) => `/dashboard/client/mes-commandes?search=${encodeURIComponent(dispute.orderNumber ?? '')}`}
    />
  );
}

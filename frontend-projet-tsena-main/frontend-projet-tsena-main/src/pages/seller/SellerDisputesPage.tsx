import { useTitle } from '../../hooks';
import { DisputesPage } from '../../components/disputes';

export default function SellerDisputesPage() {
  useTitle('Litiges | Vendeur');
  return (
    <DisputesPage
      role="seller"
      title="Litiges"
      subtitle="Litiges concernant vos ventes. Ajoutez vos pièces justificatives tant que le dossier est ouvert."
      orderHref={(dispute) => `/dashboard/vendeur/commandes?search=${encodeURIComponent(dispute.orderNumber ?? '')}`}
    />
  );
}

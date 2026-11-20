import { Link, useLocation } from 'react-router-dom';
import { CheckCircle2, Package, Home, Phone, AlertTriangle, CreditCard } from 'lucide-react';
import { useTitle } from '../../hooks';
import { EmptyState } from '../../components/common';
import { formatPrice, paymentMethodLabel } from '../../lib/format';
import type { ApiOrder, PaymentMethod } from '../../types/api';

export interface OrderSuccessState {
  orders: ApiOrder[];
  method: PaymentMethod;
  paymentFailures: { orderId: string; orderNumber: string; message: string }[];
}

function isOrderSuccessState(value: unknown): value is OrderSuccessState {
  return !!value && typeof value === 'object' && Array.isArray((value as OrderSuccessState).orders) && (value as OrderSuccessState).orders.length > 0;
}

export default function OrderSuccessPage() {
  useTitle('Commande confirmée');
  const location = useLocation();
  const state: unknown = location.state;

  if (!isOrderSuccessState(state)) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <EmptyState titleAs="h1"
          icon={Package}
          title="Aucune commande récente à afficher"
          description="Retrouvez l'historique et le suivi de toutes vos commandes dans votre espace client."
          action={{ label: 'Voir mes commandes', to: '/dashboard/client/mes-commandes' }}
          secondaryAction={{ label: "Retour à l'accueil", to: '/' }}
        />
      </div>
    );
  }

  const { orders, method, paymentFailures } = state;
  const total = orders.reduce((sum, order) => sum + Number(order.totalAmount), 0);
  const multiple = orders.length > 1;

  return (
    <div className="max-w-lg mx-auto px-4 py-12 text-center animate-fade-in-up">
      <div className="bg-surface rounded-2xl border border-border p-8 shadow-sm">
        <div className="mx-auto w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mb-4">
          <CheckCircle2 size={40} className="text-success" />
        </div>
        <h1 className="text-2xl font-bold text-primary mb-2">{multiple ? 'Commandes enregistrées !' : 'Commande enregistrée !'}</h1>
        <p className="text-muted mb-5">
          Merci pour votre confiance.{' '}
          {multiple ? `Votre panier contenait des articles de ${orders.length} vendeurs : ${orders.length} commandes ont été créées.` : 'Voici votre numéro de commande :'}
        </p>

        <ul className="space-y-2 mb-6 text-left" aria-label="Numéros de commande">
          {orders.map((order) => (
            <li key={order.id} className="flex items-center justify-between bg-surface-secondary rounded-lg py-2.5 px-4">
              <span className="font-bold text-text font-mono" data-testid="order-number">{order.orderNumber}</span>
              <span className="text-sm font-semibold text-primary">{formatPrice(order.totalAmount)}</span>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-center gap-2 text-sm text-muted mb-2">
          <CreditCard size={16} className="text-primary" />
          <span>Paiement : {paymentMethodLabel(method)}</span>
          {multiple && <span>· Total {formatPrice(total)}</span>}
        </div>
        <div className="flex items-start justify-center gap-2 text-sm text-muted mb-6 text-left">
          <Package size={16} className="text-primary shrink-0 mt-0.5" />
          <span>
            {method === 'cash_on_delivery'
              ? 'Vous réglerez en espèces à la réception. Le vendeur confirme puis expédie votre commande : suivez chaque étape depuis « Mes commandes ».'
              : 'Votre paiement est en cours de validation : dès qu’il est confirmé, il est conservé en séquestre et le vendeur prépare votre commande. Vous ne libérez les fonds qu’après avoir confirmé la réception.'}
          </span>
        </div>

        {paymentFailures.length > 0 && (
          <div role="alert" className="text-left bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl p-4 mb-6">
            <p className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300 text-sm mb-2">
              <AlertTriangle size={16} /> Paiement à finaliser
            </p>
            <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
              {paymentFailures.map((failure) => (
                <li key={failure.orderId}>
                  <span className="font-mono font-medium">{failure.orderNumber}</span> : {failure.message}
                </li>
              ))}
            </ul>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
              Vos commandes sont bien enregistrées. Vous pourrez relancer le paiement depuis « Mes commandes ».
            </p>
          </div>
        )}

        <div className="space-y-3">
          <Link to="/dashboard/client/mes-commandes" className="block w-full bg-primary text-white py-2.5 rounded-lg font-semibold hover:bg-primary-dark transition-colors">
            Suivre mes commandes
          </Link>
          <Link to="/" className="block w-full border border-border text-text py-2.5 rounded-lg font-semibold hover:bg-surface-secondary transition-colors">
            <Home size={16} className="inline mr-2" /> Retour à l'accueil
          </Link>
          <Link to="/contact" className="text-sm text-primary font-medium hover:underline flex items-center justify-center gap-1">
            <Phone size={14} /> Nous contacter
          </Link>
        </div>
      </div>
    </div>
  );
}

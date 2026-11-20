import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, PlusCircle, ShoppingBag, Star, Wallet, Store, Scale, ShoppingCart, MessageSquare, Bell, Crown, Megaphone, ArrowRight } from 'lucide-react';
import DashboardShell from './DashboardShell';
import type { SidebarItem } from '../shared/components/DashboardSidebar';
import { useSellerOrderStats } from '../hooks/queries/useOrders';
import { useMyShop } from '../hooks/queries/useShops';
import { useMessagingUnreadCount } from '../hooks/queries/useMessaging';
import { useNotificationsUnreadCount } from '../hooks/queries/useNotifications';
import { useAuth } from '../context/AuthContext';
import { hasAppRole } from '../shared/data/permissions';

export default function SellerDashboardLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const { data: shop, isPending: shopPending } = useMyShop();

  const hasShop = shopPending || !!shop;
  const { data: stats } = useSellerOrderStats();
  const { data: unreadMessages } = useMessagingUnreadCount();
  const { data: unreadNotifications } = useNotificationsUnreadCount();

  const saleItems: SidebarItem[] = [
    { id: 'products', label: 'Mes produits', href: '/dashboard/vendeur/produits', icon: Package },
    { id: 'add-product', label: 'Ajouter un produit', href: '/dashboard/vendeur/produits/nouveau', icon: PlusCircle },
    { id: 'orders', label: 'Commandes', href: '/dashboard/vendeur/commandes', icon: ShoppingBag, badge: stats?.pendingOrders },
  ];
  const saleTools: SidebarItem[] = [
    { id: 'subscription', label: 'Abonnement', href: '/dashboard/vendeur/abonnement', icon: Crown },
    { id: 'promotions', label: 'Promotions', href: '/dashboard/vendeur/promotions', icon: Megaphone },
    { id: 'earnings', label: 'Revenus', href: '/dashboard/vendeur/revenus', icon: Wallet },
    { id: 'reviews', label: 'Avis clients', href: '/dashboard/vendeur/avis', icon: Star },
    { id: 'disputes', label: 'Litiges', href: '/dashboard/vendeur/litiges', icon: Scale },
  ];

  const items: SidebarItem[] = [
    { id: 'overview', label: 'Tableau de bord', href: '/dashboard/vendeur', icon: LayoutDashboard, end: true },
    ...(hasShop ? saleItems : []),
    { id: 'messages', label: 'Messagerie', href: '/dashboard/vendeur/messages', icon: MessageSquare, badge: unreadMessages?.count },
    { id: 'notifications', label: 'Notifications', href: '/dashboard/vendeur/notifications', icon: Bell, badge: unreadNotifications?.count },
    { id: 'store', label: hasShop ? 'Ma boutique' : 'Créer ma boutique', href: '/dashboard/vendeur/boutique', icon: Store },
    ...(hasShop ? saleTools : []),

    ...(hasAppRole(user?.roles, 'client') ? [{ id: 'purchases', label: 'Mes achats', href: '/dashboard/client/mes-commandes', icon: ShoppingCart }] : []),
  ];

  const banner = !shopPending && !shop && !location.pathname.endsWith('/boutique') ? (
    <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3" role="status">
      <p className="text-sm text-text">
        <span className="font-semibold">Votre boutique n'est pas encore créée.</span>{' '}
        <span className="text-muted">Créez-la pour vendre, publier des produits et gérer vos commandes.</span>
      </p>
      <Link to="/dashboard/vendeur/boutique" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline shrink-0">
        Créer ma boutique <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </div>
  ) : undefined;

  return <DashboardShell items={items} title="Espace vendeur" profileHref="/dashboard/vendeur/profil" banner={banner} />;
}

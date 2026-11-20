import { LayoutDashboard, User, ShoppingBag, Heart, Star, Scale, Store, MessageSquare, Bell, Users } from 'lucide-react';
import DashboardShell from './DashboardShell';
import type { SidebarItem } from '../shared/components/DashboardSidebar';
import { useBuyerOrderStats } from '../hooks/queries/useOrders';
import { useMessagingUnreadCount } from '../hooks/queries/useMessaging';
import { useNotificationsUnreadCount } from '../hooks/queries/useNotifications';
import { useAuth } from '../context/AuthContext';
import { hasAppRole } from '../shared/data/permissions';

export default function ClientDashboardLayout() {
  const { user } = useAuth();
  const { data: stats } = useBuyerOrderStats();
  const { data: unreadMessages } = useMessagingUnreadCount();
  const { data: unreadNotifications } = useNotificationsUnreadCount();

  const items: SidebarItem[] = [
    { id: 'overview', label: 'Tableau de bord', href: '/dashboard/client', icon: LayoutDashboard, end: true },
    { id: 'profile', label: 'Mon profil', href: '/dashboard/client/profil', icon: User },
    { id: 'orders', label: 'Mes commandes', href: '/dashboard/client/mes-commandes', icon: ShoppingBag, badge: stats?.activeOrders },
    { id: 'messages', label: 'Messagerie', href: '/dashboard/client/messages', icon: MessageSquare, badge: unreadMessages?.count },
    { id: 'notifications', label: 'Notifications', href: '/dashboard/client/notifications', icon: Bell, badge: unreadNotifications?.count },
    { id: 'followed-shops', label: 'Boutiques suivies', href: '/dashboard/client/boutiques-suivies', icon: Users },
    { id: 'wishlist', label: 'Mes favoris', href: '/favoris', icon: Heart },
    { id: 'reviews', label: 'Mes avis', href: '/dashboard/client/mes-avis', icon: Star },
    { id: 'disputes', label: 'Mes litiges', href: '/dashboard/client/mes-litiges', icon: Scale },
    ...(hasAppRole(user?.roles, 'seller') ? [{ id: 'store', label: 'Ma boutique', href: '/dashboard/vendeur', icon: Store }] : []),
  ];

  return <DashboardShell items={items} title="Mon compte" profileHref="/dashboard/client/profil" />;
}

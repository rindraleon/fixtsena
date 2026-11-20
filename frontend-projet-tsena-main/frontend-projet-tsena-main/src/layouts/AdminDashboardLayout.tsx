import {
  LayoutDashboard, Users, UserCheck, Package, FolderOpen,
  ShoppingBag, CreditCard, BarChart3, Scale, Store, Megaphone, ShieldAlert, Settings, Award } from 'lucide-react';
import DashboardShell from './DashboardShell';
import type { SidebarItem } from '../shared/components/DashboardSidebar';
import { useAdminDashboard } from '../hooks/queries/useUsers';
import { useAdminShopStats } from '../hooks/queries/useShops';

export default function AdminDashboardLayout() {
  const { data: stats } = useAdminDashboard();
  const { data: shopStats } = useAdminShopStats();

  const items: SidebarItem[] = [
    { id: 'overview', label: 'Tableau de bord', href: '/dashboard/admin', icon: LayoutDashboard, end: true },
    { id: 'users', label: 'Utilisateurs', href: '/dashboard/admin/utilisateurs', icon: Users },
    { id: 'sellers', label: 'Vendeurs', href: '/dashboard/admin/vendeurs', icon: UserCheck },
    { id: 'shops', label: 'Boutiques', href: '/dashboard/admin/boutiques', icon: Store, badge: shopStats?.byStatus.pending_verification },
    { id: 'products', label: 'Produits', href: '/dashboard/admin/produits', icon: Package },
    { id: 'categories', label: 'Catégories', href: '/dashboard/admin/categories', icon: FolderOpen },
    { id: 'orders', label: 'Commandes', href: '/dashboard/admin/commandes', icon: ShoppingBag, badge: stats?.orders.pending },
    { id: 'payments', label: 'Paiements & séquestre', href: '/dashboard/admin/paiements', icon: CreditCard },
    { id: 'disputes', label: 'Litiges', href: '/dashboard/admin/litiges', icon: Scale, badge: stats?.disputes.open },
    { id: 'promotions', label: 'Promotions & abonnements', href: '/dashboard/admin/promotions', icon: Megaphone },
    { id: 'moderation', label: 'Modération', href: '/dashboard/admin/moderation', icon: ShieldAlert },
    { id: 'badges', label: 'Badges', href: '/dashboard/admin/badges', icon: Award },
    { id: 'reports', label: 'Rapports & audit', href: '/dashboard/admin/rapports', icon: BarChart3 },
    { id: 'settings', label: 'Paramètres', href: '/dashboard/admin/parametres', icon: Settings },
  ];

  return <DashboardShell items={items} title="Panneau admin" />;
}

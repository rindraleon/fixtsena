import { useCallback, useState, type ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import DashboardSidebar, { type SidebarItem } from '../shared/components/DashboardSidebar';
import DashboardTopBar from '../components/layout/DashboardTopBar';
import SkipLink from '../components/common/SkipLink';
import { useAuth } from '../context/AuthContext';

interface DashboardShellProps {
  readonly items: SidebarItem[];
  readonly title: string;
  readonly profileHref?: string;

  readonly banner?: ReactNode;
}

export default function DashboardShell({ items, title, profileHref, banner }: DashboardShellProps) {
  const { user, requestLogout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const currentPage =
    items.find((item) => location.pathname === item.href) ??
    [...items]
      .filter((item) => !item.end && location.pathname.startsWith(`${item.href}/`))
      .sort((a, b) => b.href.length - a.href.length)[0];

  const firstName = user?.firstName?.trim() || user?.fullName || '';

  return (
    <div className="min-h-screen bg-background flex">
      <SkipLink />
      <DashboardSidebar items={items} title={title} mobileOpen={mobileOpen} onMobileClose={closeMobile} onLogout={requestLogout} />

      <div className="flex-1 flex flex-col min-w-0">
        <DashboardTopBar
          title={currentPage?.label ?? 'Tableau de bord'}
          subtitle={firstName ? `Bon retour, ${firstName}` : undefined}
          onMenuClick={() => setMobileOpen(true)}
          profileHref={profileHref}
        />
        <main id="main-content" tabIndex={-1} className="flex-1 p-4 md:p-6 lg:p-8 overflow-x-hidden outline-none">
          <div className="max-w-[1400px] mx-auto w-full">
            {banner}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { type LucideIcon, ChevronLeft, LogOut, X } from 'lucide-react';
import TsenaLogo from '../../components/layout/TsenaLogo';

export interface SidebarItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
  end?: boolean;
}

interface DashboardSidebarProps {
  readonly items: SidebarItem[];
  readonly title?: string;
  readonly mobileOpen: boolean;
  readonly onMobileClose: () => void;
  readonly onLogout: () => void;
}

function NavItems({ items, collapsed, onNavigate }: { items: SidebarItem[]; collapsed: boolean; onNavigate?: () => void }) {
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <li key={item.id}>
            <NavLink
              to={item.href}
              end={item.end ?? false}
              onClick={onNavigate}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative',
                  isActive ? 'bg-primary text-white shadow-sm' : 'text-text/70 hover:bg-surface-tertiary hover:text-text',
                )
              }
              title={collapsed ? item.label : undefined}
            >
              <Icon size={20} className="shrink-0" aria-hidden="true" />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {item.badge !== undefined && item.badge > 0 && !collapsed && (
                <span className="ml-auto bg-danger text-white text-[10px] min-w-5 h-5 px-1 rounded-full flex items-center justify-center font-bold">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
              {item.badge !== undefined && item.badge > 0 && collapsed && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full" aria-hidden="true" />
              )}
            </NavLink>
          </li>
        );
      })}
    </ul>
  );
}

export default function DashboardSidebar({ items, title = 'Menu', mobileOpen, onMobileClose, onLogout }: DashboardSidebarProps) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('tsena.sidebar.collapsed') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('tsena.sidebar.collapsed', collapsed ? '1' : '0');
    } catch {
    }
  }, [collapsed]);

  useEffect(() => {
    onMobileClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onMobileClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [mobileOpen, onMobileClose]);

  return (
    <>
      <aside
        className={clsx(
          'hidden lg:flex flex-col bg-surface border-r border-border shrink-0 transition-[width] duration-300 sticky top-0 h-screen',
          collapsed ? 'w-[76px]' : 'w-[250px]',
        )}
        aria-label={title}
      >
        <div className={clsx('h-16 flex items-center border-b border-border', collapsed ? 'justify-center px-2' : 'justify-between px-4')}>
          {!collapsed && (
            <Link to="/" aria-label="Retour à l'accueil Tsena">
              <TsenaLogo size="sm" />
            </Link>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="p-1.5 rounded-lg hover:bg-surface-tertiary text-muted transition-colors"
            aria-label={collapsed ? 'Déployer le menu' : 'Réduire le menu'}
          >
            <ChevronLeft size={16} className={clsx('transition-transform', collapsed && 'rotate-180')} />
          </button>
        </div>
        {!collapsed && <p className="px-5 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</p>}
        <nav className="flex-1 p-3 overflow-y-auto">
          <NavItems items={items} collapsed={collapsed} />
        </nav>
        <div className="p-3 border-t border-border">
          <button
            type="button"
            onClick={onLogout}
            className={clsx(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors',
              collapsed && 'justify-center',
            )}
            title="Déconnexion"
            data-testid="sidebar-logout"
          >
            <LogOut size={20} aria-hidden="true" />
            {!collapsed && <span>Déconnexion</span>}
          </button>
        </div>
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <div key="mobile-sidebar" className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={title}>
            <motion.div
              className="absolute inset-0 bg-black/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onMobileClose}
              aria-hidden="true"
            />
            <motion.aside
              className="absolute left-0 top-0 bottom-0 w-[280px] max-w-[85vw] bg-surface shadow-2xl flex flex-col"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            >
              <div className="h-16 px-4 flex items-center justify-between border-b border-border">
                <Link to="/" aria-label="Retour à l'accueil Tsena">
                  <TsenaLogo size="sm" />
                </Link>
                <button type="button" onClick={onMobileClose} className="p-1.5 rounded-lg hover:bg-surface-hover text-muted" aria-label="Fermer le menu">
                  <X size={20} />
                </button>
              </div>
              <p className="px-5 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</p>
              <nav className="flex-1 p-3 overflow-y-auto">
                <NavItems items={items} collapsed={false} onNavigate={onMobileClose} />
              </nav>
              <div className="p-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    onMobileClose();
                    onLogout();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                >
                  <LogOut size={20} aria-hidden="true" />
                  Déconnexion
                </button>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

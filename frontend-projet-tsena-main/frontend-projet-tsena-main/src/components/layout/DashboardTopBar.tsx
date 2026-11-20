import { useState, Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Home, LogOut, Menu, ChevronDown, UserCircle, ShoppingCart, MessageSquare, Bell } from 'lucide-react';
import clsx from 'clsx';
import ThemeSelector from '../common/ThemeSelector';
import { useAuth } from '../../context/AuthContext';
import { useCartCount } from '../../hooks/queries/useCart';
import { useMessagingUnreadCount } from '../../hooks/queries/useMessaging';
import { useNotificationsUnreadCount } from '../../hooks/queries/useNotifications';
import { roleLabels } from '../../lib/format';
import { hasAppRole } from '../../shared/data/permissions';
import { resolveMediaUrl } from '../../lib/media';

interface DashboardTopBarProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly onMenuClick: () => void;
  readonly profileHref?: string;
}

export default function DashboardTopBar({ title, subtitle, onMenuClick, profileHref }: DashboardTopBarProps) {
  const { user, requestLogout } = useAuth();
  const { data: cartCount = 0 } = useCartCount();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const inSellerSpace = location.pathname.startsWith('/dashboard/vendeur');
  const hasChatAccess = !location.pathname.startsWith('/dashboard/admin');
  const messagesHref = inSellerSpace ? '/dashboard/vendeur/messages' : '/dashboard/client/messages';
  const notificationsHref = inSellerSpace ? '/dashboard/vendeur/notifications' : '/dashboard/client/notifications';
  const { data: unreadMessages } = useMessagingUnreadCount({ enabled: hasChatAccess });
  const { data: unreadNotifications } = useNotificationsUnreadCount({ enabled: hasChatAccess });
  const messageBadge = hasChatAccess ? unreadMessages?.count ?? 0 : 0;
  const notificationBadge = hasChatAccess ? unreadNotifications?.count ?? 0 : 0;

  return (
    <header className="bg-surface/95 backdrop-blur border-b border-border px-4 md:px-6 h-16 flex items-center justify-between gap-3 sticky top-0 z-30">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg bg-surface-hover text-muted hover:text-text transition-colors"
          aria-label="Ouvrir le menu"
        >
          <Menu size={20} />
        </button>
        <div className="min-w-0">
          <p className="font-bold text-base md:text-lg text-text leading-tight truncate" aria-hidden="true">{title}</p>
          {subtitle && <p className="text-[11px] md:text-xs text-muted leading-tight truncate">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <ThemeSelector />

        <Link
          to="/"
          className="flex items-center gap-1.5 text-sm text-muted hover:text-text font-medium px-2 sm:px-3 py-1.5 rounded-lg bg-surface-hover hover:bg-surface-tertiary transition-colors"
          aria-label="Retour à la boutique"
        >
          <Home size={16} aria-hidden="true" />
          <span className="hidden sm:inline">Boutique</span>
        </Link>

        {hasAppRole(user?.roles, 'client') && (
          <Link
            to="/panier"
            className="relative p-2 rounded-lg bg-surface-hover hover:bg-surface-tertiary text-muted hover:text-text transition-colors"
            aria-label={`Panier${cartCount > 0 ? ` (${cartCount})` : ''}`}
          >
            <ShoppingCart size={18} />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </Link>
        )}

        {hasChatAccess && (
          <>
            <Link
              to={messagesHref}
              className="relative p-2 rounded-lg bg-surface-hover hover:bg-surface-tertiary text-muted hover:text-text transition-colors"
              aria-label={`Messagerie${messageBadge > 0 ? ` (${messageBadge} non lu${messageBadge > 1 ? 's' : ''})` : ''}`}
              data-testid="topbar-messages"
            >
              <MessageSquare size={18} />
              {messageBadge > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {messageBadge > 99 ? '99+' : messageBadge}
                </span>
              )}
            </Link>
            <Link
              to={notificationsHref}
              className="relative p-2 rounded-lg bg-surface-hover hover:bg-surface-tertiary text-muted hover:text-text transition-colors"
              aria-label={`Notifications${notificationBadge > 0 ? ` (${notificationBadge} non lue${notificationBadge > 1 ? 's' : ''})` : ''}`}
              data-testid="topbar-notifications"
            >
              <Bell size={18} />
              {notificationBadge > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {notificationBadge > 99 ? '99+' : notificationBadge}
                </span>
              )}
            </Link>
          </>
        )}

        {user && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg bg-surface-hover hover:bg-surface-tertiary transition-colors"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Menu utilisateur"
            >
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold overflow-hidden">
                {user.avatarUrl ? <img src={resolveMediaUrl(user.avatarUrl)} alt="" className="w-full h-full object-cover" /> : user.initials}
              </div>
              <span className="hidden md:block text-sm font-medium text-text max-w-[120px] truncate">{user.fullName}</span>
              <ChevronDown size={14} className={clsx('text-muted transition-transform hidden md:block', menuOpen && 'rotate-180')} />
            </button>

            <AnimatePresence>
              {menuOpen && (
                <Fragment key="user-menu">
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden="true" />
                  <motion.div
                    role="menu"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-60 bg-surface border border-border rounded-xl shadow-xl py-1 z-20"
                  >
                    <div className="px-4 py-3 border-b border-border">
                      <p className="text-sm font-semibold text-text truncate">{user.fullName}</p>
                      <p className="text-xs text-muted truncate">{user.email}</p>
                      <span className="inline-block mt-1.5 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {roleLabels(user.roles)[0] ?? 'Client'}
                      </span>
                    </div>
                    {profileHref && (
                      <Link
                        to={profileHref}
                        role="menuitem"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-text hover:bg-surface-hover transition-colors"
                      >
                        <UserCircle size={16} /> Mon profil
                      </Link>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        requestLogout();
                      }}
                      className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                      data-testid="topbar-logout"
                    >
                      <LogOut size={16} /> Déconnexion
                    </button>
                  </motion.div>
                </Fragment>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </header>
  );
}

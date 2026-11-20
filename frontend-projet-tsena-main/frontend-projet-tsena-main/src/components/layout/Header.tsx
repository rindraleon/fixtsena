import { useEffect, useState, Fragment } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, ShoppingCart, User, Menu, X, LogOut, LayoutDashboard, ChevronDown, Search } from 'lucide-react';
import clsx from 'clsx';
import ThemeSelector from '../common/ThemeSelector';
import TsenaLogo from './TsenaLogo';
import { useAuth } from '../../context/AuthContext';
import { useFavorites } from '../../context/FavoritesContext';
import { useCartCount } from '../../hooks/queries/useCart';
import { getDashboardRoute } from '../../shared/data/permissions';
import { roleLabels } from '../../lib/format';
import { resolveMediaUrl } from '../../lib/media';

const NAV_LINKS = [
  { label: 'Produits', to: '/produits' },
  { label: 'Boutiques', to: '/boutiques' },
  { label: 'Promotions', to: '/promotions' },
  { label: 'Contact', to: '/contact' },
  { label: 'À propos', to: '/a-propos' },
] as const;

const MOBILE_LINKS = [{ label: 'Accueil', to: '/' }, ...NAV_LINKS] as const;

function CountBadge({ value, label }: { readonly value: number; readonly label: string }) {
  if (value <= 0) return null;
  return (
    <span
      className="absolute -top-1 -right-1.5 min-w-[18px] h-[18px] px-1 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-count-pulse"
      aria-label={`${value} ${label}`}
    >
      {value > 99 ? '99+' : value}
    </span>
  );
}

export default function Header() {
  const { user, isAuthenticated, requestLogout } = useAuth();
  const { count: favoritesCount } = useFavorites();
  const { data: cartCount = 0 } = useCartCount();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  useEffect(() => {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  const requireAuth = (event: React.MouseEvent, target: string) => {
    if (!isAuthenticated) {
      event.preventDefault();
      void navigate('/connexion', { state: { from: target } });
    }
  };

  const handleLogoutClick = () => {
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
    requestLogout();
  };

  const handleSearch = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchValue.trim();
    void navigate(query ? `/produits?search=${encodeURIComponent(query)}` : '/produits');
    setMobileMenuOpen(false);
  };

  return (
    <header className="bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80 shadow-sm sticky top-0 z-40 w-full border-b border-border">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-4 max-w-[1600px] mx-auto">
          <Link to="/" className="shrink-0" aria-label="Tsena — Accueil">
            <TsenaLogo />
          </Link>

          {/* <form onSubmit={handleSearch} className="hidden lg:flex flex-1 max-w-xl" role="search">
            <label htmlFor="header-search" className="sr-only">
              Rechercher un produit
            </label>
            <div className="relative w-full">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input
                id="header-search"
                type="search"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Rechercher un produit, une marque…"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-input-border bg-input-bg text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
              />
            </div>
          </form> */}

          <nav className="hidden md:flex items-center gap-6" aria-label="Navigation principale">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  clsx(
                    'text-sm font-medium transition-colors relative py-1',
                    isActive ? 'text-primary after:absolute after:left-0 after:right-0 after:-bottom-0.5 after:h-0.5 after:bg-accent after:rounded-full' : 'text-text hover:text-primary',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeSelector />

            <Link
              to="/favoris"
              className="relative hidden sm:flex flex-col items-center text-text hover:text-primary transition-colors px-1"
              aria-label="Favoris"
            >
              <Heart size={22} />
              <CountBadge value={favoritesCount} label="favoris" />
              <span className="text-[10px] mt-0.5">Favoris</span>
            </Link>

            <Link
              to="/panier"
              onClick={(e) => requireAuth(e, '/panier')}
              className="relative flex flex-col items-center text-text hover:text-primary transition-colors px-1"
              aria-label="Panier"
              data-testid="header-cart-link"
            >
              <ShoppingCart size={22} />
              <CountBadge value={cartCount} label="articles dans le panier" />
              <span className="text-[10px] mt-0.5">Panier</span>
            </Link>

            <button
              type="button"
              className="md:hidden p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {user ? (
              <div className="relative hidden sm:block">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((open) => !open)}
                  className="flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-xl hover:bg-surface-hover transition-colors"
                  aria-label="Menu utilisateur"
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                  data-testid="header-user-menu"
                >
                  <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold overflow-hidden ring-2 ring-accent/50">
                    {user.avatarUrl ? (
                      <img src={resolveMediaUrl(user.avatarUrl)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      user.initials
                    )}
                  </div>
                  <div className="text-left hidden lg:block max-w-[140px]">
                    <span className="text-sm font-medium text-text block leading-tight truncate">{user.fullName}</span>
                    <span className="text-[10px] text-muted leading-tight">{roleLabels(user.roles)[0] ?? 'Client'}</span>
                  </div>
                  <ChevronDown size={14} className={clsx('text-muted transition-transform', userMenuOpen && 'rotate-180')} />
                </button>

                <AnimatePresence>
                  {userMenuOpen && (
                    <Fragment key="user-menu">
                      <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} aria-hidden="true" />
                      <motion.div
                        role="menu"
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 w-60 bg-surface border border-border rounded-xl shadow-xl py-1 z-20 overflow-hidden"
                      >
                        <div className="px-4 py-3 border-b border-border">
                          <p className="text-sm font-semibold text-text truncate">{user.fullName}</p>
                          <p className="text-xs text-muted truncate">{user.email}</p>
                        </div>
                        <Link
                          to={getDashboardRoute(user.role)}
                          role="menuitem"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-text hover:bg-surface-hover transition-colors"
                        >
                          <LayoutDashboard size={16} /> Mon tableau de bord
                        </Link>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={handleLogoutClick}
                          className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                          data-testid="header-logout"
                        >
                          <LogOut size={16} /> Déconnexion
                        </button>
                      </motion.div>
                    </Fragment>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link
                to="/connexion"
                className="hidden sm:inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary-dark transition-colors shadow-sm"
              >
                <User size={16} />
                Connexion
              </Link>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            key="mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden border-t border-border bg-surface overflow-hidden"
          >
            <nav className="max-w-7xl mx-auto px-4 py-3 space-y-1" aria-label="Navigation mobile">
              <form onSubmit={handleSearch} className="relative mb-2" role="search">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <input
                  type="search"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder="Rechercher…"
                  aria-label="Rechercher un produit"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-input-border bg-input-bg text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </form>
              {MOBILE_LINKS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    clsx(
                      'block py-2.5 px-3 text-sm rounded-lg transition-colors',
                      isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-text hover:bg-primary/10 hover:text-primary',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              <div className="border-t border-border pt-3 mt-3 grid grid-cols-2 gap-2">
                <Link to="/favoris" className="text-center py-2.5 text-sm border border-border rounded-lg hover:bg-primary/10">
                  Favoris {favoritesCount > 0 && `(${favoritesCount})`}
                </Link>
                <Link
                  to="/panier"
                  onClick={(e) => requireAuth(e, '/panier')}
                  className="text-center py-2.5 text-sm border border-border rounded-lg hover:bg-primary/10"
                >
                  Panier {cartCount > 0 && `(${cartCount})`}
                </Link>
                {user ? (
                  <>
                    <Link
                      to={getDashboardRoute(user.role)}
                      className="col-span-2 text-center py-2.5 text-sm bg-primary text-white rounded-lg font-semibold"
                    >
                      Mon tableau de bord
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogoutClick}
                      className="col-span-2 text-center py-2.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
                    >
                      Déconnexion
                    </button>
                  </>
                ) : (
                  <Link to="/connexion" className="col-span-2 text-center py-2.5 text-sm bg-primary text-white rounded-lg font-semibold">
                    Connexion / Inscription
                  </Link>
                )}
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

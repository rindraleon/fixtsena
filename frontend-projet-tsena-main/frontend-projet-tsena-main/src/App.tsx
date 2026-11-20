import { lazy, Suspense } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { env } from './lib/env';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { FavoritesProvider } from './context/FavoritesContext';
import ErrorBoundary from './components/common/ErrorBoundary';
import ScrollManager from './components/common/ScrollManager';
import Toaster from './components/common/Toaster';
import LoadingState from './components/common/LoadingState';

import HomePage from './pages/HomePage';

import PublicLayout from './layouts/PublicLayout';
import ClientDashboardLayout from './layouts/ClientDashboardLayout';
import SellerDashboardLayout from './layouts/SellerDashboardLayout';
import AdminDashboardLayout from './layouts/AdminDashboardLayout';

import ProtectedRoute from './guards/ProtectedRoute';
import GuestRoute from './guards/GuestRoute';
import SellerShopRoute from './guards/SellerShopRoute';
import SellerShopCard from './components/seller/SellerShopCard';

import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import SellerRegisterPage from './pages/auth/SellerRegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import VerifyEmailPage from './pages/auth/VerifyEmailPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';

import CartPage from './pages/public/CartPage';
import FavoritesPage from './pages/public/FavoritesPage';
import ProductsPage from './pages/public/ProductsPage';
import PromoPage from './pages/public/PromoPage';
import ContactPage from './pages/public/ContactPage';
import AboutPage from './pages/public/AboutPage';
import CheckoutPage from './pages/public/CheckoutPage';
import OrderSuccessPage from './pages/public/OrderSuccessPage';
import NotFoundPage from './pages/public/NotFoundPage';
import ShopsPage from './pages/public/ShopsPage';
import ShopPage from './pages/public/ShopPage';

const ClientDashboardPage = lazy(() => import('./pages/client/ClientDashboardPage'));
const ClientProfilePage = lazy(() => import('./pages/client/ClientProfilePage'));
const ClientOrdersPage = lazy(() => import('./pages/client/ClientOrdersPage'));
const ClientReviewsPage = lazy(() => import('./pages/client/ClientReviewsPage'));
const ClientDisputesPage = lazy(() => import('./pages/client/ClientDisputesPage'));
const ClientFollowedShopsPage = lazy(() => import('./pages/client/ClientFollowedShopsPage'));
const ClientAddressesPage = lazy(() => import('./pages/client/ClientAddressesPage'));

const MessagesPage = lazy(() => import('./pages/shared/MessagesPage'));
const NotificationsPage = lazy(() => import('./pages/shared/NotificationsPage'));

const SellerDashboardPage = lazy(() => import('./pages/seller/SellerDashboardPage'));
const SellerProductsPage = lazy(() => import('./pages/seller/SellerProductsPage'));
const SellerProductFormPage = lazy(() => import('./pages/seller/SellerProductFormPage'));
const SellerOrdersPage = lazy(() => import('./pages/seller/SellerOrdersPage'));
const SellerStorePage = lazy(() => import('./pages/seller/SellerStorePage'));
const SellerEarningsPage = lazy(() => import('./pages/seller/SellerEarningsPage'));
const SellerReviewsPage = lazy(() => import('./pages/seller/SellerReviewsPage'));
const SellerDisputesPage = lazy(() => import('./pages/seller/SellerDisputesPage'));
const SellerSubscriptionPage = lazy(() => import('./pages/seller/SellerSubscriptionPage'));
const SellerPromotionsPage = lazy(() => import('./pages/seller/SellerPromotionsPage'));

const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminUserFormPage = lazy(() => import('./pages/admin/AdminUserFormPage'));
const AdminSellersPage = lazy(() => import('./pages/admin/AdminSellersPage'));
const AdminSellerDetailPage = lazy(() => import('./pages/admin/AdminSellerDetailPage'));
const AdminProductsPage = lazy(() => import('./pages/admin/AdminProductsPage'));
const AdminProductFormPage = lazy(() => import('./pages/admin/AdminProductFormPage'));
const AdminCategoriesPage = lazy(() => import('./pages/admin/AdminCategoriesPage'));
const AdminCategoryFormPage = lazy(() => import('./pages/admin/AdminCategoryFormPage'));
const AdminOrdersPage = lazy(() => import('./pages/admin/AdminOrdersPage'));
const AdminPaymentsPage = lazy(() => import('./pages/admin/AdminPaymentsPage'));
const AdminDisputesPage = lazy(() => import('./pages/admin/AdminDisputesPage'));
const AdminReportsPage = lazy(() => import('./pages/admin/AdminReportsPage'));
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage'));
const AdminPromotionsPage = lazy(() => import('./pages/admin/AdminPromotionsPage'));
const AdminShopsPage = lazy(() => import('./pages/admin/AdminShopsPage'));
const AdminModerationPage = lazy(() => import('./pages/admin/AdminModerationPage'));
const AdminBadgesPage = lazy(() => import('./pages/admin/AdminBadgesPage'));

import ProductDetailPage from './pages/ProductDetailPage';

const Router = env.routerMode === 'hash' ? HashRouter : BrowserRouter;

function App() {
  return (
    <ThemeProvider>
    <ErrorBoundary>
    <Router>
    <AuthProvider>
      <FavoritesProvider>
        <ScrollManager />
        <Toaster />
        <AnimatePresence mode="wait">
        <Suspense fallback={<LoadingState variant="page" label="Chargement de l'espace..." />}>
        <Routes>
          <Route path="/" element={<PublicLayout />}>
            <Route index element={<HomePage />} />
            <Route path="produits" element={<ProductsPage />} />
            <Route path="produits/:id" element={<ProductDetailPage />} />
            <Route path="panier" element={<CartPage />} />
            <Route path="favoris" element={<FavoritesPage />} />
            <Route path="promotions" element={<PromoPage />} />
            <Route path="boutiques" element={<ShopsPage />} />
            <Route path="boutiques/:slug" element={<ShopPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="a-propos" element={<AboutPage />} />
          </Route>

          <Route path="/connexion" element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/inscription" element={<GuestRoute><RegisterPage /></GuestRoute>} />
          <Route path="/inscription/vendeur" element={<GuestRoute><SellerRegisterPage /></GuestRoute>} />
          <Route path="/mot-de-passe-oublie" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
          <Route path="/verification-email" element={<VerifyEmailPage />} />
          <Route path="/reinitialiser-mot-de-passe" element={<GuestRoute><ResetPasswordPage /></GuestRoute>} />

          <Route path="/login" element={<Navigate to="/connexion" replace />} />
          <Route path="/register" element={<Navigate to="/inscription" replace />} />

          <Route path="/commande" element={<ProtectedRoute requiredRole="client"><PublicLayout /></ProtectedRoute>}>
            <Route path="validation" element={<CheckoutPage />} />
            <Route path="succes" element={<OrderSuccessPage />} />
          </Route>

          <Route path="/dashboard/client" element={<ProtectedRoute requiredRole="client"><ClientDashboardLayout /></ProtectedRoute>}>
            <Route index element={<ClientDashboardPage />} />
            <Route path="profil" element={<ClientProfilePage />} />
            <Route path="mes-commandes" element={<ClientOrdersPage />} />
            <Route path="mes-favoris" element={<Navigate to="/favoris" replace />} />
            <Route path="mes-adresses" element={<ClientAddressesPage />} />
            <Route path="mes-avis" element={<ClientReviewsPage />} />
            <Route path="mes-litiges" element={<ClientDisputesPage />} />
            <Route path="boutiques-suivies" element={<ClientFollowedShopsPage />} />
            <Route path="messages" element={<MessagesPage role="buyer" />} />
            <Route path="notifications" element={<NotificationsPage role="client" />} />
            <Route path="profile" element={<Navigate to="profil" replace />} />
            <Route path="orders" element={<Navigate to="mes-commandes" replace />} />
            <Route path="wishlist" element={<Navigate to="mes-favoris" replace />} />
            <Route path="addresses" element={<Navigate to="mes-adresses" replace />} />
          </Route>

          <Route path="/dashboard/vendeur" element={<ProtectedRoute requiredRole="seller"><SellerDashboardLayout /></ProtectedRoute>}>

            <Route path="boutique" element={<SellerStorePage />} />
            <Route path="messages" element={<MessagesPage role="seller" />} />
            <Route path="notifications" element={<NotificationsPage role="seller" />} />
            <Route path="profil" element={<ClientProfilePage title="Mon profil" subtitle="Informations personnelles, préférences de communication et sécurité du compte"><SellerShopCard /></ClientProfilePage>} />

            <Route element={<SellerShopRoute />}>
              <Route index element={<SellerDashboardPage />} />
              <Route path="produits" element={<SellerProductsPage />} />
              <Route path="produits/nouveau" element={<SellerProductFormPage />} />
              <Route path="produits/:id/modifier" element={<SellerProductFormPage />} />
              <Route path="commandes" element={<SellerOrdersPage />} />
              <Route path="revenus" element={<SellerEarningsPage />} />
              <Route path="avis" element={<SellerReviewsPage />} />
              <Route path="litiges" element={<SellerDisputesPage />} />
              <Route path="abonnement" element={<SellerSubscriptionPage />} />
              <Route path="promotions" element={<SellerPromotionsPage />} />
            </Route>

            <Route path="products" element={<Navigate to="produits" replace />} />
            <Route path="orders" element={<Navigate to="commandes" replace />} />
          </Route>

          <Route path="/dashboard/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboardLayout /></ProtectedRoute>}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="utilisateurs" element={<AdminUsersPage />} />
            <Route path="utilisateurs/nouveau" element={<AdminUserFormPage />} />
            <Route path="utilisateurs/:id/modifier" element={<AdminUserFormPage />} />
            <Route path="vendeurs" element={<AdminSellersPage />} />
            <Route path="vendeurs/:id" element={<AdminSellerDetailPage />} />
            <Route path="produits" element={<AdminProductsPage />} />
            <Route path="produits/nouveau" element={<AdminProductFormPage />} />
            <Route path="produits/:id/modifier" element={<AdminProductFormPage />} />
            <Route path="categories" element={<AdminCategoriesPage />} />
            <Route path="categories/nouveau" element={<AdminCategoryFormPage />} />
            <Route path="categories/:id/modifier" element={<AdminCategoryFormPage />} />
            <Route path="commandes" element={<AdminOrdersPage />} />
            <Route path="paiements" element={<AdminPaymentsPage />} />
            <Route path="litiges" element={<AdminDisputesPage />} />
            <Route path="rapports" element={<AdminReportsPage />} />
            <Route path="promotions" element={<AdminPromotionsPage />} />
            <Route path="parametres" element={<AdminSettingsPage />} />
            <Route path="boutiques" element={<AdminShopsPage />} />
            <Route path="moderation" element={<AdminModerationPage />} />
            <Route path="badges" element={<AdminBadgesPage />} />
            <Route path="users" element={<Navigate to="utilisateurs" replace />} />
            <Route path="sellers" element={<Navigate to="vendeurs" replace />} />
            <Route path="products" element={<Navigate to="produits" replace />} />
            <Route path="orders" element={<Navigate to="commandes" replace />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </Suspense>
        </AnimatePresence>
      </FavoritesProvider>
    </AuthProvider>
    </Router>
    </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;

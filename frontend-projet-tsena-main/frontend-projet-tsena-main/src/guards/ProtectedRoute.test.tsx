import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Route } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { renderWithProviders, LocationProbe } from '../test/render';
import { envelope, httpError, mockRoute, setMockLatency } from '../test/mock-backend';
import { adminUser, clientUser, sellerUser } from '../test/fixtures';
import { tokenStorage } from '../lib/token-storage';

const extraRoutes = (
  <>
    <Route path="/connexion" element={<LocationProbe />} />
    <Route path="/dashboard/client" element={<LocationProbe />} />
    <Route path="/dashboard/vendeur" element={<LocationProbe />} />
    <Route path="/dashboard/admin" element={<LocationProbe />} />
  </>
);

describe('ProtectedRoute — session réelle et rôles', () => {
  it('sans session → redirection immédiate vers /connexion', async () => {
    renderWithProviders(
      <ProtectedRoute>
        <p>Zone privée</p>
      </ProtectedRoute>,
      { route: '/dashboard/client/profil', extraRoutes },
    );
    expect(await screen.findByTestId('location')).toHaveTextContent('/connexion');
    expect(screen.queryByText('Zone privée')).not.toBeInTheDocument();
  });

  it('avec tokens → affiche le chargement pendant GET /auth/me, sans redirection prématurée', async () => {
    setMockLatency(150);
    mockRoute('GET', '/auth/me', envelope(clientUser));
    renderWithProviders(
      <ProtectedRoute requiredRole="client">
        <p>Zone privée</p>
      </ProtectedRoute>,
      { route: '/dashboard/client/profil', withSession: true, extraRoutes },
    );
    expect(screen.getByText(/vérification de votre session/i)).toBeInTheDocument();
    expect(screen.queryByTestId('location')).not.toBeInTheDocument();
    expect(await screen.findByText('Zone privée')).toBeInTheDocument();
  });

  it('session invalide côté backend (401) → jamais « connecté », redirection /connexion', async () => {
    mockRoute('GET', '/auth/me', httpError(401, 'Unauthorized'));
    mockRoute('POST', '/auth/refresh', httpError(401, 'Refresh invalide'));
    renderWithProviders(
      <ProtectedRoute>
        <p>Zone privée</p>
      </ProtectedRoute>,
      { route: '/dashboard/client/mes-commandes', withSession: true, extraRoutes },
    );
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/connexion'));
    expect(tokenStorage.hasSession()).toBe(false);
    expect(await screen.findByTestId('toast-error')).toHaveTextContent(/session/i);
  });

  it('backend injoignable pendant la restauration → pas de faux état connecté', async () => {
    mockRoute('GET', '/auth/me', { network: true });
    renderWithProviders(
      <ProtectedRoute>
        <p>Zone privée</p>
      </ProtectedRoute>,
      { route: '/dashboard/client/mes-commandes', withSession: true, extraRoutes },
    );
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/connexion'));
    expect(screen.queryByText('Zone privée')).not.toBeInTheDocument();
  });

  it.each([
    ['client', clientUser, '/dashboard/client'],
    ['seller', sellerUser, '/dashboard/vendeur'],
  ] as const)(
    'rôle %s sur une route admin → renvoyé vers son propre espace',
    async (_role, user, expected) => {
      mockRoute('GET', '/auth/me', envelope(user));
      renderWithProviders(
        <ProtectedRoute requiredRole="admin">
          <p>Admin</p>
        </ProtectedRoute>,
        { route: '/dashboard/admin/utilisateurs', withSession: true, extraRoutes },
      );
      await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(expected));
    },
  );

  it('admin avec le bon rôle → accès direct par URL', async () => {
    mockRoute('GET', '/auth/me', envelope(adminUser));
    renderWithProviders(
      <ProtectedRoute requiredRole="admin">
        <p>Admin</p>
      </ProtectedRoute>,
      { route: '/dashboard/admin/utilisateurs', withSession: true, extraRoutes },
    );
    expect(await screen.findByText('Admin')).toBeInTheDocument();
  });
});

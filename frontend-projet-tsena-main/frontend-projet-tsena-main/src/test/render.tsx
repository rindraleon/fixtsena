import { type ReactElement, type ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { FavoritesProvider } from '../context/FavoritesContext';
import Toaster from '../components/common/Toaster';
import { tokenStorage } from '../lib/token-storage';

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}

interface Options extends Omit<RenderOptions, 'wrapper'> {
  readonly route?: string;
  readonly withSession?: boolean;
  readonly queryClient?: QueryClient;
  readonly extraRoutes?: ReactNode;
}

export function renderWithProviders(ui: ReactElement, { route = '/', withSession = false, queryClient = createTestQueryClient(), extraRoutes, ...options }: Options = {}) {
  if (withSession) tokenStorage.setTokens({ accessToken: 'access-1', refreshToken: 'refresh-1' });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[route]}>
            <AuthProvider>
              <FavoritesProvider>
                <Toaster />
                <Routes>
                  <Route path="*" element={children} />
                  {extraRoutes}
                </Routes>
              </FavoritesProvider>
            </AuthProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </ThemeProvider>
    );
  }

  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) };
}

export { LocationProbe } from './LocationProbe';

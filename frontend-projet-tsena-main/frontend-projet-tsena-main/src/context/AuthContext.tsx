import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/auth.api';
import { onSessionExpired } from '../api/client';
import { tokenStorage } from '../lib/token-storage';
import { toast, TOAST_MESSAGES } from '../lib/toast';
import { PROTECTED_QUERY_ROOTS, queryKeys } from '../lib/query-keys';
import { getApiErrorMessage } from '../lib/api-error';
import { fullName, initials } from '../lib/format';
import { PERMISSIONS, type PermissionKey } from '../shared/data/permissions';
import type { ApiUser, LoginDto, RegisterDto } from '../types/api';
import { resolveAppRole, type AuthUser } from '../types/auth';
import ConfirmDialog from '../components/common/ConfirmDialog';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (dto: LoginDto) => Promise<AuthUser>;
  register: (dto: RegisterDto) => Promise<AuthUser>;
  requestLogout: () => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<AuthUser | null>;
  updateUser: (user: ApiUser) => void;
  hasPermission: (permission: PermissionKey) => boolean;
  hasRole: (...roles: string[]) => boolean;
}

export function toAuthUser(apiUser: ApiUser): AuthUser {
  return {
    ...apiUser,
    role: resolveAppRole(apiUser.roles),
    fullName: fullName(apiUser),
    initials: initials(apiUser),
  };
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>(() =>
    tokenStorage.hasSession() ? 'loading' : 'unauthenticated',
  );
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const userRef = useRef<AuthUser | null>(null);
  userRef.current = user;

  const clearLocalSession = useCallback(() => {
    tokenStorage.clear();
    setUser(null);
    setStatus('unauthenticated');
    queryClient.cancelQueries();
    queryClient.removeQueries({
      predicate: (query) => PROTECTED_QUERY_ROOTS.includes(String(query.queryKey[0])),
    });
    queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
  }, [queryClient]);

  const applyAuthenticatedUser = useCallback(
    (apiUser: ApiUser) => {
      const authUser = toAuthUser(apiUser);
      setUser(authUser);
      setStatus('authenticated');
      queryClient.setQueryData(queryKeys.auth.me(), apiUser);
      return authUser;
    },
    [queryClient],
  );

  const refreshSession = useCallback(async (): Promise<AuthUser | null> => {
    if (!tokenStorage.hasSession()) {
      clearLocalSession();
      return null;
    }
    try {
      const apiUser = await authApi.me();
      return applyAuthenticatedUser(apiUser);
    } catch (error) {
      clearLocalSession();
      const message = getApiErrorMessage(error);
      if (!tokenStorage.hasSession()) {
      } else {
        toast.error(message, { id: 'session-restore-failed' });
      }
      return null;
    }
  }, [applyAuthenticatedUser, clearLocalSession]);

  useEffect(() => {
    if (status === 'loading') {
      void refreshSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return onSessionExpired(() => {
      const wasAuthenticated = !!userRef.current;
      clearLocalSession();
      toast.error(TOAST_MESSAGES.auth.sessionExpired, { id: 'session-expired' });
      if (wasAuthenticated || tokenStorage.hasSession()) {
        navigate('/connexion', { replace: true, state: { from: location.pathname } });
      }
    });
  }, [clearLocalSession, navigate, location.pathname]);

  const login = useCallback(
    async (dto: LoginDto) => {
      const response = await authApi.login(dto);
      tokenStorage.setTokens(response.tokens);
      return applyAuthenticatedUser(response.user);
    },
    [applyAuthenticatedUser],
  );

  const register = useCallback(
    async (dto: RegisterDto) => {
      const response = await authApi.register(dto);
      tokenStorage.setTokens(response.tokens);
      return applyAuthenticatedUser(response.user);
    },
    [applyAuthenticatedUser],
  );

  const logout = useCallback(async () => {
    setLoggingOut(true);
    let serverLogoutFailed = false;
    try {
      if (tokenStorage.getAccessToken()) {
        await authApi.logout();
      }
    } catch {
      serverLogoutFailed = true;
    } finally {
      clearLocalSession();
      setLoggingOut(false);
      setLogoutDialogOpen(false);
    }
    navigate('/connexion', { replace: true });
    if (serverLogoutFailed) {
      toast.warning(TOAST_MESSAGES.auth.logoutError, { id: 'logout-server-failed' });
    } else {
      toast.success(TOAST_MESSAGES.auth.logoutSuccess, { id: 'logout-success' });
    }
  }, [clearLocalSession, navigate]);

  const requestLogout = useCallback(() => {
    setLogoutDialogOpen(true);
  }, []);

  const updateUser = useCallback(
    (apiUser: ApiUser) => {
      applyAuthenticatedUser(apiUser);
    },
    [applyAuthenticatedUser],
  );

  const hasPermission = useCallback(
    (permission: PermissionKey) => {
      if (!user) return false;
      const roles = PERMISSIONS[permission] as readonly string[];
      return roles.includes(user.role);
    },
    [user],
  );

  const hasRole = useCallback(
    (...roles: string[]) => {
      if (!user) return false;
      return roles.some((role) => user.roles.includes(role as ApiUser['roles'][number]) || user.role === role);
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isAuthenticated: status === 'authenticated' && !!user,
      isLoading: status === 'loading',
      login,
      register,
      requestLogout,
      logout,
      refreshSession,
      updateUser,
      hasPermission,
      hasRole,
    }),
    [user, status, login, register, requestLogout, logout, refreshSession, updateUser, hasPermission, hasRole],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={logoutDialogOpen}
        title="Voulez-vous vous déconnecter ?"
        description="Votre session actuelle sera fermée."
        confirmLabel="Se déconnecter"
        loadingLabel="Déconnexion..."
        cancelLabel="Annuler"
        variant="warning"
        loading={loggingOut}
        onConfirm={() => {
          if (!loggingOut) void logout();
        }}
        onCancel={() => {
          if (!loggingOut) setLogoutDialogOpen(false);
        }}
      />
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans un AuthProvider');
  return ctx;
}

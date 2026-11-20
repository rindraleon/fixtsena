import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canAccessRole, getDashboardRoute, hasAppRole } from '../shared/data/permissions';
import LoadingState from '../components/common/LoadingState';
import type { AppRole } from '../types/auth';

interface ProtectedRouteProps {
  readonly children: React.ReactNode;
  readonly requiredRole?: AppRole;
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingState variant="page" label="Vérification de votre session..." />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/connexion" state={{ from: location.pathname }} replace />;
  }

  if (requiredRole && !hasAppRole(user.roles, requiredRole)) {
    return <Navigate to={getDashboardRoute(user.role)} replace />;
  }

  if (requiredRole && !canAccessRole(user.roles, location.pathname)) {
    return <Navigate to={getDashboardRoute(user.role)} replace />;
  }

  return <>{children}</>;
}

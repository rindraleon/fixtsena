import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDashboardRoute } from '../shared/data/permissions';
import LoadingState from '../components/common/LoadingState';

export default function GuestRoute({ children }: { readonly children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingState variant="page" label="Chargement..." />
      </div>
    );
  }

  if (isAuthenticated && user) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== location.pathname ? from : getDashboardRoute(user.role)} replace />;
  }

  return <>{children}</>;
}

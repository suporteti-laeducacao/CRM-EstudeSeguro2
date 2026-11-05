import { ReactNode, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

type UserRole = 'admin' | 'gerente' | 'vendedor' | 'supervisor' | 'financeiro';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, loading, rolesLoading, userRoles } = useAuth();
  const navigate = useNavigate();

  const hasAccess = !allowedRoles || allowedRoles.length === 0
    ? true
    : userRoles.some((r) => allowedRoles.includes(r as UserRole));

  useEffect(() => {
    if (loading || rolesLoading) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    if (!hasAccess) {
      toast.error('Você não tem permissão para acessar esta página.');
      // Redirect vendedor (no dashboard access) to a safe default page
      const fallback = userRoles.includes('vendedor' as UserRole)
        ? '/vendas'
        : '/';
      navigate(fallback, { replace: true });
    }
  }, [user, loading, rolesLoading, navigate, hasAccess, userRoles]);

  if (loading || rolesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user || !hasAccess) {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;

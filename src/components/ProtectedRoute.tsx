import { Navigate } from 'react-router-dom';
import { useAppSelector } from '@/hooks/redux';
import Layout from './Layout';
import { UserRole } from '@/types';
import { normalizeRole } from '@/utils/rbac';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles?: UserRole[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
    const { isAuthenticated, user } = useAppSelector((state) => state.auth);

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && allowedRoles.length > 0) {
        const role = normalizeRole(user?.role);
        if (!allowedRoles.includes(role)) {
            return <Navigate to="/forbidden" replace />;
        }
    }

    return <Layout>{children}</Layout>;
};

export default ProtectedRoute;

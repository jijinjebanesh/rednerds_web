import { UserRole } from '@/types';

export type AppRouteKey =
    | 'dashboard'
    | 'projects'
    | 'batches'
    | 'products'
    | 'testing'
    | 'debugging'
    | 'repairs'
    | 'users';

export type AppPermission =
    | 'projects.create'
    | 'projects.update'
    | 'projects.delete'
    | 'batches.create'
    | 'batches.update'
    | 'batches.delete'
    | 'products.create'
    | 'products.update'
    | 'products.delete'
    | 'testing.create'
    | 'testing.update'
    | 'debugging.create'
    | 'debugging.update'
    | 'repairs.create'
    | 'repairs.update'
    | 'users.manage';

const ROLE_ROUTE_ACCESS: Record<UserRole, AppRouteKey[]> = {
    admin: ['dashboard', 'projects', 'batches', 'products', 'testing', 'debugging', 'repairs', 'users'],
    production_manager: ['dashboard', 'projects', 'batches', 'products', 'testing', 'debugging', 'repairs'],
    flash_operator: ['dashboard', 'products'],
    test_operator: ['dashboard', 'products', 'testing', 'debugging'],
    debug_technician: ['dashboard', 'products', 'testing', 'debugging'],
    repair_technician: ['dashboard', 'products', 'repairs'],
    manager: ['dashboard', 'projects', 'batches', 'products', 'testing', 'debugging', 'repairs'],
    operator: ['dashboard', 'products', 'testing'],
    technician: ['dashboard', 'products', 'debugging', 'repairs'],
    quality_engineer: ['dashboard', 'products', 'testing', 'debugging'],
    user: ['dashboard'],
};

const ROLE_PERMISSIONS: Record<UserRole, AppPermission[]> = {
    admin: [
        'projects.create',
        'projects.update',
        'projects.delete',
        'batches.create',
        'batches.update',
        'batches.delete',
        'products.create',
        'products.update',
        'products.delete',
        'testing.create',
        'testing.update',
        'debugging.create',
        'debugging.update',
        'repairs.create',
        'repairs.update',
        'users.manage',
    ],
    production_manager: [
        'projects.create',
        'projects.update',
        'batches.create',
        'batches.update',
        'products.create',
        'products.update',
        'testing.update',
        'debugging.update',
        'repairs.update',
    ],
    flash_operator: ['products.create', 'products.update'],
    test_operator: ['testing.create', 'testing.update'],
    debug_technician: ['debugging.create', 'debugging.update'],
    repair_technician: ['repairs.create', 'repairs.update'],
    manager: [
        'projects.create',
        'projects.update',
        'batches.create',
        'batches.update',
        'products.create',
        'products.update',
        'testing.update',
        'debugging.update',
        'repairs.update',
    ],
    operator: ['testing.create', 'testing.update'],
    technician: ['debugging.create', 'debugging.update', 'repairs.create', 'repairs.update'],
    quality_engineer: ['testing.create', 'testing.update', 'debugging.update'],
    user: [],
};

export const normalizeRole = (role?: string | null): UserRole => {
    if (!role) return 'operator';
    const normalized = role.toLowerCase();

    const match = (Object.keys(ROLE_ROUTE_ACCESS) as UserRole[]).find((key) => key === normalized);
    return match ?? 'operator';
};

export const hasRouteAccess = (role: UserRole | undefined, route: AppRouteKey): boolean => {
    const normalizedRole = normalizeRole(role);
    return ROLE_ROUTE_ACCESS[normalizedRole].includes(route);
};

export const hasPermission = (role: UserRole | undefined, permission: AppPermission): boolean => {
    const normalizedRole = normalizeRole(role);
    return ROLE_PERMISSIONS[normalizedRole].includes(permission);
};

export const getAccessibleRoutes = (role: UserRole | undefined): AppRouteKey[] => {
    return ROLE_ROUTE_ACCESS[normalizeRole(role)];
};

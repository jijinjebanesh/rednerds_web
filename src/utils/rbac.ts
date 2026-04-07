import { UserRole } from '@/types';

export type AppRouteKey =
    | 'dashboard'
    | 'projects'
    | 'batches'
    | 'products'
    | 'testing'
    | 'debugging'
    | 'repairs'
    | 'quality_grading'
    | 'accessory_workflows'
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
    | 'accessory.target.create'
    | 'accessory.testing.log'
    | 'accessory.debug.log'
    | 'accessory.qc.log'
    | 'users.manage';

const ROLE_ROUTE_ACCESS: Record<UserRole, AppRouteKey[]> = {
    admin: ['dashboard', 'projects', 'batches', 'products', 'testing', 'debugging', 'repairs', 'quality_grading', 'accessory_workflows', 'users'],
    production_manager: ['dashboard', 'projects', 'batches', 'products', 'testing', 'debugging', 'repairs', 'accessory_workflows'],
    flash_operator: ['dashboard', 'products'],
    test_operator: ['dashboard', 'products', 'testing', 'debugging', 'accessory_workflows'],
    debug_technician: ['dashboard', 'products', 'testing', 'debugging', 'accessory_workflows'],
    repair_technician: ['dashboard', 'products', 'repairs'],
    manager: ['dashboard', 'projects', 'batches', 'products', 'testing', 'debugging', 'repairs', 'accessory_workflows'],
    operator: ['dashboard', 'products', 'testing'],
    technician: ['dashboard', 'products', 'debugging', 'repairs', 'accessory_workflows'],
    quality_engineer: ['dashboard', 'products', 'testing', 'debugging', 'quality_grading', 'accessory_workflows'],
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
        'accessory.target.create',
        'accessory.testing.log',
        'accessory.debug.log',
        'accessory.qc.log',
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
        'accessory.target.create',
    ],
    flash_operator: ['products.create', 'products.update'],
    test_operator: ['testing.create', 'testing.update', 'accessory.testing.log'],
    debug_technician: ['debugging.create', 'debugging.update', 'accessory.debug.log'],
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
        'accessory.target.create',
    ],
    operator: ['testing.create', 'testing.update'],
    technician: ['debugging.create', 'debugging.update', 'repairs.create', 'repairs.update', 'accessory.debug.log'],
    quality_engineer: ['testing.create', 'testing.update', 'debugging.update', 'accessory.qc.log'],
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

import { ProductStage, ProductStatus, ProjectType, UserRole } from '@/types';

export const PROJECT_STATUS_OPTIONS = ['active', 'discontinued', 'development'] as const;
export const PROJECT_TYPE_OPTIONS: ProjectType[] = ['device', 'accessory'];
export const BATCH_STATUS_OPTIONS = ['planned', 'in_progress', 'completed', 'cancelled'] as const;
export const TEST_RESULT_OPTIONS = ['pass', 'fail', 'partial'] as const;
export const DEBUG_RESOLUTION_OPTIONS = ['resolved', 'unresolved', 'partially_resolved', 'scrapped'] as const;
export const REPAIR_STATUS_OPTIONS = ['received', 'in_progress', 'resolved', 'returned_to_customer', 'unrepairable'] as const;
export const REPAIR_SESSION_RESOLUTION_OPTIONS = ['resolved', 'unresolved', 'partially_resolved', 'awaiting_parts'] as const;

export const PRODUCT_STAGE_OPTIONS: ProductStage[] = [
    'flashing',
    'testing',
    'debugging',
    'qc',
    'stock',
    'shipped',
    'repair',
    'customer',
];

export const PRODUCT_STATUS_OPTIONS: ProductStatus[] = ['active', 'shipped', 'repair', 'returned', 'scrapped'];

export const BACKEND_PRODUCT_STAGE_OPTIONS: Exclude<ProductStage, 'debugging'>[] = [
    'flashing',
    'testing',
    'qc',
    'stock',
    'shipped',
    'repair',
    'customer',
];

export const BACKEND_PRODUCT_STATUS_OPTIONS: Exclude<ProductStatus, 'scrapped'>[] = ['active', 'shipped', 'repair', 'returned'];

export const USER_ROLE_OPTIONS: UserRole[] = [
    'admin',
    'production_manager',
    'flash_operator',
    'test_operator',
    'debug_technician',
    'repair_technician',
    'manager',
    'operator',
    'technician',
    'quality_engineer',
    'user',
];

export const toBackendStage = (stage: ProductStage): Exclude<ProductStage, 'debugging'> => {
    if (stage === 'debugging') {
        return 'testing';
    }

    return stage;
};

export const toBackendStatus = (status: ProductStatus): Exclude<ProductStatus, 'scrapped'> => {
    if (status === 'scrapped') {
        return 'returned';
    }

    return status;
};

export const toTitle = (value: string): string => {
    return value
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
};

export const toDateInputValue = (value?: Date | string | null): string => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
};



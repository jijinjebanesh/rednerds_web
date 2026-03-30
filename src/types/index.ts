// Authentication & User Types
export type UserRole =
    | 'admin'
    | 'production_manager'
    | 'flash_operator'
    | 'test_operator'
    | 'debug_technician'
    | 'repair_technician'
    | 'manager'
    | 'operator'
    | 'technician'
    | 'quality_engineer'
    | 'user';

export interface User {
    _id: string;
    email: string;
    username: string;
    role: UserRole;
    name?: string;
    department?: string;
    phone?: string;
    assigned_station?: string | null;
    permissions?: string[];
    is_active?: boolean;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    created_at?: Date | string;
    updated_at?: Date | string;
}

export interface AuthResponse {
    token: string;
    refreshToken: string;
    user: User;
    expiresIn: number;
}

export interface LoginRequest {
    email: string;
    password: string;
}

// Project Types
export interface Project {
    _id: string;
    name: string;
    slug: string;
    description?: string;
    status: 'active' | 'discontinued' | 'development';
    createdAt?: Date | string;
    updatedAt?: Date | string;
    created_at?: Date | string;
    updated_at?: Date | string;
}

// Batch Types
export interface Batch {
    _id: string;
    project_id: string;
    project_slug?: string;
    model_variant: string;
    planned_qty: number;
    produced_qty: number;
    start_date: Date | string;
    end_date?: Date | string;
    status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
    notes?: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    created_at?: Date | string;
    updated_at?: Date | string;
}

export type ProductStage = 'flashing' | 'testing' | 'debugging' | 'qc' | 'stock' | 'shipped' | 'repair' | 'customer';
export type ProductStatus = 'shipped' | 'repair' | 'returned' | 'active' | 'scrapped';

// Product Types
export interface Product {
    _id: string;
    product_id: string;
    mac_address: string;
    batch_id: string;
    project_id: string;
    project_slug: string;
    model_variant: string;
    current_stage: ProductStage;
    manufactured_at: Date | string;
    status: ProductStatus;
    customer_id?: string;
    warranty_expiry?: Date | string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    created_at?: Date | string;
    updated_at?: Date | string;
}

// Test Log Types
export interface TestLog {
    _id: string;
    product_id: string;
    mac_address: string;
    result: 'pass' | 'fail' | 'partial';
    tested_at: Date | string;
    station: string;
    operator_id: string;
    symptoms?: string | null;
    notes?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    created_at?: Date | string;
    updated_at?: Date | string;
}

// Debug Session Types
export interface DebugSession {
    _id: string;
    test_log_id: string;
    product_id: string;
    mac_address: string;
    issue_identified: string;
    root_cause: string;
    action_taken: string;
    resolution_status: 'resolved' | 'unresolved' | 'partially_resolved' | 'scrapped';
    debugged_at: Date | string;
    technician_id: string;
    re_test_required: boolean;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    created_at?: Date | string;
    updated_at?: Date | string;
}

// Customer Repair Types
export interface CustomerRepair {
    _id: string;
    product_id: string;
    mac_address: string;
    customer_id: string;
    received_date: Date | string;
    complaint: string;
    in_warranty: boolean;
    status: 'received' | 'in_progress' | 'resolved' | 'returned_to_customer' | 'unrepairable';
    closed_date?: Date | string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    created_at?: Date | string;
    updated_at?: Date | string;
}

// Repair Session Types
export interface RepairSession {
    _id: string;
    repair_id: string;
    product_id: string;
    issue_identified: string;
    root_cause: string;
    action_taken: string;
    parts_replaced: string[];
    resolution_status: 'resolved' | 'unresolved' | 'partially_resolved' | 'awaiting_parts';
    sessioned_at: Date | string;
    technician_id: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    created_at?: Date | string;
    updated_at?: Date | string;
}

// API Response Types
export interface ApiResponse<T> {
    message?: string;
    data: T;
    error?: string;
    status?: number;
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

// Form Types
export interface CreateProjectForm {
    _id?: string;
    name: string;
    slug: string;
    description?: string;
    status: 'active' | 'discontinued' | 'development';
}

export interface CreateBatchForm {
    _id?: string;
    project_id: string;
    model_variant: string;
    planned_qty: number;
    start_date: Date | string;
    end_date?: Date | string;
    notes?: string;
    status?: 'planned' | 'in_progress' | 'completed' | 'cancelled';
}

export interface CreateProductForm {
    mac_address: string;
    batch_id: string;
    project_id: string;
    project_slug: string;
    model_variant: string;
    manufactured_at: Date | string;
    current_stage?: ProductStage;
    status?: ProductStatus;
}

export interface CreateTestLogForm {
    product_id: string;
    mac_address: string;
    station: string;
    operator_id: string;
    result: 'pass' | 'fail' | 'partial';
    symptoms?: string;
    notes?: string;
}


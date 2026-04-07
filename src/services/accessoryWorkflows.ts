import { apiClient } from './api';
import { ApiResponse, PaginatedResponse } from '@/types';

export interface AccessoryWorkflowMetrics {
    target_qty: number;
    tested_pass_qty: number;
    tested_fail_qty: number;
    tested_total_qty: number;
    remaining_for_testing_qty: number;
    debug_fixed_qty: number;
    debug_scrapped_qty: number;
    debug_total_qty: number;
    failed_backlog_qty: number;
    qc_grade_a_qty: number;
    qc_grade_b_qty: number;
    qc_grade_c_qty: number;
    qc_grade_d_qty: number;
    qc_scrap_qty: number;
    qc_total_graded_qty: number;
    qc_backlog_qty: number;
}

export interface AccessoryWorkflow {
    _id: string;
    project_id: string;
    project_name?: string | null;
    project_slug?: string | null;
    project_type?: 'device' | 'accessory' | null;
    accessory_name: string;
    target_qty: number;
    notes?: string;
    is_active: boolean;
    created_at?: Date | string;
    updated_at?: Date | string;
    metrics: AccessoryWorkflowMetrics;
}

export interface AccessoryTestingLogPayload {
    passed_qty: number;
    failed_qty: number;
    notes?: string;
}

export interface AccessoryDebugLogPayload {
    fixed_qty: number;
    scrapped_qty: number;
    notes?: string;
}

export interface AccessoryQcLogPayload {
    grade_a_qty: number;
    grade_b_qty: number;
    grade_c_qty: number;
    grade_d_qty: number;
    scrap_qty: number;
    notes?: string;
}

interface AccessoryWorkflowListResponse extends ApiResponse<AccessoryWorkflow[]> {
    pagination?: {
        total?: number;
        skip?: number;
        limit?: number;
    };
}

const toPaginatedWorkflows = (
    payload: AccessoryWorkflowListResponse,
    fallbackPage: number,
    fallbackLimit: number
): PaginatedResponse<AccessoryWorkflow> => {
    const items = Array.isArray(payload.data) ? payload.data : [];
    const total = payload.pagination?.total ?? items.length;
    const limit = payload.pagination?.limit ?? fallbackLimit;
    const skip = payload.pagination?.skip ?? (fallbackPage - 1) * limit;
    const page = limit > 0 ? Math.floor(skip / limit) + 1 : fallbackPage;

    return {
        data: items,
        total,
        page,
        limit,
        totalPages: limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1,
    };
};

export const accessoryWorkflowService = {
    async getWorkflows(
        page = 1,
        limit = 50,
        filters?: {
            project_id?: string;
            is_active?: boolean;
        }
    ): Promise<PaginatedResponse<AccessoryWorkflow>> {
        const params = new URLSearchParams();
        params.append('skip', String((page - 1) * limit));
        params.append('limit', String(limit));
        if (filters?.project_id) params.append('project_id', filters.project_id);
        if (typeof filters?.is_active === 'boolean') params.append('is_active', String(filters.is_active));

        const response = await apiClient.get<AccessoryWorkflowListResponse>(`/accessory-workflows?${params}`);
        return toPaginatedWorkflows(response.data, page, limit);
    },

    async createWorkflow(payload: {
        project_id: string;
        accessory_name: string;
        target_qty: number;
        notes?: string;
    }): Promise<AccessoryWorkflow> {
        const response = await apiClient.post<ApiResponse<AccessoryWorkflow>>('/accessory-workflows', payload);
        return response.data.data;
    },

    async getWorkflowSummary(id: string): Promise<{
        workflow: AccessoryWorkflow;
        metrics: AccessoryWorkflowMetrics;
        recent_testing_logs: any[];
        recent_debug_logs: any[];
        recent_qc_logs: any[];
    }> {
        const response = await apiClient.get<ApiResponse<any>>(`/accessory-workflows/${id}/summary`);
        return response.data.data;
    },

    async createTestingLog(id: string, payload: AccessoryTestingLogPayload): Promise<void> {
        await apiClient.post(`/accessory-workflows/${id}/testing-logs`, payload);
    },

    async createDebugLog(id: string, payload: AccessoryDebugLogPayload): Promise<void> {
        await apiClient.post(`/accessory-workflows/${id}/debug-logs`, payload);
    },

    async createQcLog(id: string, payload: AccessoryQcLogPayload): Promise<void> {
        await apiClient.post(`/accessory-workflows/${id}/qc-logs`, payload);
    },
};

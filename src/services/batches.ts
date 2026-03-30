import { apiClient } from './api';
import { Batch, ApiResponse, PaginatedResponse, CreateBatchForm } from '@/types';
import { normalizePaginated } from './pagination';

interface BatchListResponse extends ApiResponse<Batch[]> {
    pagination?: {
        total?: number;
        skip?: number;
        limit?: number;
    };
}

export const batchService = {
    async createBatch(formData: CreateBatchForm): Promise<Batch> {
        const response = await apiClient.post<ApiResponse<Batch>>('/batches', formData);
        return response.data.data;
    },

    async getBatches(
        page = 1,
        limit = 50,
        filters?: { project_id?: string; status?: string }
    ): Promise<PaginatedResponse<Batch>> {
        const params = new URLSearchParams();
        params.append('skip', String((page - 1) * limit));
        params.append('limit', String(limit));
        if (filters?.project_id) params.append('project_id', filters.project_id);
        if (filters?.status) params.append('status', filters.status);

        const response = await apiClient.get<BatchListResponse>(`/batches?${params}`);
        return normalizePaginated(response.data, page, limit);
    },

    async getBatchById(id: string): Promise<Batch> {
        const response = await apiClient.get<ApiResponse<Batch>>(`/batches/${id}`);
        return response.data.data;
    },

    async getBatchesByProject(projectId: string, page = 1, limit = 50): Promise<PaginatedResponse<Batch>> {
        const params = new URLSearchParams();
        params.append('skip', String((page - 1) * limit));
        params.append('limit', String(limit));

        const response = await apiClient.get<BatchListResponse>(`/batches/project/${projectId}?${params}`);
        return normalizePaginated(response.data, page, limit);
    },

    async updateBatch(
        id: string,
        formData: Partial<CreateBatchForm> & {
            produced_qty?: number;
            status?: Batch['status'];
        }
    ): Promise<Batch> {
        const response = await apiClient.put<ApiResponse<Batch>>(`/batches/${id}`, formData);
        return response.data.data;
    },

    async updateProductionQty(id: string, produced_qty: number): Promise<Batch> {
        const response = await apiClient.put<ApiResponse<Batch>>(`/batches/${id}/production`, {
            produced_qty,
        });
        return response.data.data;
    },

    async deleteBatch(id: string): Promise<void> {
        await apiClient.delete(`/batches/${id}`);
    },
};

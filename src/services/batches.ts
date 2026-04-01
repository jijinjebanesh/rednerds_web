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

const mapBatch = (payload: any): Batch => {
    const source = payload ?? {};
    return {
        _id: String(source._id ?? source.batch_id ?? source.id ?? ''),
        batch_name: String(source.batch_name ?? source.name ?? ''),
        project_id: String(source.project_id ?? source.projectId ?? ''),
        project_slug: source.project_slug ?? source.projectSlug,
        model_variant: String(source.model_variant ?? ''),
        planned_qty: Number(source.planned_qty ?? 0),
        produced_qty: Number(source.produced_qty ?? 0),
        start_date: source.start_date ?? source.startDate ?? new Date().toISOString(),
        end_date: source.end_date ?? source.endDate,
        status: source.status ?? 'planned',
        notes: source.notes,
        createdAt: source.createdAt ?? source.created_at,
        updatedAt: source.updatedAt ?? source.updated_at,
        created_at: source.created_at ?? source.createdAt,
        updated_at: source.updated_at ?? source.updatedAt,
    };
};

const toPaginatedBatches = (
    payload: BatchListResponse,
    fallbackPage: number,
    fallbackLimit: number
): PaginatedResponse<Batch> => {
    const normalized = normalizePaginated(payload, fallbackPage, fallbackLimit);
    return {
        ...normalized,
        data: normalized.data.map(mapBatch),
    };
};

export const batchService = {
    async createBatch(formData: CreateBatchForm): Promise<Batch> {
        const response = await apiClient.post<ApiResponse<Batch>>('/batches', formData);
        return mapBatch(response.data.data);
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
        return toPaginatedBatches(response.data, page, limit);
    },

    async getBatchById(id: string): Promise<Batch> {
        const response = await apiClient.get<ApiResponse<Batch>>(`/batches/${id}`);
        return mapBatch(response.data.data);
    },

    async getBatchesByProject(projectId: string, page = 1, limit = 50): Promise<PaginatedResponse<Batch>> {
        const params = new URLSearchParams();
        params.append('skip', String((page - 1) * limit));
        params.append('limit', String(limit));

        const response = await apiClient.get<BatchListResponse>(`/batches/project/${projectId}?${params}`);
        return toPaginatedBatches(response.data, page, limit);
    },

    async updateBatch(
        id: string,
        formData: Partial<CreateBatchForm> & {
            produced_qty?: number;
            status?: Batch['status'];
        }
    ): Promise<Batch> {
        const response = await apiClient.put<ApiResponse<Batch>>(`/batches/${id}`, formData);
        return mapBatch(response.data.data);
    },

    async updateProductionQty(id: string, produced_qty: number): Promise<Batch> {
        const response = await apiClient.put<ApiResponse<Batch>>(`/batches/${id}/production`, {
            produced_qty,
        });
        return mapBatch(response.data.data);
    },

    async deleteBatch(id: string): Promise<void> {
        await apiClient.delete(`/batches/${id}`);
    },
};

import { apiClient } from './api';
import { Product, ApiResponse, PaginatedResponse, CreateProductForm, ProductStage, ProductStatus } from '@/types';
import { normalizePaginated } from './pagination';

interface ProductListResponse extends ApiResponse<Product[]> {
    pagination?: {
        total?: number;
        skip?: number;
        limit?: number;
    };
}

interface GroupedStats {
    _id: string;
    count: number;
}

export interface ProductStats {
    byStage: GroupedStats[];
    byStatus: GroupedStats[];
    total: Array<{ total: number }>;
}

export const productService = {
    async createProduct(formData: CreateProductForm): Promise<Product> {
        const response = await apiClient.post<ApiResponse<Product>>('/products', formData);
        return response.data.data;
    },

    async getProducts(
        page = 1,
        limit = 50,
        filters?: {
            project_id?: string;
            batch_id?: string;
            status?: string;
            current_stage?: string;
            customer_id?: string;
        }
    ): Promise<PaginatedResponse<Product>> {
        const params = new URLSearchParams();
        params.append('skip', String((page - 1) * limit));
        params.append('limit', String(limit));
        if (filters?.project_id) params.append('project_id', filters.project_id);
        if (filters?.batch_id) params.append('batch_id', filters.batch_id);
        if (filters?.status) params.append('status', filters.status);
        if (filters?.current_stage) params.append('current_stage', filters.current_stage);
        if (filters?.customer_id) params.append('customer_id', filters.customer_id);

        const response = await apiClient.get<ProductListResponse>(`/products?${params}`);
        return normalizePaginated(response.data, page, limit);
    },

    async getProductById(id: string): Promise<Product> {
        const response = await apiClient.get<ApiResponse<Product>>(`/products/${id}`);
        return response.data.data;
    },

    async getProductByMac(mac: string): Promise<Product> {
        const response = await apiClient.get<ApiResponse<Product>>(`/products/mac/${mac}`);
        return response.data.data;
    },

    async getProductsByBatch(batchId: string, page = 1, limit = 50): Promise<PaginatedResponse<Product>> {
        const params = new URLSearchParams();
        params.append('skip', String((page - 1) * limit));
        params.append('limit', String(limit));

        const response = await apiClient.get<ProductListResponse>(`/products/batch/${batchId}?${params}`);
        return normalizePaginated(response.data, page, limit);
    },

    async getProductsByProject(projectId: string, page = 1, limit = 50): Promise<PaginatedResponse<Product>> {
        const params = new URLSearchParams();
        params.append('skip', String((page - 1) * limit));
        params.append('limit', String(limit));

        const response = await apiClient.get<ProductListResponse>(`/products/project/${projectId}?${params}`);
        return normalizePaginated(response.data, page, limit);
    },

    async updateProductStage(
        id: string,
        payload: {
            current_stage?: ProductStage | string;
            status?: ProductStatus | string;
        }
    ): Promise<Product> {
        const response = await apiClient.put<ApiResponse<Product>>(`/products/${id}/stage`, payload);
        return response.data.data;
    },

    async assignToCustomer(id: string, customerId: string, warranty_expiry?: Date | string): Promise<Product> {
        const response = await apiClient.put<ApiResponse<Product>>(`/products/${id}/customer`, {
            customer_id: customerId,
            warranty_expiry,
        });
        return response.data.data;
    },

    async updateProduct(id: string, formData: Partial<Product>): Promise<Product> {
        const response = await apiClient.put<ApiResponse<Product>>(`/products/${id}`, formData);
        return response.data.data;
    },

    async getProjectStats(projectId: string): Promise<ProductStats> {
        const response = await apiClient.get<ApiResponse<ProductStats>>(`/products/stats/project/${projectId}`);
        return response.data.data;
    },

    async getBatchStats(batchId: string): Promise<ProductStats> {
        const response = await apiClient.get<ApiResponse<ProductStats>>(`/products/stats/batch/${batchId}`);
        return response.data.data;
    },

    async deleteProduct(id: string): Promise<void> {
        await apiClient.delete(`/products/${id}`);
    },
};


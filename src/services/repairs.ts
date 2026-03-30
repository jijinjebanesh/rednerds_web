import { apiClient } from './api';
import { CustomerRepair, RepairSession, ApiResponse, PaginatedResponse } from '@/types';
import { normalizePaginated } from './pagination';

interface ListResponse<T> extends ApiResponse<T[]> {
    status?: number;
    pagination?: {
        total?: number;
        skip?: number;
        limit?: number;
        page?: number;
        pages?: number;
    };
}

export interface CreateCustomerRepairForm {
    product_id: string;
    mac_address: string;
    customer_id: string;
    complaint: string;
    in_warranty: boolean;
    received_date: Date | string;
}

export interface CreateRepairSessionForm {
    repair_id: string;
    product_id: string;
    issue_identified: string;
    root_cause: string;
    action_taken: string;
    parts_replaced: string[];
    resolution_status: 'resolved' | 'unresolved' | 'partially_resolved' | 'awaiting_parts';
    technician_id: string;
}

export const customerRepairService = {
    async createRepair(formData: CreateCustomerRepairForm): Promise<CustomerRepair> {
        const response = await apiClient.post<ApiResponse<CustomerRepair>>('/customer-repairs', {
            ...formData,
            received_date: new Date(formData.received_date),
        });
        return response.data.data;
    },

    async getRepairs(page = 1, limit = 50, status?: string): Promise<PaginatedResponse<CustomerRepair>> {
        const params = new URLSearchParams();
        params.append('page', String(page));
        params.append('limit', String(limit));
        if (status) params.append('status', status);

        const response = await apiClient.get<ListResponse<CustomerRepair>>(`/customer-repairs?${params}`);
        return normalizePaginated(response.data, page, limit);
    },

    async getRepairById(id: string): Promise<CustomerRepair> {
        const response = await apiClient.get<ApiResponse<CustomerRepair>>(`/customer-repairs/${id}`);
        return response.data.data;
    },

    async getRepairsByProduct(productId: string, page = 1, limit = 50): Promise<PaginatedResponse<CustomerRepair>> {
        const params = new URLSearchParams();
        params.append('page', String(page));
        params.append('limit', String(limit));

        const response = await apiClient.get<ListResponse<CustomerRepair>>(`/customer-repairs/product/${productId}?${params}`);
        return normalizePaginated(response.data, page, limit);
    },

    async getRepairsByCustomer(
        customerId: string,
        page = 1,
        limit = 50,
        status?: string
    ): Promise<PaginatedResponse<CustomerRepair>> {
        const params = new URLSearchParams();
        params.append('page', String(page));
        params.append('limit', String(limit));
        if (status) params.append('status', status);

        const response = await apiClient.get<ListResponse<CustomerRepair>>(`/customer-repairs/customer/${customerId}?${params}`);
        return normalizePaginated(response.data, page, limit);
    },

    async updateRepair(id: string, formData: Partial<CustomerRepair>): Promise<CustomerRepair> {
        const response = await apiClient.put<ApiResponse<CustomerRepair>>(`/customer-repairs/${id}`, formData);
        return response.data.data;
    },

    async updateRepairStatus(id: string, status: CustomerRepair['status']): Promise<CustomerRepair> {
        const response = await apiClient.put<ApiResponse<CustomerRepair>>(`/customer-repairs/${id}/status`, {
            status,
        });
        return response.data.data;
    },

    async deleteRepair(id: string): Promise<void> {
        await apiClient.delete(`/customer-repairs/${id}`);
    },
};

export const repairSessionService = {
    async createRepairSession(formData: CreateRepairSessionForm): Promise<RepairSession> {
        const response = await apiClient.post<ApiResponse<RepairSession>>('/repair-sessions', {
            ...formData,
            sessioned_at: new Date(),
        });
        return response.data.data;
    },

    async getRepairSessions(page = 1, limit = 50): Promise<PaginatedResponse<RepairSession>> {
        const params = new URLSearchParams();
        params.append('page', String(page));
        params.append('limit', String(limit));

        const response = await apiClient.get<ListResponse<RepairSession>>(`/repair-sessions?${params}`);
        return normalizePaginated(response.data, page, limit);
    },

    async getRepairSessionById(id: string): Promise<RepairSession> {
        const response = await apiClient.get<ApiResponse<RepairSession>>(`/repair-sessions/${id}`);
        return response.data.data;
    },

    async getRepairSessionsByRepair(repairId: string, page = 1, limit = 50): Promise<PaginatedResponse<RepairSession>> {
        const params = new URLSearchParams();
        params.append('page', String(page));
        params.append('limit', String(limit));

        const response = await apiClient.get<ListResponse<RepairSession>>(`/repair-sessions/repair/${repairId}?${params}`);
        return normalizePaginated(response.data, page, limit);
    },

    async getRepairSessionsByProduct(productId: string, page = 1, limit = 50): Promise<PaginatedResponse<RepairSession>> {
        const params = new URLSearchParams();
        params.append('page', String(page));
        params.append('limit', String(limit));

        const response = await apiClient.get<ListResponse<RepairSession>>(`/repair-sessions/product/${productId}?${params}`);
        return normalizePaginated(response.data, page, limit);
    },

    async updateRepairSession(id: string, formData: Partial<RepairSession>): Promise<RepairSession> {
        const response = await apiClient.put<ApiResponse<RepairSession>>(`/repair-sessions/${id}`, formData);
        return response.data.data;
    },

    async deleteRepairSession(id: string): Promise<void> {
        await apiClient.delete(`/repair-sessions/${id}`);
    },
};


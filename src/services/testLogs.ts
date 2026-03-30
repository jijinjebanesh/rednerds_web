import { apiClient } from './api';
import { TestLog, ApiResponse, PaginatedResponse, CreateTestLogForm, DebugSession } from '@/types';
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

export const testLogService = {
    async createTestLog(formData: CreateTestLogForm): Promise<TestLog> {
        const response = await apiClient.post<ApiResponse<TestLog>>('/test-logs', {
            ...formData,
            tested_at: new Date(),
        });
        return response.data.data;
    },

    async getTestLogs(page = 1, limit = 50): Promise<PaginatedResponse<TestLog>> {
        const params = new URLSearchParams();
        params.append('page', String(page));
        params.append('limit', String(limit));

        const response = await apiClient.get<ListResponse<TestLog>>(`/test-logs?${params}`);
        return normalizePaginated(response.data, page, limit);
    },

    async getTestLogById(id: string): Promise<TestLog> {
        const response = await apiClient.get<ApiResponse<TestLog>>(`/test-logs/${id}`);
        return response.data.data;
    },

    async getTestLogsByProduct(productId: string, page = 1, limit = 50): Promise<PaginatedResponse<TestLog>> {
        const params = new URLSearchParams();
        params.append('page', String(page));
        params.append('limit', String(limit));

        const response = await apiClient.get<ListResponse<TestLog>>(`/test-logs/product/${productId}?${params}`);
        return normalizePaginated(response.data, page, limit);
    },

    async getTestLogsByStation(station: string, page = 1, limit = 50, result?: string): Promise<PaginatedResponse<TestLog>> {
        const params = new URLSearchParams();
        params.append('page', String(page));
        params.append('limit', String(limit));
        if (result) params.append('result', result);

        const response = await apiClient.get<ListResponse<TestLog>>(`/test-logs/station/${station}?${params}`);
        return normalizePaginated(response.data, page, limit);
    },

    async getTestLogsByResult(result: string, page = 1, limit = 50): Promise<PaginatedResponse<TestLog>> {
        const params = new URLSearchParams();
        params.append('page', String(page));
        params.append('limit', String(limit));

        const response = await apiClient.get<ListResponse<TestLog>>(`/test-logs/result/${result}?${params}`);
        return normalizePaginated(response.data, page, limit);
    },

    async updateTestLog(id: string, formData: Partial<TestLog>): Promise<TestLog> {
        const response = await apiClient.put<ApiResponse<TestLog>>(`/test-logs/${id}`, formData);
        return response.data.data;
    },

    async deleteTestLog(id: string): Promise<void> {
        await apiClient.delete(`/test-logs/${id}`);
    },
};

export const debugSessionService = {
    async createDebugSession(formData: Omit<DebugSession, '_id' | 'createdAt' | 'updatedAt'>): Promise<DebugSession> {
        const response = await apiClient.post<ApiResponse<DebugSession>>('/debug-sessions', {
            ...formData,
            debugged_at: new Date(),
        });
        return response.data.data;
    },

    async getDebugSessions(page = 1, limit = 50): Promise<PaginatedResponse<DebugSession>> {
        const params = new URLSearchParams();
        params.append('page', String(page));
        params.append('limit', String(limit));

        const response = await apiClient.get<ListResponse<DebugSession>>(`/debug-sessions?${params}`);
        return normalizePaginated(response.data, page, limit);
    },

    async getDebugSessionById(id: string): Promise<DebugSession> {
        const response = await apiClient.get<ApiResponse<DebugSession>>(`/debug-sessions/${id}`);
        return response.data.data;
    },

    async getDebugSessionsByTestLog(testLogId: string, page = 1, limit = 50): Promise<PaginatedResponse<DebugSession>> {
        const params = new URLSearchParams();
        params.append('page', String(page));
        params.append('limit', String(limit));

        const response = await apiClient.get<ListResponse<DebugSession>>(`/debug-sessions/test-log/${testLogId}?${params}`);
        return normalizePaginated(response.data, page, limit);
    },

    async getDebugSessionsByProduct(productId: string, page = 1, limit = 50): Promise<PaginatedResponse<DebugSession>> {
        const params = new URLSearchParams();
        params.append('page', String(page));
        params.append('limit', String(limit));

        const response = await apiClient.get<ListResponse<DebugSession>>(`/debug-sessions/product/${productId}?${params}`);
        return normalizePaginated(response.data, page, limit);
    },

    async updateDebugSession(id: string, formData: Partial<DebugSession>): Promise<DebugSession> {
        const response = await apiClient.put<ApiResponse<DebugSession>>(`/debug-sessions/${id}`, formData);
        return response.data.data;
    },

    async deleteDebugSession(id: string): Promise<void> {
        await apiClient.delete(`/debug-sessions/${id}`);
    },
};

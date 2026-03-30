import { apiClient } from './api';
import { Project, ApiResponse, PaginatedResponse, CreateProjectForm } from '@/types';

interface ProjectsListResponse extends ApiResponse<Project[]> {
    pagination?: {
        total?: number;
        skip?: number;
        limit?: number;
    };
}

const toPaginatedProjects = (
    payload: ProjectsListResponse,
    fallbackPage: number,
    fallbackLimit: number
): PaginatedResponse<Project> => {
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

export const projectService = {
    async createProject(formData: CreateProjectForm): Promise<Project> {
        const response = await apiClient.post<ApiResponse<Project>>('/projects', formData);
        return response.data.data;
    },

    async getProjects(page = 1, limit = 50, status?: string): Promise<PaginatedResponse<Project>> {
        const params = new URLSearchParams();
        params.append('skip', String((page - 1) * limit));
        params.append('limit', String(limit));
        if (status) params.append('status', status);

        const response = await apiClient.get<ProjectsListResponse>(`/projects?${params}`);
        return toPaginatedProjects(response.data, page, limit);
    },

    async getProjectById(id: string): Promise<Project> {
        const response = await apiClient.get<ApiResponse<Project>>(`/projects/${id}`);
        return response.data.data;
    },

    async getProjectBySlug(slug: string): Promise<Project> {
        const response = await apiClient.get<ApiResponse<Project>>(`/projects/slug/${slug}`);
        return response.data.data;
    },

    async updateProject(id: string, formData: Partial<CreateProjectForm>): Promise<Project> {
        const response = await apiClient.put<ApiResponse<Project>>(`/projects/${id}`, formData);
        return response.data.data;
    },

    async deleteProject(id: string): Promise<void> {
        await apiClient.delete(`/projects/${id}`);
    },
};

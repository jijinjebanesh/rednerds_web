import { apiClient } from './api';
import { Project, ApiResponse, PaginatedResponse, CreateProjectForm } from '@/types';

interface ProjectsListResponse extends ApiResponse<Project[]> {
    pagination?: {
        total?: number;
        skip?: number;
        limit?: number;
    };
}

const mapProject = (payload: any): Project => {
    const source = payload ?? {};
    return {
        _id: String(source._id ?? source.project_id ?? source.id ?? ''),
        name: String(source.name ?? ''),
        slug: String(source.slug ?? source.project_slug ?? ''),
        description: source.description ?? '',
        status: source.status ?? 'development',
        project_type: source.project_type === 'accessory' ? 'accessory' : 'device',
        createdAt: source.createdAt ?? source.created_at,
        updatedAt: source.updatedAt ?? source.updated_at,
        created_at: source.created_at ?? source.createdAt,
        updated_at: source.updated_at ?? source.updatedAt,
    };
};

const toPaginatedProjects = (
    payload: ProjectsListResponse,
    fallbackPage: number,
    fallbackLimit: number
): PaginatedResponse<Project> => {
    const items = Array.isArray(payload.data) ? payload.data.map(mapProject) : [];
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
        return mapProject(response.data.data);
    },

    async getProjects(page = 1, limit = 50, status?: string, project_type?: string): Promise<PaginatedResponse<Project>> {
        const params = new URLSearchParams();
        params.append('skip', String((page - 1) * limit));
        params.append('limit', String(limit));
        if (status) params.append('status', status);
        if (project_type) params.append('project_type', project_type);

        const response = await apiClient.get<ProjectsListResponse>(`/projects?${params}`);
        return toPaginatedProjects(response.data, page, limit);
    },

    async getProjectById(id: string): Promise<Project> {
        const response = await apiClient.get<ApiResponse<Project>>(`/projects/${id}`);
        return mapProject(response.data.data);
    },

    async getProjectBySlug(slug: string): Promise<Project> {
        const response = await apiClient.get<ApiResponse<Project>>(`/projects/slug/${slug}`);
        return mapProject(response.data.data);
    },

    async updateProject(id: string, formData: Partial<CreateProjectForm>): Promise<Project> {
        const response = await apiClient.put<ApiResponse<Project>>(`/projects/${id}`, formData);
        return mapProject(response.data.data);
    },

    async deleteProject(id: string): Promise<void> {
        await apiClient.delete(`/projects/${id}`);
    },
};

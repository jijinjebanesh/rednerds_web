import { apiClient } from './api';

export interface AppUser {
    id: string;
    name: string;
    email: string;
    status?: string;
    phone?: string;
    role?: string;
    assigned_station?: string | null;
    is_active?: boolean;
    last_login?: string | Date | null;
}

export interface CreateUserPayload {
    name: string;
    email: string;
    phone: string;
    password: string;
    role?: string;
    assigned_station?: string | null;
}

const mapUser = (payload: any): AppUser => {
    const source = Array.isArray(payload) ? payload[0] ?? {} : payload ?? {};
    return {
        id: String(source.id ?? source._id ?? source.userId ?? ''),
        name: source.name ?? source.username ?? 'Unknown',
        email: source.email ?? '-',
        status: source.status,
        phone: source.phone,
        role: source.role,
        assigned_station: source.assigned_station ?? null,
        is_active: source.is_active,
        last_login: source.last_login,
    };
};

export const userService = {
    async createUser(payload: CreateUserPayload): Promise<void> {
        await apiClient.post('/auth/signup', payload);
    },

    async getUsers(): Promise<AppUser[]> {
        const response = await apiClient.get<any[]>('/user');
        if (!Array.isArray(response.data)) return [];
        return response.data.map(mapUser);
    },

    async getUserById(userId: string): Promise<AppUser> {
        const response = await apiClient.get<any>(`/user/${userId}`);
        return mapUser(response.data);
    },

    async updateUser(userId: string, payload: Partial<AppUser>): Promise<void> {
        await apiClient.put(`/user/${userId}`, payload);
    },

    async deleteUser(userId: string): Promise<void> {
        await apiClient.delete(`/user/${userId}`);
    },
};

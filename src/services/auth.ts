import jwtDecode from 'jwt-decode';
import { apiClient } from './api';
import { LoginRequest, AuthResponse, User, ApiResponse, UserRole } from '@/types';

type AuthPayload = Partial<AuthResponse> & {
    token?: string;
    refreshToken?: string;
    user?: User;
    userId?: string;
};

type AuthApiResponse = ApiResponse<AuthPayload> | AuthPayload;

interface DecodedTokenPayload {
    userId?: string;
    sub?: string;
    email?: string;
    name?: string;
    username?: string;
    role?: string;
}

const USER_ROLES: UserRole[] = [
    'admin',
    'production_manager',
    'flash_operator',
    'test_operator',
    'debug_technician',
    'repair_technician',
    'manager',
    'operator',
    'technician',
    'quality_engineer',
    'user',
];

const isUserRole = (role: string | undefined): role is UserRole => {
    return !!role && USER_ROLES.includes(role as UserRole);
};

const extractAuthPayload = (payload: AuthApiResponse): AuthPayload => {
    if (payload && typeof payload === 'object' && 'data' in payload) {
        return (payload as ApiResponse<AuthPayload>).data ?? {};
    }

    return (payload as AuthPayload) ?? {};
};

const buildUserFromToken = (token: string, fallbackUserId?: string): User | null => {
    try {
        const decoded = jwtDecode<DecodedTokenPayload>(token);
        const userId = decoded.userId ?? decoded.sub ?? fallbackUserId;
        const email = decoded.email;

        if (!userId || !email) {
            return null;
        }

        const username = decoded.username ?? decoded.name ?? email.split('@')[0];
        const now = new Date();

        return {
            _id: userId,
            email,
            username,
            role: isUserRole(decoded.role) ? decoded.role : 'operator',
            createdAt: now,
            updatedAt: now,
        };
    } catch {
        return null;
    }
};

export const authService = {
    async login(credentials: LoginRequest): Promise<AuthResponse> {
        const response = await apiClient.post<AuthApiResponse>('/auth/login', credentials);
        const data = extractAuthPayload(response.data);

        if (!data.token) {
            throw new Error('Login response did not include token.');
        }

        apiClient.setAuthToken(data.token, data.refreshToken ?? null);

        let user = data.user ?? buildUserFromToken(data.token, data.userId);
        if (!user) {
            user = await this.getCurrentUser();
        }

        return {
            token: data.token,
            refreshToken: data.refreshToken ?? '',
            user,
            expiresIn: data.expiresIn ?? 0,
        };
    },

    async logout(): Promise<void> {
        try {
            await apiClient.post('/auth/logout');
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            apiClient.logout();
        }
    },

    async getCurrentUser(): Promise<User> {
        try {
            const response = await apiClient.get<ApiResponse<User>>('/auth/me');
            return response.data.data;
        } catch {
            const token = localStorage.getItem('auth_token');
            if (!token) {
                throw new Error('No auth token available to resolve current user.');
            }

            const user = buildUserFromToken(token);
            if (!user) {
                throw new Error('Unable to decode current user from token.');
            }

            return user;
        }
    },

    async refreshToken(): Promise<AuthResponse> {
        const response = await apiClient.post<AuthApiResponse>('/auth/refresh');
        const data = extractAuthPayload(response.data);

        if (!data.token) {
            throw new Error('Refresh response did not include token.');
        }

        apiClient.setAuthToken(data.token, data.refreshToken);

        let user = data.user ?? buildUserFromToken(data.token, data.userId);
        if (!user) {
            user = await this.getCurrentUser();
        }

        return {
            token: data.token,
            refreshToken: data.refreshToken ?? '',
            user,
            expiresIn: data.expiresIn ?? 0,
        };
    },

    isAuthenticated(): boolean {
        return apiClient.isAuthenticated();
    },
};

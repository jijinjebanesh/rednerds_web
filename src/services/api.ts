import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import jwtDecode from 'jwt-decode';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3030';

interface JWTPayload {
    exp: number;
    iat: number;
}

interface RefreshTokenResponse {
    token: string;
    refreshToken?: string;
}

class ApiClient {
    private client: AxiosInstance;
    private tokenKey = 'auth_token';
    private refreshTokenKey = 'refresh_token';

    constructor() {
        this.client = axios.create({
            baseURL: `${API_BASE_URL}/api/v1`,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Request interceptor to add token
        this.client.interceptors.request.use(
            (config) => {
                const token = this.getToken();
                if (token) {
                    config.headers.Authorization = token;
                }
                return config;
            },
            (error) => Promise.reject(error)
        );

        // Response interceptor for token refresh
        this.client.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;

                if (error.response?.status === 401 && !originalRequest._retry) {
                    originalRequest._retry = true;

                    const refreshToken = this.getRefreshToken();
                    if (refreshToken && this.isTokenExpired(this.getToken())) {
                        try {
                            const response = await this.refreshAccessToken(refreshToken);
                            this.setToken(response.token);
                            if (response.refreshToken) {
                                this.setRefreshToken(response.refreshToken);
                            }

                            originalRequest.headers.Authorization = response.token;
                            return this.client(originalRequest);
                        } catch (refreshError) {
                            this.clearTokens();
                            window.location.href = '/login';
                            return Promise.reject(refreshError);
                        }
                    }
                }

                return Promise.reject(error);
            }
        );
    }

    private isTokenExpired(token?: string | null): boolean {
        if (!token) return true;
        try {
            const decoded = jwtDecode<JWTPayload>(token);
            return Date.now() >= decoded.exp * 1000;
        } catch {
            return true;
        }
    }

    private getToken(): string | null {
        return localStorage.getItem(this.tokenKey);
    }

    private setToken(token: string): void {
        localStorage.setItem(this.tokenKey, token);
    }

    private getRefreshToken(): string | null {
        return localStorage.getItem(this.refreshTokenKey);
    }

    private setRefreshToken(token: string): void {
        localStorage.setItem(this.refreshTokenKey, token);
    }

    private clearTokens(): void {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.refreshTokenKey);
    }

    private async refreshAccessToken(refreshToken: string): Promise<RefreshTokenResponse> {
        const response = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh`, {
            refreshToken,
        });

        const payload = response.data?.data ?? response.data;
        return payload;
    }

    async get<T>(url: string, config?: AxiosRequestConfig) {
        return this.client.get<T>(url, config);
    }

    async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
        return this.client.post<T>(url, data, config);
    }

    async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
        return this.client.put<T>(url, data, config);
    }

    async patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
        return this.client.patch<T>(url, data, config);
    }

    async delete<T>(url: string, config?: AxiosRequestConfig) {
        return this.client.delete<T>(url, config);
    }

    setAuthToken(token: string, refreshToken?: string | null): void {
        this.setToken(token);

        if (refreshToken === null) {
            localStorage.removeItem(this.refreshTokenKey);
            return;
        }

        if (typeof refreshToken === 'string') {
            this.setRefreshToken(refreshToken);
        }
    }

    logout(): void {
        this.clearTokens();
    }

    isAuthenticated(): boolean {
        const token = this.getToken();
        return !!token && !this.isTokenExpired(token);
    }
}

export const apiClient = new ApiClient();


import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import jwtDecode from 'jwt-decode';
import { User, UserRole } from '@/types';

interface AuthState {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    error: string | null;
    isAuthenticated: boolean;
}

interface TokenPayload {
    exp?: number;
    iat?: number;
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

const resolveUserRole = (role: string | undefined): UserRole => {
    if (role && USER_ROLES.includes(role as UserRole)) {
        return role as UserRole;
    }

    return 'operator';
};

const buildUserFromToken = (token: string): User | null => {
    try {
        const decoded = jwtDecode<TokenPayload>(token);
        const userId = decoded.userId ?? decoded.sub;

        if (!userId || !decoded.email) {
            return null;
        }

        const username = decoded.username ?? decoded.name ?? decoded.email.split('@')[0];
        const issuedAt = typeof decoded.iat === 'number' ? new Date(decoded.iat * 1000) : new Date();

        return {
            _id: userId,
            email: decoded.email,
            username,
            role: resolveUserRole(decoded.role),
            createdAt: issuedAt,
            updatedAt: issuedAt,
        };
    } catch {
        return null;
    }
};

const clearStoredTokens = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
};

const getInitialAuth = () => {
    if (typeof window === 'undefined') {
        return {
            token: null,
            user: null,
            isAuthenticated: false,
        };
    }

    const token = localStorage.getItem('auth_token');

    if (!token) {
        return {
            token: null,
            user: null,
            isAuthenticated: false,
        };
    }

    try {
        const decoded = jwtDecode<TokenPayload>(token);
        const isTokenValid = typeof decoded.exp === 'number' && Date.now() < decoded.exp * 1000;

        if (!isTokenValid) {
            clearStoredTokens();
            return {
                token: null,
                user: null,
                isAuthenticated: false,
            };
        }

        return {
            token,
            user: buildUserFromToken(token),
            isAuthenticated: true,
        };
    } catch {
        clearStoredTokens();
        return {
            token: null,
            user: null,
            isAuthenticated: false,
        };
    }
};

const initialAuth = getInitialAuth();

const initialState: AuthState = {
    user: initialAuth.user,
    token: initialAuth.token,
    isLoading: false,
    error: null,
    isAuthenticated: initialAuth.isAuthenticated,
};

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.isLoading = action.payload;
        },
        setUser: (state, action: PayloadAction<User>) => {
            state.user = action.payload;
            state.isAuthenticated = true;
        },
        setToken: (state, action: PayloadAction<string>) => {
            state.token = action.payload;
            state.isAuthenticated = !!action.payload;
        },
        setError: (state, action: PayloadAction<string>) => {
            state.error = action.payload;
        },
        clearError: (state) => {
            state.error = null;
        },
        logout: (state) => {
            state.user = null;
            state.token = null;
            state.isAuthenticated = false;
        },
    },
});

export const { setLoading, setUser, setToken, setError, clearError, logout } = authSlice.actions;
export default authSlice.reducer;

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Project, PaginatedResponse } from '@/types';

interface ProjectState {
    projects: Project[];
    currentProject: Project | null;
    isLoading: boolean;
    error: string | null;
    total: number;
    page: number;
    limit: number;
}

const initialState: ProjectState = {
    projects: [],
    currentProject: null,
    isLoading: false,
    error: null,
    total: 0,
    page: 1,
    limit: 50,
};

const projectSlice = createSlice({
    name: 'projects',
    initialState,
    reducers: {
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.isLoading = action.payload;
        },
        setProjects: (state, action: PayloadAction<PaginatedResponse<Project>>) => {
            state.projects = action.payload.data;
            state.total = action.payload.total;
            state.page = action.payload.page;
            state.limit = action.payload.limit;
        },
        setCurrentProject: (state, action: PayloadAction<Project | null>) => {
            state.currentProject = action.payload;
        },
        addProject: (state, action: PayloadAction<Project>) => {
            state.projects.unshift(action.payload);
            state.total += 1;
        },
        updateProject: (state, action: PayloadAction<Project>) => {
            const index = state.projects.findIndex((p) => p._id === action.payload._id);
            if (index !== -1) {
                state.projects[index] = action.payload;
            }
            if (state.currentProject?._id === action.payload._id) {
                state.currentProject = action.payload;
            }
        },
        deleteProject: (state, action: PayloadAction<string>) => {
            state.projects = state.projects.filter((p) => p._id !== action.payload);
            state.total -= 1;
        },
        setError: (state, action: PayloadAction<string>) => {
            state.error = action.payload;
        },
        clearError: (state) => {
            state.error = null;
        },
    },
});

export const {
    setLoading,
    setProjects,
    setCurrentProject,
    addProject,
    updateProject,
    deleteProject,
    setError,
    clearError,
} = projectSlice.actions;
export default projectSlice.reducer;

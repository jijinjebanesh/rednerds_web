import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Batch, PaginatedResponse } from '@/types';

interface BatchState {
    batches: Batch[];
    currentBatch: Batch | null;
    isLoading: boolean;
    error: string | null;
    total: number;
    page: number;
    limit: number;
}

const initialState: BatchState = {
    batches: [],
    currentBatch: null,
    isLoading: false,
    error: null,
    total: 0,
    page: 1,
    limit: 50,
};

const batchSlice = createSlice({
    name: 'batches',
    initialState,
    reducers: {
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.isLoading = action.payload;
        },
        setBatches: (state, action: PayloadAction<PaginatedResponse<Batch>>) => {
            state.batches = action.payload.data;
            state.total = action.payload.total;
            state.page = action.payload.page;
            state.limit = action.payload.limit;
        },
        setCurrentBatch: (state, action: PayloadAction<Batch | null>) => {
            state.currentBatch = action.payload;
        },
        addBatch: (state, action: PayloadAction<Batch>) => {
            state.batches.unshift(action.payload);
            state.total += 1;
        },
        updateBatch: (state, action: PayloadAction<Batch>) => {
            const index = state.batches.findIndex((b) => b._id === action.payload._id);
            if (index !== -1) {
                state.batches[index] = action.payload;
            }
            if (state.currentBatch?._id === action.payload._id) {
                state.currentBatch = action.payload;
            }
        },
        deleteBatch: (state, action: PayloadAction<string>) => {
            state.batches = state.batches.filter((b) => b._id !== action.payload);
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
    setBatches,
    setCurrentBatch,
    addBatch,
    updateBatch,
    deleteBatch,
    setError,
    clearError,
} = batchSlice.actions;
export default batchSlice.reducer;

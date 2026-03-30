import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Product, PaginatedResponse } from '@/types';

interface ProductState {
    products: Product[];
    currentProduct: Product | null;
    isLoading: boolean;
    error: string | null;
    total: number;
    page: number;
    limit: number;
}

const initialState: ProductState = {
    products: [],
    currentProduct: null,
    isLoading: false,
    error: null,
    total: 0,
    page: 1,
    limit: 50,
};

const productSlice = createSlice({
    name: 'products',
    initialState,
    reducers: {
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.isLoading = action.payload;
        },
        setProducts: (state, action: PayloadAction<PaginatedResponse<Product>>) => {
            state.products = action.payload.data;
            state.total = action.payload.total;
            state.page = action.payload.page;
            state.limit = action.payload.limit;
        },
        setCurrentProduct: (state, action: PayloadAction<Product | null>) => {
            state.currentProduct = action.payload;
        },
        addProduct: (state, action: PayloadAction<Product>) => {
            state.products.unshift(action.payload);
            state.total += 1;
        },
        updateProduct: (state, action: PayloadAction<Product>) => {
            const index = state.products.findIndex((p) => p._id === action.payload._id);
            if (index !== -1) {
                state.products[index] = action.payload;
            }
            if (state.currentProduct?._id === action.payload._id) {
                state.currentProduct = action.payload;
            }
        },
        deleteProduct: (state, action: PayloadAction<string>) => {
            state.products = state.products.filter((p) => p._id !== action.payload);
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
    setProducts,
    setCurrentProduct,
    addProduct,
    updateProduct,
    deleteProduct,
    setError,
    clearError,
} = productSlice.actions;
export default productSlice.reducer;

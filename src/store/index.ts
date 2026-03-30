import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import projectReducer from './projectSlice';
import batchReducer from './batchSlice';
import productReducer from './productSlice';

export const store = configureStore({
    reducer: {
        auth: authReducer,
        projects: projectReducer,
        batches: batchReducer,
        products: productReducer,
    },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

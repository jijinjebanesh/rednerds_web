import { PaginatedResponse } from '@/types';

interface PaginationMeta {
    total?: number;
    skip?: number;
    limit?: number;
    page?: number;
    pages?: number;
}

interface ListPayload<T> {
    data?: T[];
    pagination?: PaginationMeta;
}

export const normalizePaginated = <T>(
    payload: ListPayload<T>,
    fallbackPage = 1,
    fallbackLimit = 50
): PaginatedResponse<T> => {
    const data = Array.isArray(payload?.data) ? payload.data : [];
    const limit = payload?.pagination?.limit ?? fallbackLimit;
    const total = payload?.pagination?.total ?? data.length;

    const pageFromPagination = payload?.pagination?.page;
    const pageFromSkip =
        typeof payload?.pagination?.skip === 'number' && limit > 0
            ? Math.floor(payload.pagination.skip / limit) + 1
            : undefined;

    const page = pageFromPagination ?? pageFromSkip ?? fallbackPage;
    const totalPages = payload?.pagination?.pages ?? (limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1);

    return {
        data,
        total,
        page,
        limit,
        totalPages,
    };
};

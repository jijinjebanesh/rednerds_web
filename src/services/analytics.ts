import { apiClient } from './api';

interface CommonProblem {
    problem: string;
    count: number;
    affectedProducts: number;
    resolutionRate: number;
    severity: 'critical' | 'high' | 'medium' | 'low';
}

interface RootCause {
    cause: string;
    frequency: number;
    resolutionSuccessRate: number;
}

interface ProductTestingInsight {
    productId: string;
    productName: string;
    testsPassed: number;
    testsFailed: number;
    debugSessionsCount: number;
    passRate: number;
    requiresRetest: boolean;
}

interface TestingStatistics {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    overallPassRate: number;
    totalDebugSessions: number;
    avgDebugTimeMinutes: number;
    productsUnderTest: number;
}

interface DashboardAnalyticsResponse {
    commonProblems: CommonProblem[];
    rootCauses: RootCause[];
    testingStatistics: TestingStatistics;
    productInsights: ProductTestingInsight[];
}

const getProjectId = () => {
    // Get project ID from URL or use a default if on dashboard
    const pathSegments = window.location.pathname.split('/');
    return pathSegments[2] || 'default';
};

export const analyticsService = {
    async getCommonProblems(projectId?: string): Promise<CommonProblem[]> {
        const id = projectId || getProjectId();
        try {
            const response = await apiClient.get(`/api/v1/analytics/project/${id}/common-problems`);
            return (response.data as any)?.data || [];
        } catch (error) {
            console.error('Failed to fetch common problems:', error);
            return [];
        }
    },

    async getRootCauses(projectId?: string): Promise<RootCause[]> {
        const id = projectId || getProjectId();
        try {
            const response = await apiClient.get(`/api/v1/analytics/project/${id}/root-causes`);
            return (response.data as any)?.data || [];
        } catch (error) {
            console.error('Failed to fetch root causes:', error);
            return [];
        }
    },

    async getTestingInsights(projectId?: string): Promise<TestingStatistics & { products: ProductTestingInsight[] }> {
        const id = projectId || getProjectId();
        try {
            const response = await apiClient.get(`/api/v1/analytics/project/${id}/testing-insights`);
            return (response.data as any)?.data || {};
        } catch (error) {
            console.error('Failed to fetch testing insights:', error);
            return { totalTests: 0, passedTests: 0, failedTests: 0, overallPassRate: 0, totalDebugSessions: 0, avgDebugTimeMinutes: 0, productsUnderTest: 0, products: [] };
        }
    },

    async getDashboardAnalytics(projectId?: string): Promise<DashboardAnalyticsResponse> {
        const id = projectId || getProjectId();
        try {
            const response = await apiClient.get(`/api/v1/analytics/project/${id}/dashboard`);
            return (response.data as any)?.data || {
                commonProblems: [],
                rootCauses: [],
                testingStatistics: {},
                productInsights: [],
            };
        } catch (error) {
            console.error('Failed to fetch dashboard analytics:', error);
            return {
                commonProblems: [],
                rootCauses: [],
                testingStatistics: {
                    totalTests: 0,
                    passedTests: 0,
                    failedTests: 0,
                    overallPassRate: 0,
                    totalDebugSessions: 0,
                    avgDebugTimeMinutes: 0,
                    productsUnderTest: 0,
                },
                productInsights: [],
            };
        }
    },
};

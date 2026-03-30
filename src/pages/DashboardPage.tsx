import { useEffect, useMemo, useState } from 'react';
import {
    Box,
    Button,
    Card,
    CardContent,
    Grid,
    Link,
    Paper,
    Skeleton,
    Typography,
} from '@mui/material';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import PageHeader from '@/components/PageHeader';
import { customerRepairService, debugSessionService, productService, testLogService } from '@/services';
import { Product, TestLog } from '@/types';

interface MetricState {
    value: string;
    loading: boolean;
    error: string | null;
}

const defaultMetric = (value = '0'): MetricState => ({
    value,
    loading: true,
    error: null,
});

const COLORS = ['#1976d2', '#2e7d32', '#ed6c02', '#d32f2f', '#6a1b9a', '#0288d1', '#5d4037'];

const formatDay = (date: Date) =>
    date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });

const formatNumber = (value: number) => new Intl.NumberFormat('en-US').format(value);

const DashboardPage = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [testLogs, setTestLogs] = useState<TestLog[]>([]);

    const [productsMetric, setProductsMetric] = useState<MetricState>(defaultMetric());
    const [yieldMetric, setYieldMetric] = useState<MetricState>(defaultMetric('0%'));
    const [debugQueueMetric, setDebugQueueMetric] = useState<MetricState>(defaultMetric());
    const [repairsMetric, setRepairsMetric] = useState<MetricState>(defaultMetric());

    const [chartLoading, setChartLoading] = useState(true);

    useEffect(() => {
        loadDashboard();
    }, []);

    const loadProducts = async () => {
        setProductsMetric((prev) => ({ ...prev, loading: true, error: null }));

        try {
            const response = await productService.getProducts(1, 1000);
            setProducts(response.data);

            const now = new Date();
            const month = now.getMonth();
            const year = now.getFullYear();

            const monthlyCount = response.data.filter((product) => {
                const manufacturedAt = new Date(product.manufactured_at);
                return manufacturedAt.getMonth() === month && manufacturedAt.getFullYear() === year;
            }).length;

            setProductsMetric({ value: formatNumber(monthlyCount), loading: false, error: null });
        } catch (err: any) {
            setProductsMetric({
                value: '-',
                loading: false,
                error: err?.response?.data?.message || err?.message || 'Failed to load',
            });
        }
    };

    const loadYield = async () => {
        setYieldMetric((prev) => ({ ...prev, loading: true, error: null }));

        try {
            const response = await testLogService.getTestLogs(1, 1000);
            setTestLogs(response.data);

            const total = response.data.length;
            const pass = response.data.filter((log) => log.result === 'pass').length;
            const yieldPct = total > 0 ? ((pass / total) * 100).toFixed(1) : '0.0';

            setYieldMetric({ value: `${yieldPct}%`, loading: false, error: null });
        } catch (err: any) {
            setYieldMetric({
                value: '-',
                loading: false,
                error: err?.response?.data?.message || err?.message || 'Failed to load',
            });
        }
    };

    const loadDebugQueue = async () => {
        setDebugQueueMetric((prev) => ({ ...prev, loading: true, error: null }));

        try {
            const [failedTestsRes, debugSessionsRes] = await Promise.all([
                testLogService.getTestLogs(1, 1000),
                debugSessionService.getDebugSessions(1, 1000),
            ]);

            const failedOrPartial = failedTestsRes.data.filter((log) => log.result !== 'pass');
            const byTestLogId = new Map<string, typeof debugSessionsRes.data>();

            for (const session of debugSessionsRes.data) {
                const current = byTestLogId.get(session.test_log_id) ?? [];
                current.push(session);
                byTestLogId.set(session.test_log_id, current);
            }

            const queueSize = failedOrPartial.filter((log) => {
                const sessions = byTestLogId.get(log._id) ?? [];
                if (sessions.length === 0) return true;

                const latest = [...sessions].sort(
                    (a, b) => new Date(b.debugged_at).getTime() - new Date(a.debugged_at).getTime()
                )[0];

                return latest.resolution_status !== 'resolved' && latest.resolution_status !== 'scrapped';
            }).length;

            setDebugQueueMetric({ value: formatNumber(queueSize), loading: false, error: null });
        } catch (err: any) {
            setDebugQueueMetric({
                value: '-',
                loading: false,
                error: err?.response?.data?.message || err?.message || 'Failed to load',
            });
        }
    };

    const loadOpenRepairs = async () => {
        setRepairsMetric((prev) => ({ ...prev, loading: true, error: null }));

        try {
            const response = await customerRepairService.getRepairs(1, 1000);
            const openCases = response.data.filter((repair) => ['received', 'in_progress'].includes(repair.status)).length;
            setRepairsMetric({ value: formatNumber(openCases), loading: false, error: null });
        } catch (err: any) {
            setRepairsMetric({
                value: '-',
                loading: false,
                error: err?.response?.data?.message || err?.message || 'Failed to load',
            });
        }
    };

    const loadDashboard = async () => {
        setChartLoading(true);
        await Promise.all([loadProducts(), loadYield(), loadDebugQueue(), loadOpenRepairs()]);
        setChartLoading(false);
    };

    const testResultsByDay = useMemo(() => {
        const now = new Date();
        const start = new Date(now);
        start.setDate(now.getDate() - 13);
        start.setHours(0, 0, 0, 0);

        const dayKeys: string[] = [];
        const lookup = new Map<string, { day: string; pass: number; fail: number; partial: number }>();

        for (let i = 0; i < 14; i += 1) {
            const day = new Date(start);
            day.setDate(start.getDate() + i);
            const key = day.toISOString().split('T')[0];
            dayKeys.push(key);
            lookup.set(key, { day: formatDay(day), pass: 0, fail: 0, partial: 0 });
        }

        for (const log of testLogs) {
            const date = new Date(log.tested_at);
            const key = date.toISOString().split('T')[0];
            const row = lookup.get(key);
            if (!row) continue;
            row[log.result] += 1;
        }

        return dayKeys.map((key) => lookup.get(key)!);
    }, [testLogs]);

    const stageDistribution = useMemo(() => {
        const counts = new Map<string, number>();
        for (const product of products) {
            counts.set(product.current_stage, (counts.get(product.current_stage) ?? 0) + 1);
        }

        return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
    }, [products]);

    const renderMetricCard = (
        title: string,
        metric: MetricState,
        onRetry: () => void
    ) => (
        <Card sx={{ height: '100%' }}>
            <CardContent>
                <Typography color="textSecondary" gutterBottom>
                    {title}
                </Typography>

                {metric.loading ? (
                    <Skeleton variant="text" width="70%" height={42} />
                ) : metric.error ? (
                    <Box>
                        <Typography variant="body2" color="error" sx={{ mb: 0.5 }}>
                            Failed to load
                        </Typography>
                        <Link component="button" variant="caption" onClick={onRetry}>
                            Retry
                        </Link>
                    </Box>
                ) : (
                    <Typography variant="h5" sx={{ fontWeight: 'bold', mt: 1 }}>
                        {metric.value}
                    </Typography>
                )}
            </CardContent>
        </Card>
    );

    return (
        <Box>
            <PageHeader
                title="Dashboard"
                subtitle="Live operational overview across manufacturing, testing, debugging, and repairs."
                onRefresh={loadDashboard}
                isRefreshing={chartLoading}
            />

            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                    {renderMetricCard('Products Manufactured (This Month)', productsMetric, loadProducts)}
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    {renderMetricCard('First-Pass Yield', yieldMetric, loadYield)}
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    {renderMetricCard('Open Debug Queue', debugQueueMetric, loadDebugQueue)}
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    {renderMetricCard('Open Repair Cases', repairsMetric, loadOpenRepairs)}
                </Grid>
            </Grid>

            <Grid container spacing={3}>
                <Grid item xs={12} md={8}>
                    <Paper sx={{ p: 2, height: '100%' }}>
                        <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                            Test Results by Day (Last 14 Days)
                        </Typography>
                        {chartLoading ? (
                            <Skeleton variant="rectangular" height={300} />
                        ) : (
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={testResultsByDay}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="day" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="pass" stackId="result" fill="#2e7d32" />
                                    <Bar dataKey="partial" stackId="result" fill="#ed6c02" />
                                    <Bar dataKey="fail" stackId="result" fill="#d32f2f" />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </Paper>
                </Grid>

                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2, height: '100%' }}>
                        <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                            Products by Stage
                        </Typography>
                        {chartLoading ? (
                            <Skeleton variant="rectangular" height={300} />
                        ) : stageDistribution.length === 0 ? (
                            <Typography color="text.secondary">No stage data available.</Typography>
                        ) : (
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie data={stageDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                                        {stageDistribution.map((entry, index) => (
                                            <Cell key={`stage-${entry.name}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </Paper>
                </Grid>
            </Grid>

            {!chartLoading && productsMetric.error && yieldMetric.error && debugQueueMetric.error && repairsMetric.error && (
                <Box sx={{ mt: 2 }}>
                    <Button variant="outlined" onClick={loadDashboard}>
                        Retry All
                    </Button>
                </Box>
            )}
        </Box>
    );
};

export default DashboardPage;


import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Box,
    Card,
    CardContent,
    Grid,
    Skeleton,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material';
import {
    AlertTriangle,
    Package,
    ShieldCheck,
    Wrench,
} from 'lucide-react';
import {
    Cell,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip as RechartsTooltip,
    XAxis,
    YAxis,
} from 'recharts';
import PageHeader from '@/components/PageHeader';
import PageFeedback from '@/components/PageFeedback';
import MetricCard from '@/components/ui/MetricCard';
import SectionLabel from '@/components/ui/SectionLabel';
import StatusChip from '@/components/ui/StatusChip';
import { accessoryWorkflowService, batchService, customerRepairService, debugSessionService, productService, projectService, testLogService } from '@/services';
import { AccessoryWorkflow } from '@/services/accessoryWorkflows';
import { Batch, CustomerRepair, DebugSession, Product, Project, TestLog } from '@/types';

interface DashboardState {
    products: Product[];
    projects: Project[];
    batches: Batch[];
    testLogs: TestLog[];
    debugSessions: DebugSession[];
    repairs: CustomerRepair[];
    accessoryWorkflows: AccessoryWorkflow[];
}

const GRADE_COLORS: Record<string, string> = {
    A: '#4FD18B',
    B: '#00C9B1',
    C: '#F7A84F',
    D: '#FB923C',
    SCRAP: '#F75F5F',
};

const startOfToday = () => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
};

const formatShortDate = (date: Date) =>
    date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
    });

const DashboardPage = () => {
    const [state, setState] = useState<DashboardState>({
        products: [],
        projects: [],
        batches: [],
        testLogs: [],
        debugSessions: [],
        repairs: [],
        accessoryWorkflows: [],
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadDashboard = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const [projectsRes, batchesRes, productsRes, testLogsRes, debugRes, repairsRes, accessoryRes] = await Promise.all([
                projectService.getProjects(1, 500),
                batchService.getBatches(1, 1000),
                productService.getProducts(1, 2000),
                testLogService.getTestLogs(1, 2000),
                debugSessionService.getDebugSessions(1, 2000),
                customerRepairService.getRepairs(1, 1000),
                accessoryWorkflowService.getWorkflows(1, 500),
            ]);

            setState({
                projects: projectsRes.data,
                batches: batchesRes.data,
                products: productsRes.data,
                testLogs: testLogsRes.data,
                debugSessions: debugRes.data,
                repairs: repairsRes.data,
                accessoryWorkflows: accessoryRes.data,
            });
        } catch (err: any) {
            setError(err?.response?.data?.message || err?.message || 'Failed to load dashboard data');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadDashboard();
    }, [loadDashboard]);

    const metrics = useMemo(() => {
        const today = startOfToday();
        const qcGradedToday = state.products.filter((product) => product.quality_graded_at && new Date(product.quality_graded_at) >= today).length;
        const scrappedUnits = state.products.filter((product) => product.status === 'scrapped' || product.quality_grade === 'SCRAP').length;
        const accessoryBacklog = state.accessoryWorkflows.reduce((sum, workflow) => sum + workflow.metrics.failed_backlog_qty + workflow.metrics.qc_backlog_qty, 0);
        const testingQueue = state.products.filter((product) => product.current_stage === 'testing').length;
        const debuggingQueue = state.products.filter((product) => product.current_stage === 'debugging').length;
        const openRepairs = state.repairs.filter((repair) => ['received', 'in_progress'].includes(repair.status)).length;

        return {
            qcGradedToday,
            scrappedUnits,
            accessoryBacklog,
            testingQueue,
            debuggingQueue,
            openRepairs,
        };
    }, [state.accessoryWorkflows, state.products, state.repairs]);

    const donutData = useMemo(() => {
        const counts = state.products.reduce<Record<string, number>>((accumulator, product) => {
            if (product.quality_grade) {
                accumulator[product.quality_grade] = (accumulator[product.quality_grade] ?? 0) + 1;
            }
            return accumulator;
        }, {});

        return Object.entries(counts).map(([name, value]) => ({
            name,
            value,
            fill: GRADE_COLORS[name],
        }));
    }, [state.products]);

    const testingTrend = useMemo(() => {
        const days = Array.from({ length: 7 }, (_, index) => {
            const date = new Date();
            date.setDate(date.getDate() - (6 - index));
            date.setHours(0, 0, 0, 0);
            return date;
        });

        return days.map((day) => {
            const next = new Date(day);
            next.setDate(next.getDate() + 1);
            const logs = state.testLogs.filter((log) => {
                const testedAt = new Date(log.tested_at);
                return testedAt >= day && testedAt < next;
            });
            return {
                date: formatShortDate(day),
                Tests: logs.length,
                Pass: logs.filter((log) => log.result === 'pass').length,
                Fail: logs.filter((log) => log.result !== 'pass').length,
            };
        });
    }, [state.testLogs]);

    const accessorySummary = useMemo(() => {
        return state.accessoryWorkflows.slice(0, 4);
    }, [state.accessoryWorkflows]);

    const activityFeed = useMemo(() => {
        const events = [
            ...state.testLogs.map((log) => ({
                id: `test-${log._id}`,
                type: 'Testing',
                label: `${log.product_id} recorded ${log.result.toUpperCase()} at ${log.station}`,
                timestamp: new Date(log.tested_at),
                tone: log.result === 'pass' ? 'active' : 'partial',
            })),
            ...state.debugSessions.map((session) => ({
                id: `debug-${session._id}`,
                type: 'Debug',
                label: `${session.product_id} marked ${session.resolution_status.replace(/_/g, ' ')}`,
                timestamp: new Date(session.debugged_at),
                tone: session.resolution_status === 'resolved' ? 'active' : 'partial',
            })),
            ...state.repairs.map((repair) => ({
                id: `repair-${repair._id}`,
                type: 'Repair',
                label: `${repair.product_id} repair case ${repair.status.replace(/_/g, ' ')}`,
                timestamp: new Date(repair.received_date),
                tone: repair.status === 'returned_to_customer' ? 'active' : 'repair',
            })),
            ...state.products
                .filter((product) => product.quality_grade && product.quality_graded_at)
                .map((product) => ({
                    id: `grade-${product._id}`,
                    type: 'QC',
                    label: `${product.product_id} graded ${product.quality_grade}`,
                    timestamp: new Date(product.quality_graded_at!),
                    tone: product.quality_grade === 'SCRAP' ? 'scrap' : 'qc',
                })),
        ];

        return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 10);
    }, [state.debugSessions, state.products, state.repairs, state.testLogs]);

    const manufacturingCards = [
        {
            title: 'Testing Queue',
            value: metrics.testingQueue,
            subtitle: `${state.projects.filter((project) => project.project_type === 'device').length} device projects`,
            icon: <Package size={18} />,
            accent: '#4F8EF7',
            tooltip: 'Products currently sitting in testing stage.',
        },
        {
            title: 'Debug Queue',
            value: metrics.debuggingQueue,
            subtitle: `${state.debugSessions.length} debug sessions logged`,
            icon: <Wrench size={18} />,
            accent: '#F7A84F',
            tooltip: 'Products that still require debugging action.',
        },
        {
            title: 'QC Graded Today',
            value: metrics.qcGradedToday,
            subtitle: 'Final quality outcomes recorded today',
            icon: <ShieldCheck size={18} />,
            accent: '#A78BFA',
            tooltip: 'Products graded since the start of the current day.',
        },
        {
            title: 'Scrapped Units',
            value: metrics.scrappedUnits,
            subtitle: 'Serial units rejected or scrapped',
            icon: <AlertTriangle size={18} />,
            accent: '#F75F5F',
            tooltip: 'Products marked scrapped via stage or QC grade.',
        },
    ];

    return (
        <Box>
            <PageHeader
                title="Dashboard"
                subtitle="A live operational view across device manufacturing, accessory quantity flows, repairs, debugging, and final QC outcomes."
                countLabel={`${state.projects.length} active programs`}
                onRefresh={loadDashboard}
                isRefreshing={isLoading}
            />

            <PageFeedback isLoading={isLoading} error={error} />

            <SectionLabel eyebrow="Manufacturing Overview" title="Floor Performance" caption="High-signal KPIs for queue depth, throughput, and escalation points." />
            <Grid container spacing={2} sx={{ mb: 3 }}>
                {manufacturingCards.map((card) => (
                    <Grid item xs={12} sm={6} xl={3} key={card.title}>
                        {isLoading ? (
                            <Card sx={{ height: '100%' }}>
                                <CardContent>
                                    <Skeleton variant="text" width="50%" />
                                    <Skeleton variant="text" width="35%" height={42} />
                                    <Skeleton variant="text" width="80%" />
                                </CardContent>
                            </Card>
                        ) : (
                            <MetricCard
                                title={card.title}
                                value={card.value}
                                subtitle={card.subtitle}
                                icon={card.icon}
                                accent={card.accent}
                                trend={card.value > 0 ? 'Live' : 'Stable'}
                                tooltip={card.tooltip}
                            />
                        )}
                    </Grid>
                ))}
            </Grid>

            <SectionLabel eyebrow="Quality Overview" title="QC Distribution And Repair Pressure" caption="Visualize final grade mix, open repairs, and service load from one screen." />
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} lg={5}>
                    <Card sx={{ height: '100%' }}>
                        <CardContent sx={{ height: 360 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                                <Typography variant="h6">QC Grade Distribution</Typography>
                                <StatusChip label={`${donutData.reduce((sum, item) => sum + item.value, 0)} graded`} />
                            </Stack>
                            {isLoading ? (
                                <Skeleton variant="rounded" width="100%" height={280} />
                            ) : donutData.length === 0 ? (
                                <Box sx={{ display: 'grid', placeItems: 'center', height: 280 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        No graded products available yet.
                                    </Typography>
                                </Box>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={donutData} innerRadius={85} outerRadius={115} paddingAngle={3} dataKey="value">
                                            {donutData.map((entry) => (
                                                <Cell key={entry.name} fill={entry.fill} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} lg={7}>
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                            <MetricCard title="Open Repairs" value={metrics.openRepairs} subtitle="Cases in received or in-progress status" icon={<Wrench size={18} />} accent="#FB923C" />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <MetricCard title="Accessory Backlog" value={metrics.accessoryBacklog} subtitle="Failed backlog plus QC backlog" icon={<AlertTriangle size={18} />} accent="#F7A84F" />
                        </Grid>
                        <Grid item xs={12}>
                            <Card sx={{ height: 280 }}>
                                <CardContent sx={{ height: '100%' }}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                                        <Typography variant="h6">Testing Trend</Typography>
                                        <StatusChip label="Last 7 days" />
                                    </Stack>
                                    {isLoading ? (
                                        <Skeleton variant="rounded" width="100%" height={200} />
                                    ) : (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={testingTrend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                                                <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" tickLine={false} axisLine={false} />
                                                <YAxis stroke="rgba(255,255,255,0.4)" tickLine={false} axisLine={false} />
                                                <RechartsTooltip />
                                                <Line type="monotone" dataKey="Tests" stroke="#4F8EF7" strokeWidth={3} dot={{ r: 3 }} />
                                                <Line type="monotone" dataKey="Pass" stroke="#4FD18B" strokeWidth={2} dot={false} />
                                                <Line type="monotone" dataKey="Fail" stroke="#F75F5F" strokeWidth={2} dot={false} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    )}
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </Grid>
            </Grid>

            <SectionLabel eyebrow="Accessory Overview" title="Quantity Workflow Watchlist" caption="Focus on workflows with the highest backlog risk and see stage pressure immediately." />
            <Grid container spacing={2} sx={{ mb: 3 }}>
                {accessorySummary.map((workflow) => {
                    const backlog = workflow.metrics.failed_backlog_qty + workflow.metrics.qc_backlog_qty;
                    const warning = backlog > workflow.target_qty * 0.2;

                    return (
                        <Grid item xs={12} md={6} xl={3} key={workflow._id}>
                            <Card sx={{ height: '100%', borderColor: warning ? 'rgba(247,168,79,0.5)' : 'divider' }}>
                                <CardContent>
                                    <Typography variant="overline">{workflow.project_name || workflow.project_id}</Typography>
                                    <Typography variant="h6">{workflow.accessory_name}</Typography>
                                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
                                        <StatusChip label={`Target ${workflow.target_qty}`} />
                                        {warning ? <StatusChip label="Backlog > 20%" value="partial" /> : <StatusChip value="active" label="Healthy" />}
                                    </Stack>
                                    <Box sx={{ mt: 2 }}>
                                        <Box sx={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.06)' }}>
                                            <Box sx={{ width: `${(workflow.metrics.tested_total_qty / Math.max(1, workflow.target_qty)) * 100}%`, backgroundColor: '#4F8EF7' }} />
                                            <Box sx={{ width: `${(workflow.metrics.failed_backlog_qty / Math.max(1, workflow.target_qty)) * 100}%`, backgroundColor: '#F7A84F' }} />
                                            <Box sx={{ width: `${(workflow.metrics.qc_backlog_qty / Math.max(1, workflow.target_qty)) * 100}%`, backgroundColor: '#A78BFA' }} />
                                        </Box>
                                    </Box>
                                    <Stack spacing={0.8} sx={{ mt: 1.5 }}>
                                        <Typography variant="body2" color="text.secondary">Tested: {workflow.metrics.tested_total_qty}</Typography>
                                        <Typography variant="body2" color="text.secondary">Debug backlog: {workflow.metrics.failed_backlog_qty}</Typography>
                                        <Typography variant="body2" color="text.secondary">QC backlog: {workflow.metrics.qc_backlog_qty}</Typography>
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Grid>
                    );
                })}
            </Grid>

            <Grid container spacing={2}>
                <Grid item xs={12} xl={8}>
                    <SectionLabel eyebrow="Project Health" title="Programs In Motion" caption="A compact operational scorecard for projects with active manufacturing output." />
                    <Grid container spacing={2}>
                        {state.projects.slice(0, 6).map((project) => {
                            const projectProducts = state.products.filter((product) => product.project_id === project._id);
                            const projectTests = state.testLogs.filter((log) => projectProducts.some((product) => product.product_id === log.product_id));
                            const yieldPct =
                                projectTests.length > 0 ? Math.round((projectTests.filter((log) => log.result === 'pass').length / projectTests.length) * 100) : 0;

                            return (
                                <Grid item xs={12} md={6} key={project._id}>
                                    <Card>
                                        <CardContent>
                                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                                <Box>
                                                    <Typography variant="subtitle1">{project.name}</Typography>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {project.slug}
                                                    </Typography>
                                                </Box>
                                                <StatusChip value={project.project_type} />
                                            </Stack>
                                            <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                                                <Tooltip title="Tracked products">
                                                    <Box>
                                                        <Typography variant="h6">{projectProducts.length}</Typography>
                                                        <Typography variant="caption" color="text.secondary">Units</Typography>
                                                    </Box>
                                                </Tooltip>
                                                <Tooltip title="Pass yield from test logs">
                                                    <Box>
                                                        <Typography variant="h6">{yieldPct}%</Typography>
                                                        <Typography variant="caption" color="text.secondary">Yield</Typography>
                                                    </Box>
                                                </Tooltip>
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            );
                        })}
                    </Grid>
                </Grid>

                <Grid item xs={12} xl={4}>
                    <SectionLabel eyebrow="Live Activity" title="Recent Events" caption="The last ten quality and manufacturing events, ordered newest first." />
                    <Stack spacing={1.25}>
                        {isLoading
                            ? Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} variant="rounded" height={74} />)
                            : activityFeed.map((event) => (
                                  <Card key={event.id}>
                                      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                                          <Stack direction="row" justifyContent="space-between" spacing={1.5}>
                                              <Box>
                                                  <Typography variant="subtitle2">{event.type}</Typography>
                                                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
                                                      {event.label}
                                                  </Typography>
                                              </Box>
                                              <StatusChip value={event.tone} />
                                          </Stack>
                                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.1 }}>
                                              {event.timestamp.toLocaleString()}
                                          </Typography>
                                      </CardContent>
                                  </Card>
                              ))}
                    </Stack>
                </Grid>
            </Grid>
        </Box>
    );
};

export default DashboardPage;

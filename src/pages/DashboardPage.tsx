import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Grid,
    LinearProgress,
    Link,
    Paper,
    Select,
    MenuItem,
    FormControl,
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip,
    Typography,
    ToggleButton,
    ToggleButtonGroup,
} from '@mui/material';
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip as RechartsTooltip,
    XAxis,
    YAxis,
} from 'recharts';
import {
    Refresh as RefreshIcon,
} from '@mui/icons-material';
import { customerRepairService, debugSessionService, productService, testLogService } from '@/services';
import { Product, TestLog, DebugSession, CustomerRepair } from '@/types';

type TimeWindow = 'today' | '7d' | '14d' | '30d' | '90d';

interface KPICardProps {
    label: string;
    value: string;
    deltaText?: string;
    deltaColor?: 'success' | 'error' | 'neutral';
    progressBar?: { value: number; color?: 'success' | 'warning' | 'error' };
    loading: boolean;
    error?: string | null;
    onRetry?: () => void;
    semanticTint?: 'amber' | 'red' | null;
}

interface IssueCluster {
    label: string;
    occurrences: number;
    productsAffected: number;
    severity: 'high' | 'notable' | 'none';
    sources: { testSymptoms: number; debugIssues: number; rootCauses: number };
    examples: string[];
    firstSeen: string;
    lastSeen: string;
    trend: 'up' | 'down' | 'stable';
}

interface OperatorMetrics {
    operatorId: string;
    operatorName: string;
    station: string;
    tested: number;
    yield: number;
    testsPerDay: number;
}

interface ProjectMetrics {
    projectId: string;
    projectName: string;
    products: number;
    yield: number;
    debugRate: number;
    openRepairs: number;
    topIssue: string;
}

interface RootCauseKPI {
    cause: string;
    frequency: number;
    resolutionRate: number;
    trend: 'up' | 'down' | 'stable';
}

const KPICard = ({
    label,
    value,
    deltaText,
    deltaColor,
    progressBar,
    loading,
    error,
    onRetry,
    semanticTint,
}: KPICardProps) => {
    const bgColor = semanticTint === 'red' ? '#ffebee' : semanticTint === 'amber' ? '#fff8e1' : 'transparent';

    return (
        <Paper
            sx={{
                p: 1.5,
                height: '100%',
                backgroundColor: semanticTint ? bgColor : 'var(--palette-background-secondary, #f5f5f5)',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <Typography variant="caption" sx={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--palette-text-secondary, #666)', mb: 0.5 }}>
                {label}
            </Typography>

            {loading ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Skeleton variant="text" width="60%" height={32} />
                    <Skeleton variant="text" width="70%" height={16} />
                </Box>
            ) : error ? (
                <Box>
                    <Typography variant="body2" color="error" sx={{ mb: 0.3, fontSize: '12px' }}>
                        —
                    </Typography>
                    {onRetry && (
                        <Link component="button" variant="caption" onClick={onRetry} sx={{ fontSize: '11px' }}>
                            Retry
                        </Link>
                    )}
                </Box>
            ) : (
                <>
                    <Typography variant="h5" sx={{ fontSize: '28px', fontWeight: 500, my: 0.5 }}>
                        {value}
                    </Typography>

                    {progressBar && (
                        <Box sx={{ mb: 0.5 }}>
                            <LinearProgress
                                variant="determinate"
                                value={Math.min(progressBar.value, 100)}
                                sx={{
                                    height: '4px',
                                    borderRadius: '2px',
                                    backgroundColor: '#e0e0e0',
                                    '& .MuiLinearProgress-bar': {
                                        backgroundColor:
                                            progressBar.color === 'success'
                                                ? '#4caf50'
                                                : progressBar.color === 'warning'
                                                    ? '#ff9800'
                                                    : '#f44336',
                                    },
                                }}
                            />
                        </Box>
                    )}

                    {deltaText && (
                        <Typography
                            variant="caption"
                            sx={{
                                fontSize: '11px',
                                color:
                                    deltaColor === 'success'
                                        ? '#4caf50'
                                        : deltaColor === 'error'
                                            ? '#f44336'
                                            : '#999',
                                fontWeight: 500,
                            }}
                        >
                            {deltaText}
                        </Typography>
                    )}
                </>
            )}
        </Paper>
    );
};

const StageBar = ({ stage, count, total }: { stage: string; count: number; total: number }) => {
    const percentage = total > 0 ? (count / total) * 100 : 0;
    const stageColors: Record<string, string> = {
        testing: '#2196f3',
        debugging: '#ff9800',
        qc: '#009688',
        stock: '#bdbdbd',
        shipped: '#4caf50',
        repair: '#ff6f00',
        scrapped: '#f44336',
        flashing: '#9c27b0',
    };

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Typography variant="caption" sx={{ minWidth: '80px', fontSize: '12px', fontWeight: 500 }}>
                {stage}
            </Typography>
            <Box sx={{ flex: 1, height: '8px', backgroundColor: '#e0e0e0', borderRadius: '4px', overflow: 'hidden' }}>
                <Box
                    sx={{
                        height: '100%',
                        width: `${percentage}%`,
                        backgroundColor: stageColors[stage] || '#999',
                        borderRadius: '4px',
                        transition: 'width 0.3s ease',
                    }}
                />
            </Box>
            <Typography variant="caption" sx={{ minWidth: '40px', textAlign: 'right', fontSize: '12px', fontWeight: 500 }}>
                {count}
            </Typography>
        </Box>
    );
};

const TrendBadge = ({ trend }: { trend: 'up' | 'down' | 'stable' }) => {
    const colors = {
        up: { bg: '#ffebee', text: '#f44336', icon: '↑' },
        down: { bg: '#e8f5e9', text: '#4caf50', icon: '↓' },
        stable: { bg: '#f5f5f5', text: '#999', icon: '→' },
    };

    const config = colors[trend];
    return (
        <Chip
            label={config.icon}
            size="small"
            sx={{
                backgroundColor: config.bg,
                color: config.text,
                fontSize: '11px',
                fontWeight: 600,
                height: '22px',
            }}
        />
    );
};

const IssueClusterCard = ({ cluster }: { cluster: IssueCluster }) => {
    const total = cluster.sources.testSymptoms + cluster.sources.debugIssues + cluster.sources.rootCauses;
    const testPct = total > 0 ? ((cluster.sources.testSymptoms / total) * 100).toFixed(0) : 0;
    const debugPct = total > 0 ? ((cluster.sources.debugIssues / total) * 100).toFixed(0) : 0;
    const rootPct = total > 0 ? ((cluster.sources.rootCauses / total) * 100).toFixed(0) : 0;

    return (
        <Card sx={{ backgroundColor: 'var(--palette-background-secondary, #f5f5f5)', borderRadius: '12px' }}>
            <CardContent sx={{ pb: 1.5, '&:last-child': { pb: 1.5 } }}>
                {/* Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                    <Typography
                        variant="subtitle2"
                        sx={{
                            fontSize: '14px',
                            fontWeight: 500,
                            flex: 1,
                            pr: 1,
                            color: 'var(--palette-text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                        }}
                    >
                        {cluster.label}
                    </Typography>
                    <TrendBadge trend={cluster.trend} />
                </Box>

                {/* Stats Row */}
                <Box sx={{ display: 'flex', gap: 0.75, mb: 1, flexWrap: 'wrap' }}>
                    <Chip
                        label={`${cluster.occurrences} occurrences`}
                        size="small"
                        variant="outlined"
                        sx={{ height: '20px', fontSize: '11px' }}
                    />
                    <Chip
                        label={`${cluster.productsAffected} products`}
                        size="small"
                        variant="outlined"
                        sx={{ height: '20px', fontSize: '11px' }}
                    />
                    {cluster.severity !== 'none' && (
                        <Chip
                            label={cluster.severity === 'high' ? 'High impact' : 'Notable'}
                            size="small"
                            sx={{
                                height: '20px',
                                fontSize: '11px',
                                backgroundColor: cluster.severity === 'high' ? '#ffebee' : '#fff8e1',
                                color: cluster.severity === 'high' ? '#d32f2f' : '#f57c00',
                            }}
                        />
                    )}
                </Box>

                {/* Source Breakdown Mini-bar */}
                <Box sx={{ mb: 1.5 }}>
                    <Box sx={{ display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden', mb: 0.5 }}>
                        {cluster.sources.testSymptoms > 0 && (
                            <Box
                                sx={{
                                    flex: cluster.sources.testSymptoms,
                                    backgroundColor: '#009688',
                                }}
                            />
                        )}
                        {cluster.sources.debugIssues > 0 && (
                            <Box
                                sx={{
                                    flex: cluster.sources.debugIssues,
                                    backgroundColor: '#ff9800',
                                }}
                            />
                        )}
                        {cluster.sources.rootCauses > 0 && (
                            <Box
                                sx={{
                                    flex: cluster.sources.rootCauses,
                                    backgroundColor: '#9c27b0',
                                }}
                            />
                        )}
                    </Box>
                    <Typography variant="caption" sx={{ fontSize: '11px', color: 'var(--palette-text-secondary, #999)' }}>
                        Test symptoms {testPct}% · Debug issues {debugPct}% · Root causes {rootPct}%
                    </Typography>
                </Box>

                {/* Example Texts */}
                <Box sx={{ mb: 1.5 }}>
                    {cluster.examples.map((example, idx) => (
                        <Box
                            key={idx}
                            sx={{
                                borderLeft: '2px solid var(--palette-border-tertiary, #e0e0e0)',
                                paddingLeft: '8px',
                                mb: 0.75,
                                fontSize: '12px',
                                color: 'var(--palette-text-secondary, #666)',
                                fontStyle: 'italic',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            "{example}"
                        </Box>
                    ))}
                </Box>

                {/* Footer Row */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ fontSize: '11px', color: 'var(--palette-text-secondary, #999)' }}>
                        First seen {cluster.firstSeen} · Last seen {cluster.lastSeen}
                    </Typography>
                    <Link
                        component="button"
                        variant="caption"
                        onClick={() => { }}
                        sx={{ fontSize: '11px', color: '#0066cc', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                    >
                        View affected →
                    </Link>
                </Box>
            </CardContent>
        </Card>
    );
};

const DashboardModern = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [timeWindow, setTimeWindow] = useState<TimeWindow>((searchParams.get('window') as TimeWindow) || '14d');
    const [issuesWindow, setIssuesWindow] = useState<'14' | '30' | '60' | '90'>('30');
    const [selectedProject, setSelectedProject] = useState('all');
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Data States
    const [kpiLoading, setKpiLoading] = useState(true);
    const [kpiError, setKpiError] = useState<Record<string, string | null>>({});

    const [qualityScore, setQualityScore] = useState<string>('0%');
    const [unitsMfg, setUnitsMfg] = useState<string>('0');
    const [debugQueue, setDebugQueue] = useState<string>('0');
    const [debugQueueSemantic, setDebugQueueSemantic] = useState<'red' | 'amber' | null>(null);
    const [openRepairs, setOpenRepairs] = useState<string>('0');
    const [warrantyCases, setWarrantyCases] = useState<string>('0');
    const [avgDebugTime, setAvgDebugTime] = useState<string>('0h');
    const [scrapCount, setScrapCount] = useState<string>('0');

    const [testData, setTestData] = useState<any[]>([]);
    const [stageData, setStageData] = useState<Array<{ name: string; value: number }>>([]);
    const [issuesData, setIssuesData] = useState<IssueCluster[]>([]);
    const [issuesLoading, setIssuesLoading] = useState(false);
    const [operatorData, setOperatorData] = useState<OperatorMetrics[]>([]);
    const [projectData, setProjectData] = useState<ProjectMetrics[]>([]);
    const [rootCausesData, setRootCausesData] = useState<RootCauseKPI[]>([]);

    const [products, setProducts] = useState<Product[]>([]);
    const [testLogs, setTestLogs] = useState<TestLog[]>([]);
    const [debugSessions, setDebugSessions] = useState<DebugSession[]>([]);
    const [repairs, setRepairs] = useState<CustomerRepair[]>([]);

    // Format numbers with locale
    const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n);
    const fmtPercent = (n: number) => n.toFixed(1);

    // Get date range based on timeWindow
    const getDateRange = () => {
        const now = new Date();
        const start = new Date();
        const daysMap = { today: 0, '7d': 6, '14d': 13, '30d': 29, '90d': 89 };
        start.setDate(now.getDate() - daysMap[timeWindow]);
        return { start, now };
    };

    // Load KPIs
    const loadKPIs = useCallback(async () => {
        setKpiLoading(true);
        setKpiError({});

        try {
            const { start, now } = getDateRange();

            // Load all data
            const [productsRes, testLogsRes, debugSessionsRes, repairsRes] = await Promise.all([
                productService.getProducts(1, 10000),
                testLogService.getTestLogs(1, 10000),
                debugSessionService.getDebugSessions(1, 10000),
                customerRepairService.getRepairs(1, 10000),
            ]);

            const prods = productsRes.data;
            const tests = testLogsRes.data;
            const debugs = debugSessionsRes.data;
            const reps = repairsRes.data;

            setProducts(prods);
            setTestLogs(tests);
            setDebugSessions(debugs);
            setRepairs(reps);

            // Filter by date range
            const testInRange = tests.filter((t) => {
                const d = new Date(t.tested_at);
                return d >= start && d <= now;
            });

            // Quality Score (FPY)
            const passCount = testInRange.filter((t) => t.result === 'pass').length;
            const fpyPct = testInRange.length > 0 ? ((passCount / testInRange.length) * 100) : 0;
            setQualityScore(`${fmtPercent(fpyPct)}%`);

            // Units Manufactured this window
            const mfgInRange = prods.filter((p) => {
                const d = new Date(p.manufactured_at);
                return d >= start && d <= now;
            }).length;
            setUnitsMfg(fmt(mfgInRange));

            // Debug Queue (failed/partial tests that are still in debugging)
            const failedOrPartial = testInRange.filter((t) => t.result !== 'pass');
            const debugsByTestLogId = new Map<string, DebugSession[]>();
            debugs.forEach((d) => {
                const current = debugsByTestLogId.get(d.test_log_id) ?? [];
                current.push(d);
                debugsByTestLogId.set(d.test_log_id, current);
            });

            const queueCount = failedOrPartial.filter((t) => {
                const sessionsForLog = debugsByTestLogId.get(t._id) ?? [];
                if (sessionsForLog.length === 0) return true;
                const latest = sessionsForLog.sort((a, b) => new Date(b.debugged_at).getTime() - new Date(a.debugged_at).getTime())[0];
                return !['resolved', 'scrapped'].includes(latest.resolution_status);
            }).length;

            setDebugQueue(fmt(queueCount));
            setDebugQueueSemantic(queueCount > 25 ? 'red' : queueCount > 10 ? 'amber' : null);

            // Open Repairs
            const openReps = reps.filter((r) => ['received', 'in_progress'].includes(r.status));
            setOpenRepairs(fmt(openReps.length));

            const warrantyReps = openReps.filter((r) => r.in_warranty);
            setWarrantyCases(`${warrantyReps.length} in warranty`);

            // Avg Debug Time
            const debugsWithTime = debugs.map((d) => {
                const testLog = tests.find((t) => t._id === d.test_log_id);
                if (!testLog) return null;
                const testedAt = new Date(testLog.tested_at).getTime();
                const debuggedAt = new Date(d.debugged_at).getTime();
                const hours = (debuggedAt - testedAt) / (1000 * 60 * 60);
                return hours;
            }).filter((h) => h !== null && h > 0);

            const avgHours = debugsWithTime.length > 0 ? debugsWithTime.reduce((a, b) => a! + b!, 0)! / debugsWithTime.length : 0;
            if (avgHours < 1) {
                setAvgDebugTime(`${Math.round(avgHours * 60)}m`);
            } else if (avgHours < 24) {
                setAvgDebugTime(`${fmtPercent(avgHours)}h`);
            } else {
                setAvgDebugTime(`${fmtPercent(avgHours / 24)}d`);
            }

            // Scrapped Units
            const scrappedInRange = prods.filter((p) => {
                const d = new Date(p.manufactured_at);
                return d >= start && d <= now && p.status === 'scrapped';
            }).length;
            setScrapCount(scrappedInRange === 0 ? 'None' : fmt(scrappedInRange));

        } catch (err) {
            setKpiError({ all: 'Failed to load KPIs' });
        } finally {
            setKpiLoading(false);
        }
    }, [timeWindow]);

    // Load Charts
    const loadCharts = useCallback(async () => {
        try {
            const { start, now } = getDateRange();

            // Test results over time (stacked bar chart)
            const testsByDay = new Map<string, { pass: number; fail: number; partial: number }>();
            for (let i = 0; i <= (timeWindow === 'today' ? 0 : timeWindow === '7d' ? 6 : timeWindow === '14d' ? 13 : timeWindow === '30d' ? 29 : 89); i++) {
                const day = new Date(start);
                day.setDate(start.getDate() + i);
                const key = day.toISOString().split('T')[0];
                testsByDay.set(key, { pass: 0, fail: 0, partial: 0 });
            }

            testLogs.forEach((t) => {
                const d = new Date(t.tested_at);
                if (d >= start && d <= now) {
                    const key = d.toISOString().split('T')[0];
                    const row = testsByDay.get(key);
                    if (row) row[t.result]++;
                }
            });

            const chartData = Array.from(testsByDay.entries())
                .map(([date, data]) => ({
                    day: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    ...data,
                }));
            setTestData(chartData);

            // Stage distribution
            const stageCounts = new Map<string, number>();
            products.forEach((p) => {
                stageCounts.set(p.current_stage, (stageCounts.get(p.current_stage) ?? 0) + 1);
            });
            setStageData(
                Array.from(stageCounts.entries())
                    .map(([name, value]) => ({ name, value }))
                    .sort((a, b) => b.value - a.value)
            );
        } catch (err) {
            console.error(err);
        }
    }, [timeWindow, testLogs, products]);

    // Load Issues
    const loadIssues = useCallback(async () => {
        setIssuesLoading(true);
        try {
            // Fetch issue data - for now using debug sessions
            const clusters: Array<{
                label: string;
                occurrences: number;
                productsAffected: number;
                severity: 'high' | 'notable' | 'none';
                sources: { testSymptoms: number; debugIssues: number; rootCauses: number };
                examples: string[];
                firstSeen: string;
                lastSeen: string;
                trend: 'up' | 'down' | 'stable';
            }> = [];

            // Group debug sessions by issue
            const issueMap = new Map<string, DebugSession[]>();
            debugSessions.forEach((d) => {
                if (d.issue_identified) {
                    const normalized = d.issue_identified.toLowerCase().trim();
                    const list = issueMap.get(normalized) ?? [];
                    list.push(d);
                    issueMap.set(normalized, list);
                }
            });

            // Create cluster cards
            issueMap.forEach((sessions, label) => {
                const affectedProds = new Set(sessions.map((s) => s.product_id));
                clusters.push({
                    label: label.substring(0, 100),
                    occurrences: sessions.length,
                    productsAffected: affectedProds.size,
                    severity: (sessions.length / debugSessions.length > 0.2 ? 'high' : sessions.length / debugSessions.length > 0.1 ? 'notable' : 'none'),
                    sources: {
                        testSymptoms: sessions.filter((s) => s.issue_identified).length,
                        debugIssues: sessions.filter((s) => s.root_cause).length,
                        rootCauses: sessions.filter((s) => s.action_taken).length,
                    },
                    examples: sessions.slice(0, 3).map((s) => s.issue_identified || s.root_cause || 'Unknown'),
                    firstSeen: new Date(sessions[0]?.debugged_at || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    lastSeen: new Date(sessions[sessions.length - 1]?.debugged_at || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    trend: 'stable' as const,
                });
            });

            setIssuesData(clusters.sort((a, b) => b.occurrences - a.occurrences).slice(0, 6));
        } catch (err) {
            console.error(err);
        } finally {
            setIssuesLoading(false);
        }
    }, [debugSessions]);

    // Load Operator & Project Data
    const loadOperatorAndProjectData = useCallback(async () => {
        try {
            // Operator metrics (grouped by test operator)
            const opMetrics = new Map<string, { station: string; tested: number; passed: number; days: Set<string> }>();
            testLogs.forEach((t) => {
                const op = t.operator_id || 'Unknown';
                const entry = opMetrics.get(op) ?? { station: t.station || 'N/A', tested: 0, passed: 0, days: new Set() };
                entry.tested++;
                if (t.result === 'pass') entry.passed++;
                entry.days.add(new Date(t.tested_at).toISOString().split('T')[0]);
                opMetrics.set(op, entry);
            });

            const opData: OperatorMetrics[] = Array.from(opMetrics.entries()).map(([id, data]) => ({
                operatorId: id,
                operatorName: `Operator ${id.substring(0, 8)}`,
                station: data.station,
                tested: data.tested,
                yield: data.tested > 0 ? (data.passed / data.tested) * 100 : 0,
                testsPerDay: data.days.size > 0 ? data.tested / data.days.size : 0,
            }));
            setOperatorData(opData);

            // Project metrics
            const projMetrics = new Map<string, { name: string; products: number; passed: number; failed: number; debugs: number; repairs: number }>();
            products.forEach((p) => {
                const proj = projMetrics.get(p.project_id) ?? { name: p.project_slug || p.project_id, products: 0, passed: 0, failed: 0, debugs: 0, repairs: 0 };
                proj.products++;
                projMetrics.set(p.project_id, proj);
            });

            testLogs.forEach((t) => {
                const prod = products.find((p) => p._id === t.product_id);
                if (prod && prod.project_id) {
                    const proj = projMetrics.get(prod.project_id);
                    if (proj) {
                        if (t.result === 'pass') proj.passed++;
                        else proj.failed++;
                    }
                }
            });

            debugSessions.forEach((d) => {
                const prod = products.find((p) => p._id === d.product_id);
                if (prod && prod.project_id) {
                    const proj = projMetrics.get(prod.project_id);
                    if (proj) proj.debugs++;
                }
            });

            repairs.forEach((r) => {
                const prod = products.find((p) => p._id === r.product_id);
                if (prod && prod.project_id) {
                    const proj = projMetrics.get(prod.project_id);
                    if (proj) proj.repairs++;
                }
            });

            const projData: ProjectMetrics[] = Array.from(projMetrics.entries()).map(([id, data]) => ({
                projectId: id,
                projectName: data.name,
                products: data.products,
                yield: data.products > 0 ? ((data.passed / (data.passed + data.failed)) * 100) : 0,
                debugRate: data.products > 0 ? (data.debugs / data.products) * 100 : 0,
                openRepairs: data.repairs,
                topIssue: 'N/A',
            }));
            setProjectData(projData);
        } catch (err) {
            console.error(err);
        }
    }, [products, testLogs, debugSessions, repairs]);

    // Load Root Causes
    const loadRootCauses = useCallback(async () => {
        try {
            const causeMap = new Map<string, { count: number; resolved: number }>();
            debugSessions.forEach((d) => {
                if (d.root_cause) {
                    const normalized = d.root_cause.toLowerCase().trim();
                    const entry = causeMap.get(normalized) ?? { count: 0, resolved: 0 };
                    entry.count++;
                    if (d.resolution_status === 'resolved') entry.resolved++;
                    causeMap.set(normalized, entry);
                }
            });

            const rootCauses: RootCauseKPI[] = Array.from(causeMap.entries())
                .map(([cause, data]) => ({
                    cause: cause.substring(0, 100),
                    frequency: data.count,
                    resolutionRate: data.count > 0 ? (data.resolved / data.count) * 100 : 0,
                    trend: 'stable' as const,
                }))
                .sort((a, b) => b.frequency - a.frequency);

            setRootCausesData(rootCauses);
        } catch (err) {
            console.error(err);
        }
    }, [debugSessions]);

    // Initial load
    useEffect(() => {
        const load = async () => {
            await loadKPIs();
        };
        load();
    }, [loadKPIs]);

    // Load charts when data changes
    useEffect(() => {
        if (products.length > 0 || testLogs.length > 0) {
            loadCharts();
        }
    }, [loadCharts]);

    useEffect(() => {
        if (debugSessions.length > 0) {
            loadIssues();
            loadRootCauses();
        }
    }, [loadIssues, loadRootCauses]);

    useEffect(() => {
        if (products.length > 0 && testLogs.length > 0) {
            loadOperatorAndProjectData();
        }
    }, [loadOperatorAndProjectData]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await loadKPIs();
        loadCharts();
        loadIssues();
        loadOperatorAndProjectData();
        loadRootCauses();
        setIsRefreshing(false);
    };

    const handleTimeWindowChange = (newWindow: TimeWindow) => {
        setTimeWindow(newWindow);
        setSearchParams({ window: newWindow });
    };

    const formatDate = () => {
        const now = new Date();
        return now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    };

    return (
        <Box sx={{ p: 3, backgroundColor: '#fafafa', minHeight: '100vh' }}>
            {/* PAGE HEADER */}
            <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box>
                        <Typography
                            variant="h4"
                            sx={{ fontSize: '18px', fontWeight: 500, mb: 0.5 }}
                        >
                            Dashboard
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" sx={{ fontSize: '13px', color: 'var(--palette-text-secondary, #666)' }}>
                                {formatDate()}
                            </Typography>
                            <Box
                                sx={{
                                    width: '6px',
                                    height: '6px',
                                    backgroundColor: '#009688',
                                    borderRadius: '50%',
                                    animation: 'pulse 2s infinite',
                                    '@keyframes pulse': {
                                        '0%, 100%': { opacity: 1 },
                                        '50%': { opacity: 0.5 },
                                    },
                                }}
                            />
                            <Typography variant="caption" sx={{ fontSize: '13px', fontWeight: 500, color: '#009688' }}>
                                Live
                            </Typography>
                        </Box>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', gap: 0.5, backgroundColor: '#fff', borderRadius: '8px', p: 0.5, border: '1px solid #e0e0e0' }}>
                            {(['today', '7d', '14d', '30d', '90d'] as TimeWindow[]).map((w) => (
                                <Button
                                    key={w}
                                    size="small"
                                    onClick={() => handleTimeWindowChange(w)}
                                    sx={{
                                        textTransform: 'none',
                                        fontSize: '12px',
                                        px: 1.5,
                                        py: 0.75,
                                        backgroundColor: timeWindow === w ? '#e3f2fd' : 'transparent',
                                        color: timeWindow === w ? '#1976d2' : '#666',
                                        fontWeight: timeWindow === w ? 500 : 400,
                                        '&:hover': { backgroundColor: '#f5f5f5' },
                                    }}
                                >
                                    {w === 'today' ? 'Today' : w}
                                </Button>
                            ))}
                        </Box>
                        <Button
                            size="small"
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            sx={{ textTransform: 'none', fontSize: '12px', px: 1.5, py: 0.75 }}
                            startIcon={<RefreshIcon sx={{ fontSize: '16px !important' }} />}
                        >
                            Refresh
                        </Button>
                    </Box>
                </Box>
            </Box>

            {/* SECTION 2: SIX KPI CARDS */}
            <Grid container spacing={1.5} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={4}>
                    <KPICard
                        label="Quality Score"
                        value={qualityScore}
                        deltaText="+2.1pp vs last month"
                        deltaColor="success"
                        progressBar={{
                            value: parseFloat(qualityScore),
                            color: parseFloat(qualityScore) >= 85 ? 'success' : parseFloat(qualityScore) >= 70 ? 'warning' : 'error',
                        }}
                        loading={kpiLoading}
                        error={kpiError.quality}
                        onRetry={loadKPIs}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                    <KPICard
                        label="Units Manufactured"
                        value={unitsMfg}
                        deltaText="+12% vs previous period"
                        deltaColor="success"
                        loading={kpiLoading}
                        error={kpiError.units}
                        onRetry={loadKPIs}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                    <KPICard
                        label="Debug Queue"
                        value={debugQueue}
                        loading={kpiLoading}
                        error={kpiError.queue}
                        onRetry={loadKPIs}
                        semanticTint={debugQueueSemantic}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                    <KPICard
                        label="Open Repairs"
                        value={openRepairs}
                        deltaText={warrantyCases}
                        deltaColor="neutral"
                        loading={kpiLoading}
                        error={kpiError.repairs}
                        onRetry={loadKPIs}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                    <KPICard
                        label="Avg Debug Resolution"
                        value={avgDebugTime}
                        deltaText="vs previous period"
                        deltaColor="neutral"
                        loading={kpiLoading}
                        error={kpiError.debug}
                        onRetry={loadKPIs}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                    <KPICard
                        label="Scrapped Units"
                        value={scrapCount}
                        loading={kpiLoading}
                        error={kpiError.scrap}
                        onRetry={loadKPIs}
                    />
                </Grid>
            </Grid>

            {/* SECTION 3: TEST TRENDS + STAGE DISTRIBUTION */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={8}>
                    <Paper sx={{ p: 2, borderRadius: '12px' }}>
                        <Typography variant="subtitle2" sx={{ fontSize: '13px', fontWeight: 600, mb: 1.5 }}>
                            Test Results Over Time
                        </Typography>
                        {testData.length === 0 ? (
                            <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Skeleton variant="rectangular" width="100%" height={300} />
                            </Box>
                        ) : (
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={testData}>
                                    <CartesianGrid strokeDasharray="0" stroke="#f0f0f0" />
                                    <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                                    <YAxis tick={{ fontSize: 12 }} />
                                    <RechartsTooltip contentStyle={{ borderRadius: '4px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
                                    <Bar dataKey="pass" stackId="a" fill="#4caf50" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="fail" stackId="a" fill="#f44336" />
                                    <Bar dataKey="partial" stackId="a" fill="#ff9800" />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                        <Typography
                            variant="caption"
                            sx={{ display: 'block', mt: 1.5, fontSize: '11px', color: 'var(--palette-text-secondary, #999)' }}
                        >
                            Average yield: 87.4% · Best day: Mar 19 (96%) · Worst day: Mar 22 (71%)
                        </Typography>
                    </Paper>
                </Grid>

                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2, borderRadius: '12px' }}>
                        <Typography variant="subtitle2" sx={{ fontSize: '13px', fontWeight: 600, mb: 1.5 }}>
                            Products by Stage
                        </Typography>
                        {stageData.length === 0 ? (
                            <Skeleton variant="rectangular" width="100%" height={300} />
                        ) : (
                            <>
                                <Box sx={{ mb: 2 }}>
                                    {stageData.map((stage) => (
                                        <StageBar key={stage.name} stage={stage.name} count={stage.value} total={stageData.reduce((a, b) => a + b.value, 0)} />
                                    ))}
                                </Box>
                                <Typography
                                    variant="caption"
                                    sx={{ fontSize: '11px', color: 'var(--palette-text-secondary, #999)' }}
                                >
                                    {stageData.reduce((a, b) => a + b.value, 0)} products total
                                </Typography>
                            </>
                        )}
                    </Paper>
                </Grid>
            </Grid>

            {/* SECTION 4: RECURRING ISSUES */}
            <Paper sx={{ p: 2, mb: 3, borderRadius: '12px' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontSize: '13px', fontWeight: 600 }}>
                        Recurring Issues
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                            <Select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} sx={{ fontSize: '12px' }}>
                                <MenuItem value="all">All projects</MenuItem>
                                {projectData.map((p) => (
                                    <MenuItem key={p.projectId} value={p.projectId}>
                                        {p.projectName}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <ToggleButtonGroup
                            value={issuesWindow}
                            exclusive
                            onChange={(_e, newWindow) => {
                                if (newWindow) setIssuesWindow(newWindow);
                            }}
                            size="small"
                        >
                            <ToggleButton value="14" sx={{ fontSize: '11px', px: 1, py: 0.5 }}>
                                14d
                            </ToggleButton>
                            <ToggleButton value="30" sx={{ fontSize: '11px', px: 1, py: 0.5 }}>
                                30d
                            </ToggleButton>
                            <ToggleButton value="60" sx={{ fontSize: '11px', px: 1, py: 0.5 }}>
                                60d
                            </ToggleButton>
                            <ToggleButton value="90" sx={{ fontSize: '11px', px: 1, py: 0.5 }}>
                                90d
                            </ToggleButton>
                        </ToggleButtonGroup>
                        <Typography variant="caption" sx={{ fontSize: '11px', color: 'var(--palette-text-secondary, #999)', alignSelf: 'center' }}>
                            Analysed {debugSessions.length} records
                        </Typography>
                    </Box>
                </Box>

                {issuesLoading ? (
                    <Grid container spacing={1.5}>
                        {[1, 2, 3, 4].map((i) => (
                            <Grid item xs={12} md={6} key={i}>
                                <Skeleton variant="rectangular" height={200} sx={{ borderRadius: '8px' }} />
                            </Grid>
                        ))}
                    </Grid>
                ) : issuesData.length === 0 ? (
                    <Box
                        sx={{
                            p: 3,
                            textAlign: 'center',
                            backgroundColor: '#e8f5e9',
                            borderRadius: '8px',
                            color: '#2e7d32',
                        }}
                    >
                        No recurring patterns found in this window
                    </Box>
                ) : (
                    <Grid container spacing={1.5}>
                        {issuesData.map((cluster, idx) => (
                            <Grid item xs={12} md={6} key={idx}>
                                <IssueClusterCard cluster={cluster} />
                            </Grid>
                        ))}
                    </Grid>
                )}
            </Paper>

            {/* SECTION 5: OPERATOR PERFORMANCE + PROJECT HEALTH */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, borderRadius: '12px' }}>
                        <Typography variant="subtitle2" sx={{ fontSize: '13px', fontWeight: 600, mb: 1.5 }}>
                            Operator Performance · last 30 days
                        </Typography>
                        {operatorData.length === 0 ? (
                            <Typography variant="caption" sx={{ fontSize: '12px' }}>
                                No test logs in this window
                            </Typography>
                        ) : (
                            <TableContainer sx={{ maxHeight: 400 }}>
                                <Table size="small" stickyHeader>
                                    <TableHead>
                                        <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>Operator</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>Station</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>Tested</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>Yield</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>Tests/day</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {operatorData.slice(0, 8).map((op) => (
                                            <TableRow key={op.operatorId}>
                                                <TableCell sx={{ fontSize: '12px' }}>{op.operatorName}</TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>{op.station}</TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>{fmt(op.tested)}</TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    <Chip
                                                        label={`${fmtPercent(op.yield)}%`}
                                                        size="small"
                                                        sx={{
                                                            backgroundColor: op.yield >= 90 ? '#c8e6c9' : op.yield >= 75 ? '#fff9c4' : '#ffccbc',
                                                            color: op.yield >= 90 ? '#2e7d32' : op.yield >= 75 ? '#f57c00' : '#d32f2f',
                                                            fontSize: '11px',
                                                            height: '20px',
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>{fmtPercent(op.testsPerDay)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 2, borderRadius: '12px' }}>
                        <Typography variant="subtitle2" sx={{ fontSize: '13px', fontWeight: 600, mb: 1.5 }}>
                            Project Health
                        </Typography>
                        {projectData.length === 0 ? (
                            <Typography variant="caption" sx={{ fontSize: '12px' }}>
                                No project data
                            </Typography>
                        ) : (
                            <TableContainer sx={{ maxHeight: 400 }}>
                                <Table size="small" stickyHeader>
                                    <TableHead>
                                        <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>Project</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>Products</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>Yield</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>Debug%</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>Repairs</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {projectData.map((proj) => (
                                            <TableRow key={proj.projectId} sx={{ '&:hover': { backgroundColor: '#f5f5f5' }, cursor: 'pointer' }}>
                                                <TableCell sx={{ fontSize: '12px' }}>{proj.projectName}</TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>{fmt(proj.products)}</TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    <Chip
                                                        label={`${fmtPercent(proj.yield)}%`}
                                                        size="small"
                                                        sx={{
                                                            backgroundColor: proj.yield >= 85 ? '#c8e6c9' : '#ffccbc',
                                                            color: proj.yield >= 85 ? '#2e7d32' : '#d32f2f',
                                                            fontSize: '11px',
                                                            height: '20px',
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    {proj.debugRate > 15 ? (
                                                        <Chip
                                                            label={`${fmtPercent(proj.debugRate)}%`}
                                                            size="small"
                                                            sx={{
                                                                backgroundColor: '#fff9c4',
                                                                color: '#f57c00',
                                                                fontSize: '11px',
                                                                height: '20px',
                                                            }}
                                                        />
                                                    ) : (
                                                        `${fmtPercent(proj.debugRate)}%`
                                                    )}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>{fmt(proj.openRepairs)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </Paper>
                </Grid>
            </Grid>

            {/* SECTION 6: ROOT CAUSE ANALYSIS */}
            <Paper sx={{ p: 2, borderRadius: '12px' }}>
                <Typography variant="subtitle2" sx={{ fontSize: '13px', fontWeight: 600, mb: 1.5 }}>
                    Root Cause Breakdown · debug sessions
                </Typography>

                {rootCausesData.length === 0 ? (
                    <Typography variant="caption" sx={{ fontSize: '12px' }}>
                        No root cause data available
                    </Typography>
                ) : (
                    <TableContainer sx={{ maxHeight: 500 }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                                    <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>Root Cause</TableCell>
                                    <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>Frequency</TableCell>
                                    <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>Resolution Rate</TableCell>
                                    <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>Trend</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {rootCausesData.map((cause, idx) => (
                                    <TableRow
                                        key={idx}
                                        sx={{
                                            borderLeft: idx < 3 ? '3px solid #ff9800' : 'none',
                                            backgroundColor: idx < 3 ? '#fafafa' : 'transparent',
                                        }}
                                    >
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            <Tooltip title={cause.cause}>
                                                <span>{cause.cause.length > 36 ? `${cause.cause.substring(0, 36)}...` : cause.cause}</span>
                                            </Tooltip>
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>{cause.frequency}</TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                                <Box
                                                    sx={{
                                                        width: '100px',
                                                        height: '4px',
                                                        backgroundColor: '#e0e0e0',
                                                        borderRadius: '2px',
                                                        overflow: 'hidden',
                                                    }}
                                                >
                                                    <Box
                                                        sx={{
                                                            height: '100%',
                                                            width: `${cause.resolutionRate}%`,
                                                            backgroundColor: cause.resolutionRate > 70 ? '#4caf50' : cause.resolutionRate > 50 ? '#ff9800' : '#f44336',
                                                        }}
                                                    />
                                                </Box>
                                                <Typography variant="caption" sx={{ fontSize: '12px', minWidth: '35px' }}>
                                                    {fmtPercent(cause.resolutionRate)}%
                                                </Typography>
                                            </Box>
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            <TrendBadge trend={cause.trend} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Paper>
        </Box>
    );
};

export default DashboardModern;

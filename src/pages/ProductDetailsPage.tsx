import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Paper,
    Stack,
    Tab,
    Tabs,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';
import PageHeader from '@/components/PageHeader';
import PageFeedback from '@/components/PageFeedback';
import { customerRepairService, debugSessionService, repairSessionService, testLogService, productService } from '@/services';
import { CustomerRepair, DebugSession, Product, ProductQualityGradeHistoryEntry, RepairSession, TestLog } from '@/types';
import { toTitle } from '@/utils/workflowOptions';

interface EventRow {
    type: string;
    timestamp: Date;
    operator: string;
    station?: string;
    payload: Record<string, unknown>;
}

const getQualityGradeColor = (
    grade?: Product['quality_grade']
): 'default' | 'success' | 'warning' | 'error' => {
    if (grade === 'SCRAP') return 'error';
    if (grade === 'A' || grade === 'B') return 'success';
    if (grade === 'C' || grade === 'D') return 'warning';
    return 'default';
};

const ProductDetailsPage = () => {
    const navigate = useNavigate();
    const { productId } = useParams<{ productId: string }>();

    const [product, setProduct] = useState<Product | null>(null);
    const [testLogs, setTestLogs] = useState<TestLog[]>([]);
    const [debugSessions, setDebugSessions] = useState<DebugSession[]>([]);
    const [repairs, setRepairs] = useState<CustomerRepair[]>([]);
    const [repairSessions, setRepairSessions] = useState<RepairSession[]>([]);

    const [activeTab, setActiveTab] = useState(0);
    const [debugFilterTestLogId, setDebugFilterTestLogId] = useState<string | null>(null);

    const [expandedTestLogId, setExpandedTestLogId] = useState<string | null>(null);
    const [expandedRepairId, setExpandedRepairId] = useState<string | null>(null);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (productId) {
            void loadProductDetails();
        }
    }, [productId]);

    const loadProductDetails = async () => {
        if (!productId) return;

        try {
            setIsLoading(true);
            setError(null);

            const productData = await productService.getProductById(productId);
            setProduct(productData);

            const [testLogsRes, debugRes, repairsRes, repairSessionsRes] = await Promise.all([
                testLogService.getTestLogsByProduct(productData.product_id, 1, 500),
                debugSessionService.getDebugSessionsByProduct(productData.product_id, 1, 500),
                customerRepairService.getRepairsByProduct(productData.product_id, 1, 200),
                repairSessionService.getRepairSessionsByProduct(productData.product_id, 1, 500),
            ]);

            setTestLogs(testLogsRes.data.sort((a, b) => new Date(b.tested_at).getTime() - new Date(a.tested_at).getTime()));
            setDebugSessions(debugRes.data.sort((a, b) => new Date(b.debugged_at).getTime() - new Date(a.debugged_at).getTime()));
            setRepairs(repairsRes.data.sort((a, b) => new Date(b.received_date).getTime() - new Date(a.received_date).getTime()));
            setRepairSessions(repairSessionsRes.data.sort((a, b) => new Date(b.sessioned_at).getTime() - new Date(a.sessioned_at).getTime()));
        } catch (err: any) {
            setError(err?.response?.data?.message || err?.message || 'Failed to load product details');
            setProduct(null);
        } finally {
            setIsLoading(false);
        }
    };

    const debugSessionsByTestLog = useMemo(() => {
        const map = new Map<string, DebugSession[]>();
        for (const session of debugSessions) {
            const current = map.get(session.test_log_id) ?? [];
            current.push(session);
            map.set(session.test_log_id, current);
        }
        return map;
    }, [debugSessions]);

    const repairSessionsByRepair = useMemo(() => {
        const map = new Map<string, RepairSession[]>();
        for (const session of repairSessions) {
            const current = map.get(session.repair_id) ?? [];
            current.push(session);
            map.set(session.repair_id, current);
        }
        return map;
    }, [repairSessions]);

    const filteredDebugSessions = useMemo(() => {
        if (!debugFilterTestLogId) return debugSessions;
        return debugSessions.filter((session) => session.test_log_id === debugFilterTestLogId);
    }, [debugSessions, debugFilterTestLogId]);

    const events = useMemo(() => {
        const rows: EventRow[] = [];

        for (const log of testLogs) {
            rows.push({
                type: 'test_log',
                timestamp: new Date(log.tested_at),
                operator: log.operator_id,
                station: log.station,
                payload: log as unknown as Record<string, unknown>,
            });
        }

        for (const session of debugSessions) {
            rows.push({
                type: 'debug_session',
                timestamp: new Date(session.debugged_at),
                operator: session.technician_id,
                payload: session as unknown as Record<string, unknown>,
            });
        }

        for (const repair of repairs) {
            rows.push({
                type: 'repair_case',
                timestamp: new Date(repair.received_date),
                operator: repair.customer_id,
                payload: repair as unknown as Record<string, unknown>,
            });
        }

        for (const session of repairSessions) {
            rows.push({
                type: 'repair_session',
                timestamp: new Date(session.sessioned_at),
                operator: session.technician_id,
                payload: session as unknown as Record<string, unknown>,
            });
        }

        return rows.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }, [debugSessions, repairSessions, repairs, testLogs]);

    const qualityHistory = useMemo<ProductQualityGradeHistoryEntry[]>(() => {
        if (!product) return [];

        const entries = [...(product.quality_grade_history ?? [])].sort(
            (a, b) => new Date(b.graded_at).getTime() - new Date(a.graded_at).getTime()
        );

        if (entries.length > 0) {
            return entries;
        }

        if (product.quality_grade && product.quality_graded_at) {
            return [
                {
                    quality_grade: product.quality_grade,
                    graded_by_user_id: product.quality_graded_by ?? '-',
                    graded_by_name: product.quality_graded_by_name ?? null,
                    graded_by_email: product.quality_graded_by_email ?? null,
                    graded_at: product.quality_graded_at,
                },
            ];
        }

        return [];
    }, [product]);

    return (
        <Box>
            <PageHeader
                title={product ? `Product ${product.product_id}` : 'Product Details'}
                subtitle={product ? `${product.mac_address} • ${toTitle(product.current_stage)} • ${toTitle(product.status)}` : 'View full product lifecycle.'}
                onRefresh={loadProductDetails}
                isRefreshing={isLoading}
            />

            <PageFeedback isLoading={isLoading} error={error} />

            {product && (
                <>
                    <Card sx={{ mb: 2 }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                                <Box>
                                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                        <code>{product.mac_address}</code>
                                    </Typography>
                                    <Typography color="text.secondary">{product.product_id}</Typography>
                                </Box>

                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Chip label={toTitle(product.current_stage)} color="warning" />
                                    <Chip label={toTitle(product.status)} color="success" />
                                    <Chip
                                        label={product.quality_grade ? `Grade ${product.quality_grade}` : 'Grade -'}
                                        color={getQualityGradeColor(product.quality_grade)}
                                        variant={product.quality_grade ? 'filled' : 'outlined'}
                                    />
                                    <Button size="small" onClick={() => navigate(`/manufacturing/batches/${product.batch_id}`)}>
                                        View in Batch
                                    </Button>
                                </Box>
                            </Box>

                            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 2, mt: 2 }}>
                                <Box>
                                    <Typography color="text.secondary">Batch</Typography>
                                    <Typography sx={{ fontWeight: 700 }}>{product.batch_id}</Typography>
                                </Box>
                                <Box>
                                    <Typography color="text.secondary">Project</Typography>
                                    <Typography sx={{ fontWeight: 700 }}>{product.project_id}</Typography>
                                </Box>
                                <Box>
                                    <Typography color="text.secondary">Manufactured</Typography>
                                    <Typography sx={{ fontWeight: 700 }}>{new Date(product.manufactured_at).toLocaleString()}</Typography>
                                </Box>
                                <Box>
                                    <Typography color="text.secondary">Warranty / Customer</Typography>
                                    <Typography sx={{ fontWeight: 700 }}>
                                        {product.customer_id ? `${product.customer_id} • ${product.warranty_expiry ? new Date(product.warranty_expiry).toLocaleDateString() : '-'}` : '-'}
                                    </Typography>
                                </Box>
                            </Box>

                            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2, mt: 2 }}>
                                <Box>
                                    <Typography color="text.secondary">Quality Grade</Typography>
                                    <Typography sx={{ fontWeight: 700 }}>{product.quality_grade || '-'}</Typography>
                                </Box>
                                <Box>
                                    <Typography color="text.secondary">Graded By</Typography>
                                    <Typography sx={{ fontWeight: 700 }}>
                                        {product.quality_graded_by_name || product.quality_graded_by_email || product.quality_graded_by || '-'}
                                    </Typography>
                                </Box>
                                <Box>
                                    <Typography color="text.secondary">Graded At</Typography>
                                    <Typography sx={{ fontWeight: 700 }}>
                                        {product.quality_graded_at ? new Date(product.quality_graded_at).toLocaleString() : '-'}
                                    </Typography>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>

                    <Paper>
                        <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} variant="scrollable" scrollButtons="auto">
                            <Tab label={`Test Logs (${testLogs.length})`} />
                            <Tab label={`Debug Sessions (${debugSessions.length})`} />
                            <Tab label={`Repair Cases (${repairs.length})`} />
                            <Tab label={`Events (${events.length})`} />
                            <Tab label={`Quality History (${qualityHistory.length})`} />
                        </Tabs>

                        <Box sx={{ p: 2 }}>
                            {activeTab === 0 && (
                                <TableContainer>
                                    <Table>
                                        <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                                            <TableRow>
                                                <TableCell sx={{ fontWeight: 700 }}>Result</TableCell>
                                                <TableCell sx={{ fontWeight: 700 }}>Station</TableCell>
                                                <TableCell sx={{ fontWeight: 700 }}>Time</TableCell>
                                                <TableCell sx={{ fontWeight: 700 }}>Debug Sessions</TableCell>
                                                <TableCell sx={{ fontWeight: 700 }}>Details</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {testLogs.map((log) => {
                                                const logSessions = debugSessionsByTestLog.get(log._id) ?? [];
                                                const expanded = expandedTestLogId === log._id;

                                                return (
                                                    <Fragment key={log._id}>
                                                        <TableRow key={log._id} hover>
                                                            <TableCell>
                                                                <Chip
                                                                    label={toTitle(log.result)}
                                                                    size="small"
                                                                    color={log.result === 'pass' ? 'success' : log.result === 'partial' ? 'warning' : 'error'}
                                                                />
                                                            </TableCell>
                                                            <TableCell>{log.station}</TableCell>
                                                            <TableCell>{new Date(log.tested_at).toLocaleString()}</TableCell>
                                                            <TableCell>
                                                                <Button
                                                                    size="small"
                                                                    onClick={() => {
                                                                        setDebugFilterTestLogId(log._id);
                                                                        setActiveTab(1);
                                                                    }}
                                                                >
                                                                    {logSessions.length}
                                                                </Button>
                                                            </TableCell>
                                                            <TableCell>
                                                                <Button size="small" onClick={() => setExpandedTestLogId(expanded ? null : log._id)}>
                                                                    {expanded ? 'Hide' : 'Expand'}
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>

                                                        {expanded && (
                                                            <TableRow>
                                                                <TableCell colSpan={5}>
                                                                    <Typography variant="body2">Symptoms: {log.symptoms || '-'}</Typography>
                                                                    <Typography variant="body2">Notes: {log.notes || '-'}</Typography>
                                                                    <Typography variant="body2">Operator: {log.operator_id}</Typography>
                                                                </TableCell>
                                                            </TableRow>
                                                        )}
                                                    </Fragment>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}

                            {activeTab === 1 && (
                                <Box>
                                    {debugFilterTestLogId && (
                                        <Box sx={{ mb: 1.5 }}>
                                            <Chip label={`Filtered by test log ${debugFilterTestLogId}`} onDelete={() => setDebugFilterTestLogId(null)} />
                                        </Box>
                                    )}

                                    {filteredDebugSessions.length === 0 ? (
                                        <Typography color="text.secondary">No debug sessions found.</Typography>
                                    ) : (
                                        <Stack spacing={1.5}>
                                            {filteredDebugSessions.map((session) => (
                                                <Paper key={session._id} variant="outlined" sx={{ p: 1.5 }}>
                                                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                                        Test Log: {session.test_log_id}
                                                    </Typography>
                                                    <Typography variant="body2">Issue: {session.issue_identified}</Typography>
                                                    <Typography variant="body2">Root Cause: {session.root_cause}</Typography>
                                                    <Typography variant="body2">Action: {session.action_taken}</Typography>
                                                    <Typography variant="body2">Resolution: {toTitle(session.resolution_status)}</Typography>
                                                    <Typography variant="body2">Technician: {session.technician_id}</Typography>
                                                    <Typography variant="body2">Time: {new Date(session.debugged_at).toLocaleString()}</Typography>
                                                </Paper>
                                            ))}
                                        </Stack>
                                    )}
                                </Box>
                            )}

                            {activeTab === 2 && (
                                <Box>
                                    {repairs.length === 0 ? (
                                        <Typography color="text.secondary">No customer repair cases recorded.</Typography>
                                    ) : (
                                        <Stack spacing={1.5}>
                                            {repairs.map((repair) => {
                                                const expanded = expandedRepairId === repair._id;
                                                const sessionsForRepair = repairSessionsByRepair.get(repair._id) ?? [];

                                                return (
                                                    <Paper key={repair._id} variant="outlined" sx={{ p: 1.5 }}>
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                                                            <Typography sx={{ fontWeight: 700 }}>{repair._id}</Typography>
                                                            <Chip label={toTitle(repair.status)} size="small" />
                                                        </Box>
                                                        <Typography variant="body2">Complaint: {repair.complaint}</Typography>
                                                        <Typography variant="body2">Customer: {repair.customer_id}</Typography>
                                                        <Typography variant="body2">Received: {new Date(repair.received_date).toLocaleString()}</Typography>

                                                        <Box sx={{ mt: 1 }}>
                                                            <Button size="small" onClick={() => setExpandedRepairId(expanded ? null : repair._id)}>
                                                                {expanded ? 'Hide Sessions' : `Show Sessions (${sessionsForRepair.length})`}
                                                            </Button>
                                                        </Box>

                                                        {expanded && (
                                                            <Stack spacing={1} sx={{ mt: 1 }}>
                                                                {sessionsForRepair.length === 0 ? (
                                                                    <Typography variant="body2" color="text.secondary">
                                                                        No sessions logged.
                                                                    </Typography>
                                                                ) : (
                                                                    sessionsForRepair.map((session) => (
                                                                        <Paper key={session._id} variant="outlined" sx={{ p: 1 }}>
                                                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                                                {session.issue_identified}
                                                                            </Typography>
                                                                            <Typography variant="caption">{session.action_taken}</Typography>
                                                                            <Typography variant="caption" sx={{ display: 'block' }}>
                                                                                {toTitle(session.resolution_status)} • {new Date(session.sessioned_at).toLocaleString()}
                                                                            </Typography>
                                                                        </Paper>
                                                                    ))
                                                                )}
                                                            </Stack>
                                                        )}
                                                    </Paper>
                                                );
                                            })}
                                        </Stack>
                                    )}
                                </Box>
                            )}

                            {activeTab === 3 && (
                                <Stack spacing={1.5}>
                                    {events.length === 0 ? (
                                        <Typography color="text.secondary">No lifecycle events available.</Typography>
                                    ) : (
                                        events.map((event, index) => (
                                            <Paper key={`${event.type}-${index}`} variant="outlined" sx={{ p: 1.5 }}>
                                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                                    {toTitle(event.type)}
                                                </Typography>
                                                <Typography variant="body2">Time: {event.timestamp.toLocaleString()}</Typography>
                                                <Typography variant="body2">Operator: {event.operator}</Typography>
                                                {event.station && <Typography variant="body2">Station: {event.station}</Typography>}
                                                <Box
                                                    component="pre"
                                                    sx={{
                                                        mt: 1,
                                                        p: 1,
                                                        bgcolor: '#f7f7f7',
                                                        borderRadius: 1,
                                                        fontSize: '0.72rem',
                                                        overflowX: 'auto',
                                                    }}
                                                >
                                                    {JSON.stringify(event.payload, null, 2)}
                                                </Box>
                                            </Paper>
                                        ))
                                    )}
                                </Stack>
                            )}

                            {activeTab === 4 && (
                                <Box>
                                    {qualityHistory.length === 0 ? (
                                        <Typography color="text.secondary">No quality grading history available.</Typography>
                                    ) : (
                                        <TableContainer>
                                            <Table>
                                                <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                                                    <TableRow>
                                                        <TableCell sx={{ fontWeight: 700 }}>Grade</TableCell>
                                                        <TableCell sx={{ fontWeight: 700 }}>Graded By</TableCell>
                                                        <TableCell sx={{ fontWeight: 700 }}>User ID</TableCell>
                                                        <TableCell sx={{ fontWeight: 700 }}>Time</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {qualityHistory.map((entry, index) => (
                                                        <TableRow key={`${entry.graded_by_user_id}-${entry.graded_at}-${index}`}>
                                                            <TableCell>
                                                                <Chip
                                                                    size="small"
                                                                    label={entry.quality_grade}
                                                                    color={getQualityGradeColor(entry.quality_grade)}
                                                                />
                                                            </TableCell>
                                                            <TableCell>{entry.graded_by_name || entry.graded_by_email || '-'}</TableCell>
                                                            <TableCell>{entry.graded_by_user_id}</TableCell>
                                                            <TableCell>{new Date(entry.graded_at).toLocaleString()}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    )}
                                </Box>
                            )}
                        </Box>
                    </Paper>
                </>
            )}
        </Box>
    );
};

export default ProductDetailsPage;


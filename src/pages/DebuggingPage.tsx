import { Fragment, useEffect, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Collapse,
    FormControlLabel,
    Grid,
    MenuItem,
    Paper,
    Select,
    Stack,
    Switch,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import { AlertTriangle, RotateCcw, Wrench } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import PageFeedback from '@/components/PageFeedback';
import EmptyState from '@/components/ui/EmptyState';
import MetricCard from '@/components/ui/MetricCard';
import StatusChip from '@/components/ui/StatusChip';
import { debugSessionService, productService, testLogService } from '@/services';
import { DebugSession, Product, TestLog } from '@/types';
import { useAppSelector } from '@/hooks/redux';
import { useAppUI } from '@/context/AppUIContext';
import { DEBUG_RESOLUTION_OPTIONS, toTitle } from '@/utils/workflowOptions';
import { hasPermission } from '@/utils/rbac';

interface DebugFormState {
    issue_identified: string;
    root_cause: string;
    action_taken: string;
    resolution_status: DebugSession['resolution_status'];
    re_test_required: boolean;
    internal_notes: string;
}

const defaultForm: DebugFormState = {
    issue_identified: '',
    root_cause: '',
    action_taken: '',
    resolution_status: 'unresolved',
    re_test_required: false,
    internal_notes: '',
};

interface QueueItem {
    log: TestLog;
    product: Product | null;
    sessions: DebugSession[];
    latestSession: DebugSession | null;
}

const getAgeText = (date: Date): string => {
    const diffMs = Date.now() - date.getTime();
    const mins = Math.max(1, Math.floor(diffMs / 60000));

    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remain = mins % 60;
    if (hours < 24) return `${hours}h ${remain}m`;
    const days = Math.floor(hours / 24);
    const remainH = hours % 24;
    return `${days}d ${remainH}h`;
};

const DebuggingPage = () => {
    const { user } = useAppSelector((state) => state.auth);
    const { notify, confirm } = useAppUI();
    const canWriteDebugSessions =
        hasPermission(user?.role, 'debugging.create') || hasPermission(user?.role, 'debugging.update');

    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
    const [forms, setForms] = useState<Record<string, DebugFormState>>({});
    const [submittingLogId, setSubmittingLogId] = useState<string | null>(null);

    useEffect(() => {
        void loadQueue();
    }, []);

    const loadQueue = async () => {
        try {
            setIsLoading(true);
            setError(null);

            const [testLogsRes, debugSessionsRes] = await Promise.all([
                testLogService.getTestLogs(1, 1000),
                debugSessionService.getDebugSessions(1, 1000),
            ]);

            const failedLogs = testLogsRes.data
                .filter((log) => log.result === 'fail' || log.result === 'partial')
                .sort((a, b) => new Date(a.tested_at).getTime() - new Date(b.tested_at).getTime());

            const sessionsByTestLog = new Map<string, DebugSession[]>();
            for (const session of debugSessionsRes.data) {
                const current = sessionsByTestLog.get(session.test_log_id) ?? [];
                current.push(session);
                sessionsByTestLog.set(session.test_log_id, current);
            }

            const productIds = Array.from(new Set(failedLogs.map((log) => log.product_id)));
            const productsById = new Map<string, Product>();

            await Promise.all(
                productIds.map(async (productId) => {
                    try {
                        const product = await productService.getProductById(productId);
                        productsById.set(productId, product);
                    } catch {
                        // Product may no longer exist.
                    }
                })
            );

            const queueItems: QueueItem[] = failedLogs
                .map((log) => {
                    const sessions = [...(sessionsByTestLog.get(log._id) ?? [])].sort(
                        (a, b) => new Date(a.debugged_at).getTime() - new Date(b.debugged_at).getTime()
                    );
                    const latestSession = sessions.length > 0 ? sessions[sessions.length - 1] : null;

                    return {
                        log,
                        product: productsById.get(log.product_id) ?? null,
                        sessions,
                        latestSession,
                    };
                })
                .filter((item) => {
                    if (!item.latestSession) return true;
                    if (item.latestSession.re_test_required) return false;
                    return item.latestSession.resolution_status !== 'resolved' && item.latestSession.resolution_status !== 'scrapped';
                });

            setQueue(queueItems);

            setForms((prev) => {
                const next = { ...prev };
                for (const item of queueItems) {
                    if (!next[item.log._id]) {
                        next[item.log._id] = { ...defaultForm };
                    }
                }
                return next;
            });
        } catch (err: any) {
            setError(err?.response?.data?.message || err?.message || 'Failed to load debugging queue');
        } finally {
            setIsLoading(false);
        }
    };

    const queueDepth = queue.length;

    const getForm = (logId: string): DebugFormState => forms[logId] ?? defaultForm;

    const updateForm = (logId: string, patch: Partial<DebugFormState>) => {
        setForms((prev) => {
            const current = prev[logId] ?? { ...defaultForm };
            const merged = { ...current, ...patch };

            if (patch.resolution_status && (patch.resolution_status === 'resolved' || patch.resolution_status === 'partially_resolved')) {
                merged.re_test_required = true;
            }

            return {
                ...prev,
                [logId]: merged,
            };
        });
    };

    const submitDebugSession = async (item: QueueItem) => {
        if (!canWriteDebugSessions) {
            notify({ message: 'You do not have permission to add debug sessions.', severity: 'error' });
            return;
        }

        const form = getForm(item.log._id);

        if (!form.issue_identified.trim() || !form.root_cause.trim() || !form.action_taken.trim()) {
            notify({ message: 'Issue identified, root cause, and action taken are required.', severity: 'warning' });
            return;
        }

        if (form.resolution_status === 'scrapped') {
            const approved = await confirm({
                title: 'Mark As Scrapped',
                message: `Mark ${item.log.product_id} as scrapped? This cannot be undone.`,
                confirmText: 'Scrap Product',
                tone: 'error',
            });

            if (!approved) return;
        }

        try {
            setSubmittingLogId(item.log._id);

            const actionTaken = form.internal_notes.trim()
                ? `${form.action_taken.trim()}\n\nInternal notes: ${form.internal_notes.trim()}`
                : form.action_taken.trim();

            await debugSessionService.createDebugSession({
                test_log_id: item.log._id,
                product_id: item.log.product_id,
                mac_address: item.log.mac_address,
                issue_identified: form.issue_identified.trim(),
                root_cause: form.root_cause.trim(),
                action_taken: actionTaken,
                technician_id: user?._id ?? 'SYSTEM',
                resolution_status: form.resolution_status,
                re_test_required: form.re_test_required,
                debugged_at: new Date(),
            });

            if (item.product) {
                if (form.re_test_required) {
                    await productService.updateProductStage(item.product.product_id, {
                        current_stage: 'testing',
                        status: 'active',
                    });
                } else if (form.resolution_status === 'scrapped') {
                    await productService.updateProductStage(item.product.product_id, {
                        current_stage: 'repair',
                        status: 'returned',
                    });
                } else if (form.resolution_status === 'resolved') {
                    await productService.updateProductStage(item.product.product_id, {
                        current_stage: 'qc',
                        status: 'active',
                    });
                }
            }

            notify({ message: 'Debug session saved.', severity: 'success' });
            await loadQueue();
        } catch (err: any) {
            notify({ message: err?.response?.data?.message || err?.message || 'Failed to save debug session', severity: 'error' });
        } finally {
            setSubmittingLogId(null);
        }
    };

    return (
        <Box>
            <PageHeader
                title="Debugging Queue"
                subtitle={`${queueDepth} device${queueDepth === 1 ? '' : 's'} waiting`}
                countLabel={`${queueDepth} in queue`}
                onRefresh={loadQueue}
                isRefreshing={isLoading}
            />

            <PageFeedback isLoading={isLoading} error={error} />

            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={4}>
                    <MetricCard title="Queue Depth" value={queueDepth} subtitle="Failed or partial test results awaiting action" icon={<Wrench size={18} />} />
                </Grid>
                <Grid item xs={12} md={4}>
                    <MetricCard
                        title="Re-test Awaiting"
                        value={queue.filter((item) => item.latestSession?.re_test_required).length}
                        subtitle="Items already sent back for verification"
                        icon={<RotateCcw size={18} />}
                        accent="#F7A84F"
                    />
                </Grid>
                <Grid item xs={12} md={4}>
                    <MetricCard
                        title="Repeat Failures"
                        value={queue.filter((item) => item.sessions.length > 0).length}
                        subtitle="Products with previous debug history"
                        icon={<AlertTriangle size={18} />}
                        accent="#F75F5F"
                    />
                </Grid>
            </Grid>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Product</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>MAC</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Symptoms</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Station</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Waiting</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Previous Sessions</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Action</TableCell>
                        </TableRow>
                    </TableHead>

                    <TableBody>
                        {queue.length === 0 && !isLoading && (
                            <TableRow>
                                <TableCell colSpan={7} sx={{ py: 3 }}>
                                    <EmptyState
                                        icon={<Wrench size={24} />}
                                        title="Debug queue is empty"
                                        description="No failed or partial products are currently waiting for debugging work."
                                    />
                                </TableCell>
                            </TableRow>
                        )}

                        {queue.map((item) => {
                            const previousSessions = item.sessions.length;
                            const isExpanded = expandedLogId === item.log._id;
                            const form = getForm(item.log._id);

                            return (
                                <Fragment key={item.log._id}>
                                    <TableRow
                                        hover
                                        sx={
                                            previousSessions > 0
                                                ? {
                                                      borderLeft: '4px solid #ed6c02',
                                                  }
                                                : undefined
                                        }
                                    >
                                        <TableCell>{item.log.product_id}</TableCell>
                                        <TableCell>{item.log.mac_address}</TableCell>
                                        <TableCell>{(item.log.symptoms || '-').slice(0, 80)}</TableCell>
                                        <TableCell>{item.log.station}</TableCell>
                                        <TableCell>{getAgeText(new Date(item.log.tested_at))}</TableCell>
                                        <TableCell>
                                            <StatusChip label={`${previousSessions} session${previousSessions === 1 ? '' : 's'}`} value={previousSessions > 0 ? 'partial' : 'active'} />
                                        </TableCell>
                                        <TableCell>
                                            <Button size="small" onClick={() => setExpandedLogId(isExpanded ? null : item.log._id)}>
                                                {isExpanded ? 'Hide' : 'Open'}
                                            </Button>
                                        </TableCell>
                                    </TableRow>

                                    <TableRow>
                                        <TableCell colSpan={7} sx={{ p: 0, borderBottom: isExpanded ? undefined : 0 }}>
                                            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                                <Box sx={{ p: 2.5, bgcolor: 'rgba(255,255,255,0.025)' }}>
                                                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
                                                        <Paper variant="outlined" sx={{ p: 1.5, backgroundColor: 'rgba(255,255,255,0.02)' }}>
                                                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                                                                Test Log Detail
                                                            </Typography>
                                                            <Typography variant="body2">Symptoms: {item.log.symptoms || '-'}</Typography>
                                                            <Typography variant="body2">Notes: {item.log.notes || '-'}</Typography>
                                                            <Typography variant="body2">Station: {item.log.station}</Typography>
                                                            <Typography variant="body2">Operator: {item.log.operator_id}</Typography>
                                                            <Typography variant="body2">Time: {new Date(item.log.tested_at).toLocaleString()}</Typography>
                                                        </Paper>

                                                        <Paper variant="outlined" sx={{ p: 1.5, backgroundColor: 'rgba(255,255,255,0.02)' }}>
                                                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                                                                Debug History
                                                            </Typography>

                                                            {item.sessions.length === 0 ? (
                                                                <Typography variant="body2" color="text.secondary">
                                                                    No previous sessions.
                                                                </Typography>
                                                            ) : (
                                                                <Stack spacing={1}>
                                                                    {item.sessions
                                                                        .slice()
                                                                        .sort((a, b) => new Date(b.debugged_at).getTime() - new Date(a.debugged_at).getTime())
                                                                        .map((session) => (
                                                                            <Paper key={session._id} variant="outlined" sx={{ p: 1, backgroundColor: 'rgba(255,255,255,0.02)' }}>
                                                                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                                                    {session.issue_identified}
                                                                                </Typography>
                                                                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                                                                    {toTitle(session.resolution_status)} • {new Date(session.debugged_at).toLocaleString()}
                                                                                </Typography>
                                                                                <Typography variant="caption" sx={{ display: 'block' }}>
                                                                                    {session.action_taken}
                                                                                </Typography>
                                                                            </Paper>
                                                                        ))}
                                                                </Stack>
                                                            )}
                                                        </Paper>
                                                    </Box>

                                                    <Box sx={{ mt: 2 }}>
                                                        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                                                            Add Debug Session
                                                        </Typography>

                                                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
                                                            <TextField
                                                                fullWidth
                                                                label="Issue Identified"
                                                                value={form.issue_identified}
                                                                onChange={(event) => updateForm(item.log._id, { issue_identified: event.target.value })}
                                                            />

                                                            <TextField
                                                                fullWidth
                                                                label="Root Cause"
                                                                value={form.root_cause}
                                                                onChange={(event) => updateForm(item.log._id, { root_cause: event.target.value })}
                                                            />
                                                        </Box>

                                                        <TextField
                                                            fullWidth
                                                            multiline
                                                            rows={3}
                                                            label="Action Taken"
                                                            value={form.action_taken}
                                                            onChange={(event) => updateForm(item.log._id, { action_taken: event.target.value })}
                                                            sx={{ mt: 1.5 }}
                                                        />

                                                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5, mt: 1.5 }}>
                                                            <Select
                                                                fullWidth
                                                                value={form.resolution_status}
                                                                onChange={(event) => updateForm(item.log._id, { resolution_status: event.target.value as DebugSession['resolution_status'] })}
                                                            >
                                                                {DEBUG_RESOLUTION_OPTIONS.map((option) => (
                                                                    <MenuItem key={option} value={option}>
                                                                        {toTitle(option)}
                                                                    </MenuItem>
                                                                ))}
                                                            </Select>

                                                            <FormControlLabel
                                                                control={
                                                                    <Switch
                                                                        checked={form.re_test_required}
                                                                        onChange={(event) => updateForm(item.log._id, { re_test_required: event.target.checked })}
                                                                    />
                                                                }
                                                                label="Re-test required"
                                                            />
                                                        </Box>

                                                        <TextField
                                                            fullWidth
                                                            multiline
                                                            rows={2}
                                                            label="Internal Notes (Optional)"
                                                            value={form.internal_notes}
                                                            onChange={(event) => updateForm(item.log._id, { internal_notes: event.target.value })}
                                                            sx={{ mt: 1.5 }}
                                                        />

                                                        {item.product?.current_stage !== 'debugging' && (
                                                            <Alert severity="warning" sx={{ mt: 1.5 }}>
                                                                Backend product stage is currently {toTitle(item.product?.current_stage ?? 'unknown')}. Queue is inferred from failed/partial test flow.
                                                            </Alert>
                                                        )}

                                                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.5 }}>
                                                            <Button
                                                                variant="contained"
                                                                onClick={() => void submitDebugSession(item)}
                                                                disabled={!canWriteDebugSessions || submittingLogId === item.log._id}
                                                            >
                                                                {submittingLogId === item.log._id ? 'Saving...' : 'Save Debug Session'}
                                                            </Button>
                                                        </Box>
                                                    </Box>
                                                </Box>
                                            </Collapse>
                                        </TableCell>
                                    </TableRow>
                                </Fragment>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default DebuggingPage;


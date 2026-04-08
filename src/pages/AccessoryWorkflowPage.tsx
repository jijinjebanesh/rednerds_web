import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Box,
    Button,
    Card,
    CardContent,
    Grid,
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { Bug, CheckCircle2, PackagePlus, ShieldCheck, Wrench } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import PageFeedback from '@/components/PageFeedback';
import ActionDrawer from '@/components/ui/ActionDrawer';
import EmptyState from '@/components/ui/EmptyState';
import MetricCard from '@/components/ui/MetricCard';
import SectionLabel from '@/components/ui/SectionLabel';
import StatusChip from '@/components/ui/StatusChip';
import { accessoryWorkflowService, projectService } from '@/services';
import { AccessoryWorkflow } from '@/services/accessoryWorkflows';
import { Project } from '@/types';
import { useAppSelector } from '@/hooks/redux';
import { hasPermission } from '@/utils/rbac';
import { useAppUI } from '@/context/AppUIContext';

interface CreateTargetForm {
    project_id: string;
    accessory_name: string;
    target_qty: string;
    notes: string;
}

interface TestingForm {
    passed_qty: string;
    failed_qty: string;
    notes: string;
}

interface DebugForm {
    fixed_qty: string;
    scrapped_qty: string;
    notes: string;
}

interface QcForm {
    grade_a_qty: string;
    grade_b_qty: string;
    grade_c_qty: string;
    grade_d_qty: string;
    scrap_qty: string;
    notes: string;
}

const initialCreateTargetForm: CreateTargetForm = {
    project_id: '',
    accessory_name: '',
    target_qty: '',
    notes: '',
};

const initialTestingForm: TestingForm = {
    passed_qty: '',
    failed_qty: '',
    notes: '',
};

const initialDebugForm: DebugForm = {
    fixed_qty: '',
    scrapped_qty: '',
    notes: '',
};

const initialQcForm: QcForm = {
    grade_a_qty: '',
    grade_b_qty: '',
    grade_c_qty: '',
    grade_d_qty: '',
    scrap_qty: '',
    notes: '',
};

const toInt = (value: string): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) return NaN;
    return parsed;
};

const QuantityField = ({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
}) => (
    <TextField fullWidth label={label} type="number" value={value} onChange={(event) => onChange(event.target.value)} inputProps={{ min: 0 }} />
);

const SegmentBar = ({ workflow }: { workflow: AccessoryWorkflow }) => {
    const target = Math.max(1, workflow.target_qty);
    const tested = workflow.metrics.tested_total_qty;
    const debugBacklog = workflow.metrics.failed_backlog_qty;
    const qcBacklog = workflow.metrics.qc_backlog_qty;
    const remaining = workflow.metrics.remaining_for_testing_qty;

    const segments = [
        { label: 'Tested', value: tested, color: '#4F8EF7' },
        { label: 'Debug Backlog', value: debugBacklog, color: '#F7A84F' },
        { label: 'QC Backlog', value: qcBacklog, color: '#A78BFA' },
        { label: 'Remaining', value: remaining, color: 'rgba(255,255,255,0.18)' },
    ];

    return (
        <Stack spacing={1.25}>
            <Box
                sx={{
                    display: 'flex',
                    height: 12,
                    overflow: 'hidden',
                    borderRadius: 999,
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    border: debugBacklog > workflow.target_qty * 0.2 || qcBacklog > workflow.target_qty * 0.2 ? '1px solid rgba(247,168,79,0.48)' : '1px solid transparent',
                }}
            >
                {segments.map((segment) => (
                    <Box key={segment.label} sx={{ width: `${(segment.value / target) * 100}%`, backgroundColor: segment.color, minWidth: segment.value > 0 ? 6 : 0 }} />
                ))}
            </Box>
            <Stack direction="row" flexWrap="wrap" spacing={1} useFlexGap>
                {segments.map((segment) => (
                    <Typography key={segment.label} variant="caption" color="text.secondary">
                        {segment.label}: {segment.value}
                    </Typography>
                ))}
            </Stack>
        </Stack>
    );
};

const AccessoryWorkflowPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const role = useAppSelector((state) => state.auth.user?.role);
    const { notify } = useAppUI();

    const [accessoryProjects, setAccessoryProjects] = useState<Project[]>([]);
    const [workflows, setWorkflows] = useState<AccessoryWorkflow[]>([]);
    const [total, setTotal] = useState(0);
    const [page] = useState(0);
    const [rowsPerPage] = useState(50);
    const [projectFilter, setProjectFilter] = useState<string>(searchParams.get('project_id') ?? 'all');
    const [search, setSearch] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [openCreateDrawer, setOpenCreateDrawer] = useState(false);
    const [createTargetForm, setCreateTargetForm] = useState<CreateTargetForm>(initialCreateTargetForm);
    const [selectedWorkflow, setSelectedWorkflow] = useState<AccessoryWorkflow | null>(null);
    const [activeDrawer, setActiveDrawer] = useState<'testing' | 'debug' | 'qc' | null>(null);
    const [testingForm, setTestingForm] = useState<TestingForm>(initialTestingForm);
    const [debugForm, setDebugForm] = useState<DebugForm>(initialDebugForm);
    const [qcForm, setQcForm] = useState<QcForm>(initialQcForm);

    const canCreateTarget = hasPermission(role, 'accessory.target.create');
    const canLogTesting = hasPermission(role, 'accessory.testing.log');
    const canLogDebug = hasPermission(role, 'accessory.debug.log');
    const canLogQc = hasPermission(role, 'accessory.qc.log');

    useEffect(() => {
        void loadAccessoryProjects();
    }, []);

    useEffect(() => {
        void loadWorkflows();
    }, [page, rowsPerPage, projectFilter]);

    useEffect(() => {
        const params: Record<string, string> = {};
        if (projectFilter !== 'all') {
            params.project_id = projectFilter;
        }
        setSearchParams(params, { replace: true });
    }, [projectFilter, setSearchParams]);

    const filteredWorkflows = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return workflows;

        return workflows.filter((workflow) => {
            return (
                workflow.accessory_name.toLowerCase().includes(term) ||
                (workflow.project_name || '').toLowerCase().includes(term) ||
                workflow.project_id.toLowerCase().includes(term)
            );
        });
    }, [workflows, search]);

    const loadAccessoryProjects = async () => {
        try {
            const projects = await projectService.getProjects(1, 500, undefined, 'accessory');
            setAccessoryProjects(projects.data);
        } catch {
            setAccessoryProjects([]);
        }
    };

    const loadWorkflows = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await accessoryWorkflowService.getWorkflows(page + 1, rowsPerPage, {
                project_id: projectFilter === 'all' ? undefined : projectFilter,
            });
            setWorkflows(response.data);
            setTotal(response.total);
        } catch (err: any) {
            setError(err?.response?.data?.message || err?.message || 'Failed to load accessory workflows');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateTarget = async () => {
        const targetQty = toInt(createTargetForm.target_qty);
        if (!createTargetForm.project_id || !createTargetForm.accessory_name.trim() || Number.isNaN(targetQty) || targetQty <= 0) {
            notify({ message: 'Project, accessory name, and valid target quantity are required.', severity: 'warning' });
            return;
        }

        try {
            setIsLoading(true);
            await accessoryWorkflowService.createWorkflow({
                project_id: createTargetForm.project_id,
                accessory_name: createTargetForm.accessory_name.trim(),
                target_qty: targetQty,
                notes: createTargetForm.notes.trim(),
            });
            notify({ message: 'Accessory target created successfully.', severity: 'success' });
            setOpenCreateDrawer(false);
            setCreateTargetForm(initialCreateTargetForm);
            await loadWorkflows();
        } catch (err: any) {
            notify({ message: err?.response?.data?.message || err?.message || 'Failed to create accessory target', severity: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const openStageDrawer = (workflow: AccessoryWorkflow, drawer: 'testing' | 'debug' | 'qc') => {
        setSelectedWorkflow(workflow);
        setActiveDrawer(drawer);
        setTestingForm(initialTestingForm);
        setDebugForm(initialDebugForm);
        setQcForm(initialQcForm);
    };

    const handleSaveTesting = async () => {
        if (!selectedWorkflow) return;
        const passedQty = toInt(testingForm.passed_qty || '0');
        const failedQty = toInt(testingForm.failed_qty || '0');
        if (Number.isNaN(passedQty) || Number.isNaN(failedQty) || passedQty + failedQty <= 0) {
            notify({ message: 'Enter valid pass/fail quantities.', severity: 'warning' });
            return;
        }

        try {
            setIsLoading(true);
            await accessoryWorkflowService.createTestingLog(selectedWorkflow._id, {
                passed_qty: passedQty,
                failed_qty: failedQty,
                notes: testingForm.notes.trim(),
            });
            notify({ message: 'Testing counts saved.', severity: 'success' });
            setActiveDrawer(null);
            await loadWorkflows();
        } catch (err: any) {
            notify({ message: err?.response?.data?.message || err?.message || 'Failed to save testing counts', severity: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveDebug = async () => {
        if (!selectedWorkflow) return;
        const fixedQty = toInt(debugForm.fixed_qty || '0');
        const scrappedQty = toInt(debugForm.scrapped_qty || '0');
        if (Number.isNaN(fixedQty) || Number.isNaN(scrappedQty) || fixedQty + scrappedQty <= 0) {
            notify({ message: 'Enter valid fixed/scrapped quantities.', severity: 'warning' });
            return;
        }

        try {
            setIsLoading(true);
            await accessoryWorkflowService.createDebugLog(selectedWorkflow._id, {
                fixed_qty: fixedQty,
                scrapped_qty: scrappedQty,
                notes: debugForm.notes.trim(),
            });
            notify({ message: 'Debug counts saved.', severity: 'success' });
            setActiveDrawer(null);
            await loadWorkflows();
        } catch (err: any) {
            notify({ message: err?.response?.data?.message || err?.message || 'Failed to save debug counts', severity: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveQc = async () => {
        if (!selectedWorkflow) return;
        const payload = {
            grade_a_qty: toInt(qcForm.grade_a_qty || '0'),
            grade_b_qty: toInt(qcForm.grade_b_qty || '0'),
            grade_c_qty: toInt(qcForm.grade_c_qty || '0'),
            grade_d_qty: toInt(qcForm.grade_d_qty || '0'),
            scrap_qty: toInt(qcForm.scrap_qty || '0'),
        };

        const totalInput = Object.values(payload).reduce((sum, value) => (Number.isNaN(value) ? sum : sum + value), 0);
        if (Object.values(payload).some((value) => Number.isNaN(value)) || totalInput <= 0) {
            notify({ message: 'Enter valid QC grading quantities.', severity: 'warning' });
            return;
        }

        try {
            setIsLoading(true);
            await accessoryWorkflowService.createQcLog(selectedWorkflow._id, {
                ...payload,
                notes: qcForm.notes.trim(),
            });
            notify({ message: 'QC grading counts saved.', severity: 'success' });
            setActiveDrawer(null);
            await loadWorkflows();
        } catch (err: any) {
            notify({ message: err?.response?.data?.message || err?.message || 'Failed to save QC grading counts', severity: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const accessoryBacklog = useMemo(() => {
        return filteredWorkflows.reduce((sum, workflow) => sum + workflow.metrics.failed_backlog_qty + workflow.metrics.qc_backlog_qty, 0);
    }, [filteredWorkflows]);

    return (
        <Box>
            <PageHeader
                title="Accessory Workflows"
                subtitle="Quantity-driven tracking for non-serialized modules, sensors, displays, switches, and other accessory classes."
                countLabel={`${total} workflows`}
                onRefresh={loadWorkflows}
                isRefreshing={isLoading}
                primaryAction={canCreateTarget ? { label: 'Create Target', onClick: () => setOpenCreateDrawer(true) } : undefined}
            />

            <PageFeedback isLoading={isLoading} error={error} />

            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={4}>
                    <MetricCard title="Active Workflows" value={filteredWorkflows.length} subtitle="Accessory quantity pipelines in view" icon={<PackagePlus size={18} />} />
                </Grid>
                <Grid item xs={12} md={4}>
                    <MetricCard title="Accessory Backlog" value={accessoryBacklog} subtitle="Combined debug and QC backlog" icon={<Wrench size={18} />} accent="#F7A84F" />
                </Grid>
                <Grid item xs={12} md={4}>
                    <MetricCard title="QC Ready" value={filteredWorkflows.reduce((sum, workflow) => sum + workflow.metrics.qc_backlog_qty, 0)} subtitle="Ready for grading input" icon={<ShieldCheck size={18} />} accent="#A78BFA" />
                </Grid>
            </Grid>

            <Stack direction={{ xs: 'column', xl: 'row' }} spacing={1.5} sx={{ mb: 3 }}>
                <TextField
                    fullWidth
                    placeholder="Search accessory name, project, or workflow"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                />

                <Select fullWidth value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
                    <MenuItem value="all">All accessory projects</MenuItem>
                    {accessoryProjects.map((project) => (
                        <MenuItem key={project._id} value={project._id}>
                            {project.name}
                        </MenuItem>
                    ))}
                </Select>
            </Stack>

            {filteredWorkflows.length === 0 && !isLoading ? (
                <EmptyState
                    icon={<PackagePlus size={24} />}
                    title="No accessory workflows found"
                    description="Create an accessory target to start quantity-based tracking for sensors, displays, modules, and other non-serialized items."
                    action={canCreateTarget ? { label: 'Create target', onClick: () => setOpenCreateDrawer(true) } : undefined}
                />
            ) : (
                <Grid container spacing={2}>
                    {filteredWorkflows.map((workflow) => {
                        const backlogWarning =
                            workflow.metrics.failed_backlog_qty > workflow.target_qty * 0.2 ||
                            workflow.metrics.qc_backlog_qty > workflow.target_qty * 0.2;

                        return (
                            <Grid item xs={12} lg={6} key={workflow._id}>
                                <Card sx={{ height: '100%' }}>
                                    <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.25, height: '100%' }}>
                                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                                            <Box>
                                                <Typography variant="overline">{workflow.project_name || workflow.project_id}</Typography>
                                                <Typography variant="h6">{workflow.accessory_name}</Typography>
                                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                    Target quantity: {workflow.target_qty}
                                                </Typography>
                                            </Box>
                                            {backlogWarning ? <StatusChip label="Backlog Warning" value="partial" /> : <StatusChip label="Healthy" value="active" />}
                                        </Stack>

                                        <SegmentBar workflow={workflow} />

                                        <Grid container spacing={1.5}>
                                            <Grid item xs={6} md={3}>
                                                <Typography variant="body2" color="text.secondary">Passed</Typography>
                                                <Typography variant="subtitle1">{workflow.metrics.tested_pass_qty}</Typography>
                                            </Grid>
                                            <Grid item xs={6} md={3}>
                                                <Typography variant="body2" color="text.secondary">Failed</Typography>
                                                <Typography variant="subtitle1">{workflow.metrics.tested_fail_qty}</Typography>
                                            </Grid>
                                            <Grid item xs={6} md={3}>
                                                <Typography variant="body2" color="text.secondary">Fixed</Typography>
                                                <Typography variant="subtitle1">{workflow.metrics.debug_fixed_qty}</Typography>
                                            </Grid>
                                            <Grid item xs={6} md={3}>
                                                <Typography variant="body2" color="text.secondary">Graded</Typography>
                                                <Typography variant="subtitle1">{workflow.metrics.qc_total_graded_qty}</Typography>
                                            </Grid>
                                        </Grid>

                                        <SectionLabel eyebrow="Stage Logging" title="Workflow Actions" caption="Buttons appear only for roles that can act on the current workflow stage." />

                                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} sx={{ mt: 'auto' }}>
                                            {canLogTesting ? (
                                                <Button variant="outlined" startIcon={<Bug size={16} />} onClick={() => openStageDrawer(workflow, 'testing')}>
                                                    Log Testing
                                                </Button>
                                            ) : null}
                                            {canLogDebug ? (
                                                <Button variant="outlined" startIcon={<Wrench size={16} />} onClick={() => openStageDrawer(workflow, 'debug')}>
                                                    Log Debug
                                                </Button>
                                            ) : null}
                                            {canLogQc ? (
                                                <Button variant="contained" startIcon={<CheckCircle2 size={16} />} onClick={() => openStageDrawer(workflow, 'qc')}>
                                                    Log QC
                                                </Button>
                                            ) : null}
                                        </Stack>
                                    </CardContent>
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>
            )}

            <ActionDrawer
                open={openCreateDrawer}
                onClose={() => setOpenCreateDrawer(false)}
                title="Create Accessory Target"
                subtitle="Target quantity is the source of truth for the accessory quantity workflow."
            >
                <Stack spacing={2}>
                    <Select
                        fullWidth
                        displayEmpty
                        value={createTargetForm.project_id}
                        onChange={(event) => setCreateTargetForm((previous) => ({ ...previous, project_id: event.target.value }))}
                    >
                        <MenuItem value="">Select accessory project</MenuItem>
                        {accessoryProjects.map((project) => (
                            <MenuItem key={project._id} value={project._id}>
                                {project.name}
                            </MenuItem>
                        ))}
                    </Select>

                    <TextField
                        fullWidth
                        label="Accessory Name"
                        value={createTargetForm.accessory_name}
                        onChange={(event) => setCreateTargetForm((previous) => ({ ...previous, accessory_name: event.target.value }))}
                    />

                    <TextField
                        fullWidth
                        label="Target Quantity"
                        type="number"
                        value={createTargetForm.target_qty}
                        onChange={(event) => setCreateTargetForm((previous) => ({ ...previous, target_qty: event.target.value }))}
                        inputProps={{ min: 1 }}
                    />

                    <TextField
                        fullWidth
                        label="Notes"
                        multiline
                        rows={4}
                        value={createTargetForm.notes}
                        onChange={(event) => setCreateTargetForm((previous) => ({ ...previous, notes: event.target.value }))}
                    />

                    <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
                        <Button variant="outlined" onClick={() => setOpenCreateDrawer(false)}>
                            Cancel
                        </Button>
                        <Button variant="contained" onClick={() => void handleCreateTarget()} disabled={isLoading}>
                            Create Target
                        </Button>
                    </Stack>
                </Stack>
            </ActionDrawer>

            <ActionDrawer
                open={activeDrawer === 'testing'}
                onClose={() => setActiveDrawer(null)}
                title={selectedWorkflow ? `Testing Log • ${selectedWorkflow.accessory_name}` : 'Testing Log'}
                subtitle={selectedWorkflow ? `Available to test: ${selectedWorkflow.metrics.remaining_for_testing_qty}` : undefined}
            >
                <Stack spacing={2}>
                    <QuantityField label="Passed Quantity" value={testingForm.passed_qty} onChange={(value) => setTestingForm((previous) => ({ ...previous, passed_qty: value }))} />
                    <QuantityField label="Failed Quantity" value={testingForm.failed_qty} onChange={(value) => setTestingForm((previous) => ({ ...previous, failed_qty: value }))} />
                    <TextField
                        fullWidth
                        multiline
                        rows={4}
                        label="Notes"
                        value={testingForm.notes}
                        onChange={(event) => setTestingForm((previous) => ({ ...previous, notes: event.target.value }))}
                    />
                    <Button variant="contained" onClick={() => void handleSaveTesting()} disabled={isLoading}>
                        Save Testing Log
                    </Button>
                </Stack>
            </ActionDrawer>

            <ActionDrawer
                open={activeDrawer === 'debug'}
                onClose={() => setActiveDrawer(null)}
                title={selectedWorkflow ? `Debug Log • ${selectedWorkflow.accessory_name}` : 'Debug Log'}
                subtitle={selectedWorkflow ? `Failed backlog: ${selectedWorkflow.metrics.failed_backlog_qty}` : undefined}
            >
                <Stack spacing={2}>
                    <QuantityField label="Fixed Quantity" value={debugForm.fixed_qty} onChange={(value) => setDebugForm((previous) => ({ ...previous, fixed_qty: value }))} />
                    <QuantityField label="Scrapped Quantity" value={debugForm.scrapped_qty} onChange={(value) => setDebugForm((previous) => ({ ...previous, scrapped_qty: value }))} />
                    <TextField
                        fullWidth
                        multiline
                        rows={4}
                        label="Notes"
                        value={debugForm.notes}
                        onChange={(event) => setDebugForm((previous) => ({ ...previous, notes: event.target.value }))}
                    />
                    <Button variant="contained" onClick={() => void handleSaveDebug()} disabled={isLoading}>
                        Save Debug Log
                    </Button>
                </Stack>
            </ActionDrawer>

            <ActionDrawer
                open={activeDrawer === 'qc'}
                onClose={() => setActiveDrawer(null)}
                title={selectedWorkflow ? `QC Log • ${selectedWorkflow.accessory_name}` : 'QC Log'}
                subtitle={selectedWorkflow ? `QC backlog available: ${selectedWorkflow.metrics.qc_backlog_qty}` : undefined}
            >
                <Stack spacing={2}>
                    <Grid container spacing={1.5}>
                        <Grid item xs={12} sm={6}>
                            <QuantityField label="Grade A" value={qcForm.grade_a_qty} onChange={(value) => setQcForm((previous) => ({ ...previous, grade_a_qty: value }))} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <QuantityField label="Grade B" value={qcForm.grade_b_qty} onChange={(value) => setQcForm((previous) => ({ ...previous, grade_b_qty: value }))} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <QuantityField label="Grade C" value={qcForm.grade_c_qty} onChange={(value) => setQcForm((previous) => ({ ...previous, grade_c_qty: value }))} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <QuantityField label="Grade D" value={qcForm.grade_d_qty} onChange={(value) => setQcForm((previous) => ({ ...previous, grade_d_qty: value }))} />
                        </Grid>
                        <Grid item xs={12}>
                            <QuantityField label="Scrap Quantity" value={qcForm.scrap_qty} onChange={(value) => setQcForm((previous) => ({ ...previous, scrap_qty: value }))} />
                        </Grid>
                    </Grid>

                    <TextField
                        fullWidth
                        multiline
                        rows={4}
                        label="Notes"
                        value={qcForm.notes}
                        onChange={(event) => setQcForm((previous) => ({ ...previous, notes: event.target.value }))}
                    />
                    <Button variant="contained" onClick={() => void handleSaveQc()} disabled={isLoading}>
                        Save QC Log
                    </Button>
                </Stack>
            </ActionDrawer>
        </Box>
    );
};

export default AccessoryWorkflowPage;

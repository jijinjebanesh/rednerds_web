import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    MenuItem,
    Paper,
    Select,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import PageHeader from '@/components/PageHeader';
import PageFeedback from '@/components/PageFeedback';
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

const AccessoryWorkflowPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const role = useAppSelector((state) => state.auth.user?.role);
    const { notify } = useAppUI();

    const [accessoryProjects, setAccessoryProjects] = useState<Project[]>([]);
    const [workflows, setWorkflows] = useState<AccessoryWorkflow[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [projectFilter, setProjectFilter] = useState<string>(searchParams.get('project_id') ?? 'all');
    const [search, setSearch] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [openCreateDialog, setOpenCreateDialog] = useState(false);
    const [createTargetForm, setCreateTargetForm] = useState<CreateTargetForm>(initialCreateTargetForm);

    const [selectedWorkflow, setSelectedWorkflow] = useState<AccessoryWorkflow | null>(null);
    const [openTestingDialog, setOpenTestingDialog] = useState(false);
    const [openDebugDialog, setOpenDebugDialog] = useState(false);
    const [openQcDialog, setOpenQcDialog] = useState(false);
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
                (workflow.accessory_name || '').toLowerCase().includes(term) ||
                (workflow.project_name || '').toLowerCase().includes(term) ||
                (workflow.project_id || '').toLowerCase().includes(term)
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
            setOpenCreateDialog(false);
            setCreateTargetForm(initialCreateTargetForm);
            await loadWorkflows();
        } catch (err: any) {
            notify({ message: err?.response?.data?.message || err?.message || 'Failed to create accessory target', severity: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const openTesting = (workflow: AccessoryWorkflow) => {
        setSelectedWorkflow(workflow);
        setTestingForm(initialTestingForm);
        setOpenTestingDialog(true);
    };

    const openDebug = (workflow: AccessoryWorkflow) => {
        setSelectedWorkflow(workflow);
        setDebugForm(initialDebugForm);
        setOpenDebugDialog(true);
    };

    const openQc = (workflow: AccessoryWorkflow) => {
        setSelectedWorkflow(workflow);
        setQcForm(initialQcForm);
        setOpenQcDialog(true);
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
            setOpenTestingDialog(false);
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
            notify({ message: 'Debugging counts saved.', severity: 'success' });
            setOpenDebugDialog(false);
            await loadWorkflows();
        } catch (err: any) {
            notify({ message: err?.response?.data?.message || err?.message || 'Failed to save debugging counts', severity: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveQc = async () => {
        if (!selectedWorkflow) return;
        const gradeA = toInt(qcForm.grade_a_qty || '0');
        const gradeB = toInt(qcForm.grade_b_qty || '0');
        const gradeC = toInt(qcForm.grade_c_qty || '0');
        const gradeD = toInt(qcForm.grade_d_qty || '0');
        const scrap = toInt(qcForm.scrap_qty || '0');
        if ([gradeA, gradeB, gradeC, gradeD, scrap].some((value) => Number.isNaN(value)) || gradeA + gradeB + gradeC + gradeD + scrap <= 0) {
            notify({ message: 'Enter valid QC grade quantities.', severity: 'warning' });
            return;
        }

        try {
            setIsLoading(true);
            await accessoryWorkflowService.createQcLog(selectedWorkflow._id, {
                grade_a_qty: gradeA,
                grade_b_qty: gradeB,
                grade_c_qty: gradeC,
                grade_d_qty: gradeD,
                scrap_qty: scrap,
                notes: qcForm.notes.trim(),
            });
            notify({ message: 'QC grading counts saved.', severity: 'success' });
            setOpenQcDialog(false);
            await loadWorkflows();
        } catch (err: any) {
            notify({ message: err?.response?.data?.message || err?.message || 'Failed to save QC grading counts', severity: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Box>
            <PageHeader
                title="Accessory Workflows"
                subtitle="Manage quantity-based accessory targets and team updates across testing, debugging, and QC grading."
                countLabel={`${total} workflows`}
                onRefresh={loadWorkflows}
                isRefreshing={isLoading}
                primaryAction={
                    canCreateTarget
                        ? {
                              label: 'Create Accessory Target',
                              onClick: () => setOpenCreateDialog(true),
                          }
                        : undefined
                }
            />

            <PageFeedback isLoading={isLoading} error={error} />

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 1.5, mb: 2 }}>
                <TextField
                    fullWidth
                    placeholder="Search by accessory or project"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                />

                <Select
                    fullWidth
                    value={projectFilter}
                    onChange={(event) => {
                        setProjectFilter(event.target.value);
                        setPage(0);
                    }}
                >
                    <MenuItem value="all">All Accessory Projects</MenuItem>
                    {accessoryProjects.map((project) => (
                        <MenuItem key={project._id} value={project._id}>
                            {project.name}
                        </MenuItem>
                    ))}
                </Select>
            </Box>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>Project</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Accessory</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Target</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Testing (P/F)</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Debug (Fix/Scrap)</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>QC (A/B/C/D/Scrap)</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Backlogs</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredWorkflows.length === 0 && !isLoading && (
                            <TableRow>
                                <TableCell colSpan={8} sx={{ py: 3 }}>
                                    <Typography color="text.secondary">No accessory workflows found.</Typography>
                                </TableCell>
                            </TableRow>
                        )}

                        {filteredWorkflows.map((workflow) => (
                            <TableRow key={workflow._id} hover>
                                <TableCell>{workflow.project_name || workflow.project_id}</TableCell>
                                <TableCell>{workflow.accessory_name}</TableCell>
                                <TableCell>{workflow.metrics.target_qty}</TableCell>
                                <TableCell>
                                    {workflow.metrics.tested_pass_qty} / {workflow.metrics.tested_fail_qty}
                                </TableCell>
                                <TableCell>
                                    {workflow.metrics.debug_fixed_qty} / {workflow.metrics.debug_scrapped_qty}
                                </TableCell>
                                <TableCell>
                                    {workflow.metrics.qc_grade_a_qty}/{workflow.metrics.qc_grade_b_qty}/{workflow.metrics.qc_grade_c_qty}/{workflow.metrics.qc_grade_d_qty}/{workflow.metrics.qc_scrap_qty}
                                </TableCell>
                                <TableCell>
                                    <Typography variant="caption" sx={{ display: 'block' }}>
                                        To Test: {workflow.metrics.remaining_for_testing_qty}
                                    </Typography>
                                    <Typography variant="caption" sx={{ display: 'block' }}>
                                        Fail Backlog: {workflow.metrics.failed_backlog_qty}
                                    </Typography>
                                    <Typography variant="caption" sx={{ display: 'block' }}>
                                        QC Backlog: {workflow.metrics.qc_backlog_qty}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                        {canLogTesting && (
                                            <Button
                                                size="small"
                                                onClick={() => openTesting(workflow)}
                                                disabled={workflow.metrics.remaining_for_testing_qty <= 0}
                                            >
                                                Add Test
                                            </Button>
                                        )}
                                        {canLogDebug && (
                                            <Button
                                                size="small"
                                                onClick={() => openDebug(workflow)}
                                                disabled={workflow.metrics.failed_backlog_qty <= 0}
                                            >
                                                Add Debug
                                            </Button>
                                        )}
                                        {canLogQc && (
                                            <Button
                                                size="small"
                                                onClick={() => openQc(workflow)}
                                                disabled={workflow.metrics.qc_backlog_qty <= 0}
                                            >
                                                Add QC
                                            </Button>
                                        )}
                                    </Box>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                <TablePagination
                    component="div"
                    count={total}
                    page={page}
                    onPageChange={(_, nextPage) => setPage(nextPage)}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={(event) => {
                        setRowsPerPage(parseInt(event.target.value, 10));
                        setPage(0);
                    }}
                    rowsPerPageOptions={[10, 25, 50, 100]}
                />
            </TableContainer>

            <Dialog open={openCreateDialog} onClose={() => setOpenCreateDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Create Accessory Target</DialogTitle>
                <DialogContent>
                    <Select
                        fullWidth
                        displayEmpty
                        value={createTargetForm.project_id}
                        onChange={(event) => setCreateTargetForm((prev) => ({ ...prev, project_id: String(event.target.value) }))}
                        sx={{ mt: 1 }}
                    >
                        <MenuItem value="">Select Accessory Project</MenuItem>
                        {accessoryProjects.map((project) => (
                            <MenuItem key={project._id} value={project._id}>
                                {project.name}
                            </MenuItem>
                        ))}
                    </Select>

                    <TextField
                        fullWidth
                        margin="normal"
                        label="Accessory Name"
                        value={createTargetForm.accessory_name}
                        onChange={(event) => setCreateTargetForm((prev) => ({ ...prev, accessory_name: event.target.value }))}
                    />

                    <TextField
                        fullWidth
                        margin="normal"
                        label="Target Quantity"
                        type="number"
                        inputProps={{ min: 1, step: 1 }}
                        value={createTargetForm.target_qty}
                        onChange={(event) => setCreateTargetForm((prev) => ({ ...prev, target_qty: event.target.value }))}
                    />

                    <TextField
                        fullWidth
                        margin="normal"
                        label="Notes"
                        multiline
                        rows={3}
                        value={createTargetForm.notes}
                        onChange={(event) => setCreateTargetForm((prev) => ({ ...prev, notes: event.target.value }))}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenCreateDialog(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleCreateTarget} disabled={isLoading}>
                        Create
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={openTestingDialog} onClose={() => setOpenTestingDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Add Testing Counts</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {selectedWorkflow ? `${selectedWorkflow.accessory_name} • Remaining to test: ${selectedWorkflow.metrics.remaining_for_testing_qty}` : ''}
                    </Typography>
                    <TextField
                        fullWidth
                        margin="normal"
                        label="Passed Quantity"
                        type="number"
                        inputProps={{ min: 0, step: 1 }}
                        value={testingForm.passed_qty}
                        onChange={(event) => setTestingForm((prev) => ({ ...prev, passed_qty: event.target.value }))}
                    />
                    <TextField
                        fullWidth
                        margin="normal"
                        label="Failed Quantity"
                        type="number"
                        inputProps={{ min: 0, step: 1 }}
                        value={testingForm.failed_qty}
                        onChange={(event) => setTestingForm((prev) => ({ ...prev, failed_qty: event.target.value }))}
                    />
                    <TextField
                        fullWidth
                        margin="normal"
                        label="Notes"
                        multiline
                        rows={3}
                        value={testingForm.notes}
                        onChange={(event) => setTestingForm((prev) => ({ ...prev, notes: event.target.value }))}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenTestingDialog(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSaveTesting} disabled={isLoading}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={openDebugDialog} onClose={() => setOpenDebugDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Add Debugging Counts</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {selectedWorkflow ? `${selectedWorkflow.accessory_name} • Failed backlog: ${selectedWorkflow.metrics.failed_backlog_qty}` : ''}
                    </Typography>
                    <TextField
                        fullWidth
                        margin="normal"
                        label="Fixed Quantity"
                        type="number"
                        inputProps={{ min: 0, step: 1 }}
                        value={debugForm.fixed_qty}
                        onChange={(event) => setDebugForm((prev) => ({ ...prev, fixed_qty: event.target.value }))}
                    />
                    <TextField
                        fullWidth
                        margin="normal"
                        label="Scrapped Quantity"
                        type="number"
                        inputProps={{ min: 0, step: 1 }}
                        value={debugForm.scrapped_qty}
                        onChange={(event) => setDebugForm((prev) => ({ ...prev, scrapped_qty: event.target.value }))}
                    />
                    <TextField
                        fullWidth
                        margin="normal"
                        label="Notes"
                        multiline
                        rows={3}
                        value={debugForm.notes}
                        onChange={(event) => setDebugForm((prev) => ({ ...prev, notes: event.target.value }))}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenDebugDialog(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSaveDebug} disabled={isLoading}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={openQcDialog} onClose={() => setOpenQcDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Add QC Grading Counts</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {selectedWorkflow ? `${selectedWorkflow.accessory_name} • QC backlog: ${selectedWorkflow.metrics.qc_backlog_qty}` : ''}
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mt: 1 }}>
                        <TextField
                            label="Grade A"
                            type="number"
                            inputProps={{ min: 0, step: 1 }}
                            value={qcForm.grade_a_qty}
                            onChange={(event) => setQcForm((prev) => ({ ...prev, grade_a_qty: event.target.value }))}
                        />
                        <TextField
                            label="Grade B"
                            type="number"
                            inputProps={{ min: 0, step: 1 }}
                            value={qcForm.grade_b_qty}
                            onChange={(event) => setQcForm((prev) => ({ ...prev, grade_b_qty: event.target.value }))}
                        />
                        <TextField
                            label="Grade C"
                            type="number"
                            inputProps={{ min: 0, step: 1 }}
                            value={qcForm.grade_c_qty}
                            onChange={(event) => setQcForm((prev) => ({ ...prev, grade_c_qty: event.target.value }))}
                        />
                        <TextField
                            label="Grade D"
                            type="number"
                            inputProps={{ min: 0, step: 1 }}
                            value={qcForm.grade_d_qty}
                            onChange={(event) => setQcForm((prev) => ({ ...prev, grade_d_qty: event.target.value }))}
                        />
                        <TextField
                            label="Scrap"
                            type="number"
                            inputProps={{ min: 0, step: 1 }}
                            value={qcForm.scrap_qty}
                            onChange={(event) => setQcForm((prev) => ({ ...prev, scrap_qty: event.target.value }))}
                        />
                    </Box>
                    <TextField
                        fullWidth
                        margin="normal"
                        label="Notes"
                        multiline
                        rows={3}
                        value={qcForm.notes}
                        onChange={(event) => setQcForm((prev) => ({ ...prev, notes: event.target.value }))}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenQcDialog(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSaveQc} disabled={isLoading}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default AccessoryWorkflowPage;

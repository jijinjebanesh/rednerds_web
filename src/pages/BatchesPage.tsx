import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    LinearProgress,
    MenuItem,
    Select,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    Paper,
    TextField,
    Typography,
} from '@mui/material';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { setBatches, setError, setLoading, clearError } from '@/store/batchSlice';
import { batchService, projectService } from '@/services';
import { Batch, CreateBatchForm, Project } from '@/types';
import PageHeader from '@/components/PageHeader';
import PageFeedback from '@/components/PageFeedback';
import { useAppUI } from '@/context/AppUIContext';
import { hasPermission } from '@/utils/rbac';
import { BATCH_STATUS_OPTIONS, toDateInputValue, toTitle } from '@/utils/workflowOptions';

const getProgress = (produced: number, planned: number) => {
    if (planned <= 0) return 0;
    return Math.min(100, Math.round((produced / planned) * 100));
};

interface CreateBatchFormState extends Omit<CreateBatchForm, 'planned_qty'> {
    planned_qty: number | '';
}

const defaultCreateForm: CreateBatchFormState = {
    _id: '',
    batch_name: '',
    project_id: '',
    model_variant: '',
    planned_qty: 1,
    start_date: toDateInputValue(new Date()),
    notes: '',
};

const BatchesPage = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { notify, confirm } = useAppUI();
    const { batches, isLoading, error, total } = useAppSelector((state) => state.batches);
    const role = useAppSelector((state) => state.auth.user?.role);

    const [projects, setProjects] = useState<Project[]>([]);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [projectFilter, setProjectFilter] = useState<string>('all');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);

    const [openCreateDialog, setOpenCreateDialog] = useState(false);
    const [createForm, setCreateForm] = useState<CreateBatchFormState>(defaultCreateForm);

    const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
    const [editProducedQty, setEditProducedQty] = useState<number>(0);
    const [editStatus, setEditStatus] = useState<Batch['status']>('planned');
    const [editNotes, setEditNotes] = useState('');

    const canCreateBatch = hasPermission(role, 'batches.create');
    const canUpdateBatch = hasPermission(role, 'batches.update');

    useEffect(() => {
        loadProjects();
    }, []);

    useEffect(() => {
        loadBatches();
    }, [page, rowsPerPage, statusFilter, projectFilter]);

    const filteredBatches = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return batches;

        return batches.filter((batch) => {
            return (
                batch._id.toLowerCase().includes(term) ||
                batch.batch_name.toLowerCase().includes(term) ||
                batch.project_id.toLowerCase().includes(term) ||
                batch.model_variant.toLowerCase().includes(term) ||
                batch.status.toLowerCase().includes(term)
            );
        });
    }, [batches, search]);

    const deviceProjects = useMemo(() => {
        return projects.filter((project) => (project.project_type || 'device') === 'device');
    }, [projects]);

    const loadProjects = async () => {
        try {
            const response = await projectService.getProjects(1, 200);
            setProjects(response.data);
        } catch {
            setProjects([]);
        }
    };

    const loadBatches = async () => {
        try {
            dispatch(setLoading(true));
            const response = await batchService.getBatches(page + 1, rowsPerPage, {
                status: statusFilter === 'all' ? undefined : statusFilter,
                project_id: projectFilter === 'all' ? undefined : projectFilter,
            });
            dispatch(setBatches(response));
            dispatch(clearError());
        } catch (err: any) {
            const errorMessage = err?.response?.data?.message || err?.message || 'Failed to load batches';
            dispatch(setError(errorMessage));
        } finally {
            dispatch(setLoading(false));
        }
    };

    const resetCreateForm = () => {
        setCreateForm({
            ...defaultCreateForm,
            start_date: toDateInputValue(new Date()),
        });
    };

    const handleCreateBatch = async () => {
        if (!createForm.batch_name || !createForm.project_id || !createForm.model_variant || !createForm.start_date) {
            notify({ message: 'Please fill batch name, project, variant, and start date.', severity: 'warning' });
            return;
        }

        const selectedProject = projects.find((project) => project._id === createForm.project_id);
        if (!selectedProject || (selectedProject.project_type || 'device') !== 'device') {
            notify({ message: 'Batches can be created only for device projects. Use Accessory Workflow for accessory targets.', severity: 'warning' });
            return;
        }

        const plannedQty = Number(createForm.planned_qty);
        if (!Number.isFinite(plannedQty) || plannedQty < 1) {
            notify({ message: 'Planned quantity must be at least 1.', severity: 'warning' });
            return;
        }

        try {
            dispatch(setLoading(true));
            await batchService.createBatch({
                ...createForm,
                batch_name: createForm.batch_name.trim(),
                planned_qty: Math.max(1, plannedQty),
                start_date: new Date(createForm.start_date),
                notes: createForm.notes?.trim() || undefined,
            });

            setOpenCreateDialog(false);
            resetCreateForm();
            notify({ message: 'Batch created successfully.', severity: 'success' });
            await loadBatches();
        } catch (err: any) {
            const message = err?.response?.data?.message || err?.message || 'Failed to create batch';
            notify({ message, severity: 'error' });
        } finally {
            dispatch(setLoading(false));
        }
    };

    const handleCreateProjectChange = async (projectId: string) => {
        setCreateForm((prev) => ({
            ...prev,
            project_id: projectId,
        }));
    };

    const openEditDialog = (batch: Batch) => {
        setEditingBatch(batch);
        setEditProducedQty(batch.produced_qty);
        setEditStatus(batch.status);
        setEditNotes(batch.notes ?? '');
    };

    const handleUpdateBatch = async () => {
        if (!editingBatch) return;

        try {
            dispatch(setLoading(true));
            await batchService.updateBatch(editingBatch._id, {
                produced_qty: Math.max(0, Number(editProducedQty)),
                status: editStatus,
                notes: editNotes,
            });
            notify({ message: 'Batch updated successfully.', severity: 'success' });
            setEditingBatch(null);
            await loadBatches();
        } catch (err: any) {
            notify({ message: err?.response?.data?.message || err?.message || 'Failed to update batch', severity: 'error' });
        } finally {
            dispatch(setLoading(false));
        }
    };

    const handleCancelBatch = async (batch: Batch) => {
        const approved = await confirm({
            title: 'Cancel Batch',
            message: `Mark batch ${batch._id} as cancelled?`,
            confirmText: 'Cancel Batch',
            tone: 'error',
        });

        if (!approved) return;

        try {
            dispatch(setLoading(true));
            await batchService.deleteBatch(batch._id);
            notify({ message: 'Batch cancelled.', severity: 'success' });
            await loadBatches();
        } catch (err: any) {
            notify({ message: err?.response?.data?.message || err?.message || 'Failed to cancel batch', severity: 'error' });
        } finally {
            dispatch(setLoading(false));
        }
    };

    return (
        <Box>
            <PageHeader
                title="Batches"
                subtitle="Track production targets, output progress, and execution status by batch."
                countLabel={`${filteredBatches.length} shown`}
                onRefresh={loadBatches}
                isRefreshing={isLoading}
                primaryAction={
                    canCreateBatch
                        ? {
                              label: 'New Batch',
                              onClick: () => setOpenCreateDialog(true),
                          }
                        : undefined
                }
            />

            <PageFeedback isLoading={isLoading} error={error || null} />

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr 1fr' }, gap: 1.5, mb: 2 }}>
                <TextField
                    fullWidth
                    placeholder="Search by batch ID, batch name, project ID, variant, or status"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                />

                <Select fullWidth value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <MenuItem value="all">All Statuses</MenuItem>
                    {BATCH_STATUS_OPTIONS.map((status) => (
                        <MenuItem key={status} value={status}>
                            {toTitle(status)}
                        </MenuItem>
                    ))}
                </Select>

                <Select fullWidth value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
                    <MenuItem value="all">All Projects</MenuItem>
                    {projects.map((project) => (
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
                            <TableCell sx={{ fontWeight: 'bold' }}>Batch ID</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Batch Name</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Project</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Variant</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Planned Qty</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Produced Qty</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Progress</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredBatches.length === 0 && !isLoading && (
                            <TableRow>
                                <TableCell colSpan={9} sx={{ py: 3 }}>
                                    <Typography color="text.secondary">No batches found.</Typography>
                                </TableCell>
                            </TableRow>
                        )}

                        {filteredBatches.map((batch: Batch) => {
                            const progress = getProgress(batch.produced_qty, batch.planned_qty);
                            return (
                                <TableRow key={batch._id} hover onClick={() => navigate(`/manufacturing/batches/${batch._id}`)} sx={{ cursor: 'pointer' }}>
                                    <TableCell>{batch._id}</TableCell>
                                    <TableCell>{batch.batch_name || '-'}</TableCell>
                                    <TableCell>{batch.project_id}</TableCell>
                                    <TableCell>{batch.model_variant}</TableCell>
                                    <TableCell>{toTitle(batch.status)}</TableCell>
                                    <TableCell>{batch.planned_qty}</TableCell>
                                    <TableCell>{batch.produced_qty}</TableCell>
                                    <TableCell sx={{ minWidth: 180 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <LinearProgress variant="determinate" value={progress} sx={{ flex: 1, height: 8, borderRadius: 8 }} />
                                            <Typography variant="caption" sx={{ fontWeight: 700 }}>
                                                {progress}%
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell sx={{ minWidth: 170 }} onClick={(event) => event.stopPropagation()}>
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            <Button size="small" onClick={() => openEditDialog(batch)} disabled={!canUpdateBatch}>
                                                Edit
                                            </Button>
                                            <Button
                                                size="small"
                                                color="error"
                                                onClick={() => handleCancelBatch(batch)}
                                                disabled={!canUpdateBatch || batch.status === 'cancelled'}
                                            >
                                                Cancel
                                            </Button>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
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
                <DialogTitle>Create Batch</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        margin="normal"
                        label="Batch Name"
                        value={createForm.batch_name}
                        onChange={(event) => setCreateForm((prev) => ({ ...prev, batch_name: event.target.value }))}
                        placeholder="Mainline April Run"
                    />

                    <Select
                        fullWidth
                        value={createForm.project_id}
                        onChange={(event) => {
                            void handleCreateProjectChange(event.target.value);
                        }}
                        sx={{ mt: 2 }}
                        displayEmpty
                    >
                        <MenuItem value="">Select Project</MenuItem>
                        {deviceProjects.map((project) => (
                            <MenuItem key={project._id} value={project._id}>
                                {project.name} ({project.slug})
                            </MenuItem>
                        ))}
                    </Select>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                        Only device projects are shown here. Accessory projects use Accessory Workflow target quantities.
                    </Typography>

                    <TextField
                        fullWidth
                        margin="normal"
                        label="Model Variant"
                        value={createForm.model_variant}
                        onChange={(event) => setCreateForm((prev) => ({ ...prev, model_variant: event.target.value }))}
                    />

                    <TextField
                        fullWidth
                        margin="normal"
                        label="Planned Quantity"
                        type="number"
                        inputProps={{ min: 1 }}
                        value={createForm.planned_qty}
                        onChange={(event) => {
                            const raw = event.target.value;
                            setCreateForm((prev) => ({
                                ...prev,
                                planned_qty: raw === '' ? '' : Number(raw),
                            }));
                        }}
                    />

                    <TextField
                        fullWidth
                        margin="normal"
                        label="Start Date"
                        type="date"
                        value={toDateInputValue(createForm.start_date)}
                        onChange={(event) => setCreateForm((prev) => ({ ...prev, start_date: event.target.value }))}
                        InputLabelProps={{ shrink: true }}
                    />

                    <TextField
                        fullWidth
                        margin="normal"
                        label="Notes"
                        multiline
                        rows={3}
                        value={createForm.notes ?? ''}
                        onChange={(event) => setCreateForm((prev) => ({ ...prev, notes: event.target.value }))}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenCreateDialog(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleCreateBatch} disabled={isLoading}>
                        Create Batch
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(editingBatch)} onClose={() => setEditingBatch(null)} maxWidth="sm" fullWidth>
                <DialogTitle>Update Batch</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        margin="normal"
                        label="Produced Quantity"
                        type="number"
                        inputProps={{ min: 0 }}
                        value={editProducedQty}
                        onChange={(event) => setEditProducedQty(Number(event.target.value) || 0)}
                    />

                    <Select fullWidth value={editStatus} onChange={(event) => setEditStatus(event.target.value as Batch['status'])} sx={{ mt: 2 }}>
                        {BATCH_STATUS_OPTIONS.map((status) => (
                            <MenuItem key={status} value={status}>
                                {toTitle(status)}
                            </MenuItem>
                        ))}
                    </Select>

                    <TextField
                        fullWidth
                        margin="normal"
                        label="Notes"
                        multiline
                        rows={3}
                        value={editNotes}
                        onChange={(event) => setEditNotes(event.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditingBatch(null)}>Cancel</Button>
                    <Button variant="contained" onClick={handleUpdateBatch} disabled={isLoading}>
                        Save Changes
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default BatchesPage;


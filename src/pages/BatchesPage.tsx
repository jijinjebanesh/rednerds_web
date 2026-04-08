import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Button,
    Collapse,
    LinearProgress,
    MenuItem,
    Paper,
    Select,
    Stack,
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
import { Boxes, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { setBatches, setError, setLoading, clearError } from '@/store/batchSlice';
import { batchService, projectService } from '@/services';
import { Batch, CreateBatchForm, Project } from '@/types';
import PageHeader from '@/components/PageHeader';
import PageFeedback from '@/components/PageFeedback';
import ActionDrawer from '@/components/ui/ActionDrawer';
import EmptyState from '@/components/ui/EmptyState';
import StatusChip from '@/components/ui/StatusChip';
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
    const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);

    const [openCreateDrawer, setOpenCreateDrawer] = useState(false);
    const [createForm, setCreateForm] = useState<CreateBatchFormState>(defaultCreateForm);
    const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
    const [editProducedQty, setEditProducedQty] = useState<number>(0);
    const [editStatus, setEditStatus] = useState<Batch['status']>('planned');
    const [editNotes, setEditNotes] = useState('');

    const canCreateBatch = hasPermission(role, 'batches.create');
    const canUpdateBatch = hasPermission(role, 'batches.update');

    useEffect(() => {
        void loadProjects();
    }, []);

    useEffect(() => {
        void loadBatches();
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
            dispatch(setError(err?.response?.data?.message || err?.message || 'Failed to load batches'));
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
                planned_qty: plannedQty,
                start_date: new Date(createForm.start_date),
                notes: createForm.notes?.trim() || undefined,
            });

            setOpenCreateDrawer(false);
            resetCreateForm();
            notify({ message: 'Batch created successfully.', severity: 'success' });
            await loadBatches();
        } catch (err: any) {
            notify({ message: err?.response?.data?.message || err?.message || 'Failed to create batch', severity: 'error' });
        } finally {
            dispatch(setLoading(false));
        }
    };

    const openEditDrawer = (batch: Batch) => {
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
            message: `Mark batch ${batch._id} as cancelled? Production progress will remain visible for history.`,
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
                subtitle="Track planned versus produced quantity, update execution status, and inspect batch metadata without leaving the list."
                countLabel={`${filteredBatches.length} shown`}
                onRefresh={loadBatches}
                isRefreshing={isLoading}
                primaryAction={canCreateBatch ? { label: 'Create Batch', onClick: () => setOpenCreateDrawer(true) } : undefined}
            />

            <PageFeedback isLoading={isLoading} error={error || null} />

            <Stack direction={{ xs: 'column', xl: 'row' }} spacing={1.5} sx={{ mb: 3 }}>
                <TextField
                    fullWidth
                    placeholder="Search by batch ID, name, project, or variant"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                />

                <Select fullWidth value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <MenuItem value="all">All statuses</MenuItem>
                    {BATCH_STATUS_OPTIONS.map((status) => (
                        <MenuItem key={status} value={status}>
                            {toTitle(status)}
                        </MenuItem>
                    ))}
                </Select>

                <Select fullWidth value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
                    <MenuItem value="all">All projects</MenuItem>
                    {projects.map((project) => (
                        <MenuItem key={project._id} value={project._id}>
                            {project.name}
                        </MenuItem>
                    ))}
                </Select>
            </Stack>

            {filteredBatches.length === 0 && !isLoading ? (
                <EmptyState
                    icon={<Boxes size={24} />}
                    title="No batches found"
                    description="Create a device batch to begin planned-versus-produced tracking. Accessory projects intentionally use the accessory workflow instead."
                    action={canCreateBatch ? { label: 'Create batch', onClick: () => setOpenCreateDrawer(true) } : undefined}
                />
            ) : (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell />
                                <TableCell>Batch</TableCell>
                                <TableCell>Project</TableCell>
                                <TableCell>Variant</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Planned</TableCell>
                                <TableCell>Produced</TableCell>
                                <TableCell>Progress</TableCell>
                                <TableCell align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredBatches.map((batch) => {
                                const progress = getProgress(batch.produced_qty, batch.planned_qty);
                                const expanded = expandedBatchId === batch._id;

                                return (
                                    <>
                                        <TableRow key={batch._id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/manufacturing/batches/${batch._id}`)}>
                                            <TableCell onClick={(event) => event.stopPropagation()} sx={{ width: 48 }}>
                                                <Button
                                                    size="small"
                                                    variant="text"
                                                    onClick={() => setExpandedBatchId(expanded ? null : batch._id)}
                                                >
                                                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                </Button>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="subtitle2">{batch._id}</Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {batch.batch_name || '-'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>{batch.project_id}</TableCell>
                                            <TableCell>{batch.model_variant}</TableCell>
                                            <TableCell>
                                                <StatusChip value={batch.status} />
                                            </TableCell>
                                            <TableCell>{batch.planned_qty}</TableCell>
                                            <TableCell>{batch.produced_qty}</TableCell>
                                            <TableCell sx={{ minWidth: 220 }}>
                                                <Stack spacing={0.75}>
                                                    <LinearProgress
                                                        variant="determinate"
                                                        value={progress}
                                                        sx={{
                                                            height: 8,
                                                            borderRadius: 999,
                                                            backgroundColor: 'rgba(255,255,255,0.06)',
                                                            '& .MuiLinearProgress-bar': {
                                                                borderRadius: 999,
                                                            },
                                                        }}
                                                    />
                                                    <Typography variant="caption" color="text.secondary">
                                                        {progress}% of planned quantity complete
                                                    </Typography>
                                                </Stack>
                                            </TableCell>
                                            <TableCell align="right" onClick={(event) => event.stopPropagation()}>
                                                <Stack direction="row" spacing={1} justifyContent="flex-end">
                                                    <Button size="small" variant="outlined" onClick={() => openEditDrawer(batch)} disabled={!canUpdateBatch}>
                                                        Edit
                                                    </Button>
                                                    <Button
                                                        size="small"
                                                        color="error"
                                                        variant="text"
                                                        onClick={() => void handleCancelBatch(batch)}
                                                        disabled={!canUpdateBatch || batch.status === 'cancelled'}
                                                    >
                                                        Cancel
                                                    </Button>
                                                </Stack>
                                            </TableCell>
                                        </TableRow>

                                        <TableRow>
                                            <TableCell colSpan={9} sx={{ p: 0, borderBottom: expanded ? undefined : 0 }}>
                                                <Collapse in={expanded} timeout="auto" unmountOnExit>
                                                    <Box sx={{ p: 2.5, backgroundColor: 'rgba(255,255,255,0.02)' }}>
                                                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                                                            <Box sx={{ flex: 1 }}>
                                                                <Typography variant="overline">Schedule</Typography>
                                                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                                    Start: {new Date(batch.start_date).toLocaleDateString()}
                                                                </Typography>
                                                                <Typography variant="body2" color="text.secondary">
                                                                    End: {batch.end_date ? new Date(batch.end_date).toLocaleDateString() : 'Open'}
                                                                </Typography>
                                                            </Box>
                                                            <Box sx={{ flex: 1 }}>
                                                                <Typography variant="overline">Metadata</Typography>
                                                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                                    Project slug: {batch.project_slug || '-'}
                                                                </Typography>
                                                                <Typography variant="body2" color="text.secondary">
                                                                    Notes: {batch.notes || 'No notes added'}
                                                                </Typography>
                                                            </Box>
                                                        </Stack>
                                                    </Box>
                                                </Collapse>
                                            </TableCell>
                                        </TableRow>
                                    </>
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
            )}

            <ActionDrawer
                open={openCreateDrawer}
                onClose={() => setOpenCreateDrawer(false)}
                title="Create Batch"
                subtitle="Batch creation is available only for device projects. Accessory projects use quantity workflows."
            >
                <Stack spacing={2}>
                    <TextField
                        fullWidth
                        label="Batch Name"
                        value={createForm.batch_name}
                        onChange={(event) => setCreateForm((previous) => ({ ...previous, batch_name: event.target.value }))}
                        placeholder="Mainline April Run"
                    />

                    <Select
                        fullWidth
                        value={createForm.project_id}
                        onChange={(event) => setCreateForm((previous) => ({ ...previous, project_id: event.target.value }))}
                        displayEmpty
                    >
                        <MenuItem value="">Select project</MenuItem>
                        {deviceProjects.map((project) => (
                            <MenuItem key={project._id} value={project._id}>
                                {project.name} ({project.slug})
                            </MenuItem>
                        ))}
                    </Select>

                    <Typography variant="caption" color="text.secondary">
                        Only device projects are shown here. Accessory targets belong in the Accessory Workflows page.
                    </Typography>

                    <TextField
                        fullWidth
                        label="Model Variant"
                        value={createForm.model_variant}
                        onChange={(event) => setCreateForm((previous) => ({ ...previous, model_variant: event.target.value }))}
                    />

                    <TextField
                        fullWidth
                        label="Planned Quantity"
                        type="number"
                        inputProps={{ min: 1 }}
                        value={createForm.planned_qty}
                        onChange={(event) => {
                            const raw = event.target.value;
                            setCreateForm((previous) => ({
                                ...previous,
                                planned_qty: raw === '' ? '' : Number(raw),
                            }));
                        }}
                    />

                    <TextField
                        fullWidth
                        label="Start Date"
                        type="date"
                        value={toDateInputValue(createForm.start_date)}
                        onChange={(event) => setCreateForm((previous) => ({ ...previous, start_date: event.target.value }))}
                        InputLabelProps={{ shrink: true }}
                    />

                    <TextField
                        fullWidth
                        label="Notes"
                        multiline
                        rows={4}
                        value={createForm.notes ?? ''}
                        onChange={(event) => setCreateForm((previous) => ({ ...previous, notes: event.target.value }))}
                    />

                    <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
                        <Button variant="outlined" onClick={() => setOpenCreateDrawer(false)}>
                            Cancel
                        </Button>
                        <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => void handleCreateBatch()} disabled={isLoading}>
                            Create Batch
                        </Button>
                    </Stack>
                </Stack>
            </ActionDrawer>

            <ActionDrawer
                open={Boolean(editingBatch)}
                onClose={() => setEditingBatch(null)}
                title={editingBatch ? `Update ${editingBatch._id}` : 'Update Batch'}
                subtitle="Adjust produced quantity, status, and execution notes without leaving the table."
            >
                <Stack spacing={2}>
                    <TextField
                        fullWidth
                        label="Produced Quantity"
                        type="number"
                        inputProps={{ min: 0 }}
                        value={editProducedQty}
                        onChange={(event) => setEditProducedQty(Number(event.target.value) || 0)}
                    />

                    <Select fullWidth value={editStatus} onChange={(event) => setEditStatus(event.target.value as Batch['status'])}>
                        {BATCH_STATUS_OPTIONS.map((status) => (
                            <MenuItem key={status} value={status}>
                                {toTitle(status)}
                            </MenuItem>
                        ))}
                    </Select>

                    <TextField
                        fullWidth
                        label="Notes"
                        multiline
                        rows={4}
                        value={editNotes}
                        onChange={(event) => setEditNotes(event.target.value)}
                    />

                    <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
                        <Button variant="outlined" onClick={() => setEditingBatch(null)}>
                            Cancel
                        </Button>
                        <Button variant="contained" onClick={() => void handleUpdateBatch()} disabled={isLoading}>
                            Save Changes
                        </Button>
                    </Stack>
                </Stack>
            </ActionDrawer>
        </Box>
    );
};

export default BatchesPage;

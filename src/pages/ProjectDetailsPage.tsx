import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Box,
    Button,
    Card,
    CardContent,
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
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material';
import { accessoryWorkflowService, batchService, productService, projectService } from '@/services';
import { Batch, Project } from '@/types';
import PageHeader from '@/components/PageHeader';
import PageFeedback from '@/components/PageFeedback';
import { PROJECT_STATUS_OPTIONS, toTitle } from '@/utils/workflowOptions';
import { useAppUI } from '@/context/AppUIContext';
import { hasPermission } from '@/utils/rbac';
import { useAppSelector } from '@/hooks/redux';

interface EditState {
    name: string;
    slug: string;
    description: string;
    status: Project['status'];
    project_type: Project['project_type'];
}

const ProjectDetailsPage = () => {
    const navigate = useNavigate();
    const { projectId } = useParams<{ projectId: string }>();
    const { notify } = useAppUI();
    const role = useAppSelector((state) => state.auth.user?.role);

    const [project, setProject] = useState<Project | null>(null);
    const [batches, setBatches] = useState<Batch[]>([]);
    const [batchesTotal, setBatchesTotal] = useState(0);
    const [productCount, setProductCount] = useState(0);
    const [unitsProduced, setUnitsProduced] = useState(0);
    const [accessoryWorkflowCount, setAccessoryWorkflowCount] = useState(0);
    const [accessoryTargetTotal, setAccessoryTargetTotal] = useState(0);
    const [accessoryTestedTotal, setAccessoryTestedTotal] = useState(0);
    const [accessoryQcTotal, setAccessoryQcTotal] = useState(0);

    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(20);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [editOpen, setEditOpen] = useState(false);
    const [editState, setEditState] = useState<EditState>({
        name: '',
        slug: '',
        description: '',
        status: 'active',
        project_type: 'device',
    });

    const canEditProject = hasPermission(role, 'projects.update');

    useEffect(() => {
        if (projectId) {
            loadProjectDetails();
        }
    }, [projectId, page, rowsPerPage]);

    const loadProjectDetails = async () => {
        if (!projectId) return;

        try {
            setIsLoading(true);
            setError(null);

            const projectData = await projectService.getProjectById(projectId);

            setProject(projectData);

            if ((projectData.project_type || 'device') === 'accessory') {
                const workflowsRes = await accessoryWorkflowService.getWorkflows(1, 500, { project_id: projectId });
                setBatches([]);
                setBatchesTotal(0);
                setProductCount(0);
                setUnitsProduced(0);
                setAccessoryWorkflowCount(workflowsRes.total);

                const aggregate = workflowsRes.data.reduce(
                    (acc, workflow) => {
                        acc.target += workflow.metrics.target_qty;
                        acc.tested += workflow.metrics.tested_total_qty;
                        acc.qc += workflow.metrics.qc_total_graded_qty;
                        return acc;
                    },
                    { target: 0, tested: 0, qc: 0 }
                );
                setAccessoryTargetTotal(aggregate.target);
                setAccessoryTestedTotal(aggregate.tested);
                setAccessoryQcTotal(aggregate.qc);
            } else {
                const [batchesRes, productsRes, allBatchesRes] = await Promise.all([
                    batchService.getBatchesByProject(projectId, page + 1, rowsPerPage),
                    productService.getProductsByProject(projectId, 1, 1),
                    batchService.getBatchesByProject(projectId, 1, 500),
                ]);

                setBatches(batchesRes.data);
                setBatchesTotal(batchesRes.total);
                setProductCount(productsRes.total);
                setUnitsProduced(allBatchesRes.data.reduce((sum, batch) => sum + (batch.produced_qty || 0), 0));
                setAccessoryWorkflowCount(0);
                setAccessoryTargetTotal(0);
                setAccessoryTestedTotal(0);
                setAccessoryQcTotal(0);
            }

            setEditState({
                name: projectData.name,
                slug: projectData.slug,
                description: projectData.description ?? '',
                status: projectData.status,
                project_type: projectData.project_type || 'device',
            });
        } catch (err: any) {
            setError(err?.response?.data?.message || err?.message || 'Failed to load project');
            setProject(null);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStatusUpdate = async (status: Project['status']) => {
        if (!project || !canEditProject) return;

        try {
            await projectService.updateProject(project._id, { status });
            setProject((prev) => (prev ? { ...prev, status } : prev));
            notify({ message: 'Project status updated.', severity: 'success' });
        } catch (err: any) {
            notify({ message: err?.response?.data?.message || err?.message || 'Failed to update status', severity: 'error' });
        }
    };

    const handleSaveEdit = async () => {
        if (!project) return;

        try {
            await projectService.updateProject(project._id, {
                name: editState.name,
                slug: editState.slug,
                description: editState.description,
                status: editState.status,
                project_type: editState.project_type,
            });

            notify({ message: 'Project updated successfully.', severity: 'success' });
            setEditOpen(false);
            await loadProjectDetails();
        } catch (err: any) {
            notify({ message: err?.response?.data?.message || err?.message || 'Failed to update project', severity: 'error' });
        }
    };

    const summaryCards = useMemo(
        () =>
            (project?.project_type || 'device') === 'accessory'
                ? [
                      { label: 'Accessory Targets', value: accessoryWorkflowCount },
                      { label: 'Target Qty', value: accessoryTargetTotal },
                      { label: 'Tested Qty', value: accessoryTestedTotal },
                      { label: 'QC Graded Qty', value: accessoryQcTotal },
                  ]
                : [
                      { label: 'Batches', value: batchesTotal },
                      { label: 'Products', value: productCount },
                      { label: 'Units Produced', value: unitsProduced },
                  ],
        [project?.project_type, batchesTotal, productCount, unitsProduced, accessoryWorkflowCount, accessoryTargetTotal, accessoryTestedTotal, accessoryQcTotal]
    );

    return (
        <Box>
            <PageHeader
                title={project?.name ?? 'Project Details'}
                subtitle={project ? `Slug: ${project.slug}` : 'View project profile and linked metrics.'}
                onRefresh={loadProjectDetails}
                isRefreshing={isLoading}
                primaryAction={
                    canEditProject
                        ? {
                              label: 'Edit Project',
                              onClick: () => setEditOpen(true),
                          }
                        : undefined
                }
            />

            <PageFeedback isLoading={isLoading} error={error} />

            {!isLoading && !project && !error && <Typography>Project not found</Typography>}

            {project && (
                <>
                    <Card sx={{ mb: 3 }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                                <Typography variant="h6">Project Information</Typography>

                                <Select
                                    size="small"
                                    value={project.status}
                                    onChange={(event) => handleStatusUpdate(event.target.value as Project['status'])}
                                    disabled={!canEditProject}
                                >
                                    {PROJECT_STATUS_OPTIONS.map((status) => (
                                        <MenuItem key={status} value={status}>
                                            {toTitle(status)}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </Box>

                            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mt: 2 }}>
                                <Box>
                                    <Typography color="textSecondary">Project ID</Typography>
                                    <Typography sx={{ fontWeight: 'bold' }}>{project._id}</Typography>
                                </Box>
                                <Box>
                                    <Typography color="textSecondary">Slug</Typography>
                                    <Typography sx={{ fontWeight: 'bold' }}>{project.slug}</Typography>
                                </Box>
                                <Box>
                                    <Typography color="textSecondary">Type</Typography>
                                    <Typography sx={{ fontWeight: 'bold' }}>{toTitle(project.project_type || 'device')}</Typography>
                                </Box>
                                <Box sx={{ gridColumn: { xs: '1 / -1', sm: '1 / -1' } }}>
                                    <Typography color="textSecondary">Description</Typography>
                                    <Typography sx={{ fontWeight: 'bold' }}>{project.description || 'N/A'}</Typography>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>

                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: `repeat(${summaryCards.length}, 1fr)` }, gap: 2, mb: 3 }}>
                        {summaryCards.map((card) => (
                            <Card key={card.label}>
                                <CardContent sx={{ textAlign: 'center' }}>
                                    <Typography variant="h6" sx={{ mb: 1 }}>
                                        {card.label}
                                    </Typography>
                                    <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                                        {card.value}
                                    </Typography>
                                </CardContent>
                            </Card>
                        ))}
                    </Box>

                    {(project.project_type || 'device') === 'accessory' ? (
                        <Paper sx={{ p: 2 }}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                Accessory Quantity Workflow
                            </Typography>
                            <Typography color="text.secondary" sx={{ mb: 2 }}>
                                This project uses quantity-based testing, debugging, and QC grading workflow.
                            </Typography>
                            <Button
                                variant="contained"
                                onClick={() => navigate(`/accessories/workflows?project_id=${project._id}`)}
                            >
                                Open Accessory Workflow
                            </Button>
                        </Paper>
                    ) : (
                        <>
                            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                                Batches in This Project
                            </Typography>

                            <TableContainer component={Paper}>
                                <Table>
                                    <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 'bold' }}>Batch ID</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold' }}>Batch Name</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold' }}>Variant</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold' }}>Planned</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold' }}>Produced</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {batches.length === 0 && !isLoading && (
                                            <TableRow>
                                                <TableCell colSpan={6} sx={{ py: 3 }}>
                                                    <Typography color="text.secondary">No batches found for this project.</Typography>
                                                </TableCell>
                                            </TableRow>
                                        )}

                                        {batches.map((batch) => (
                                            <TableRow key={batch._id} hover>
                                                <TableCell>{batch._id}</TableCell>
                                                <TableCell>{batch.batch_name || '-'}</TableCell>
                                                <TableCell>{batch.model_variant}</TableCell>
                                                <TableCell>{toTitle(batch.status)}</TableCell>
                                                <TableCell>{batch.planned_qty}</TableCell>
                                                <TableCell>{batch.produced_qty}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>

                                <TablePagination
                                    component="div"
                                    count={batchesTotal}
                                    page={page}
                                    onPageChange={(_, nextPage) => setPage(nextPage)}
                                    rowsPerPage={rowsPerPage}
                                    onRowsPerPageChange={(event) => {
                                        setRowsPerPage(parseInt(event.target.value, 10));
                                        setPage(0);
                                    }}
                                    rowsPerPageOptions={[20, 50, 100]}
                                />
                            </TableContainer>
                        </>
                    )}
                </>
            )}

            <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Edit Project</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        margin="normal"
                        label="Name"
                        value={editState.name}
                        onChange={(event) => setEditState((prev) => ({ ...prev, name: event.target.value }))}
                    />

                    <TextField
                        fullWidth
                        margin="normal"
                        label="Slug"
                        value={editState.slug}
                        onChange={(event) => setEditState((prev) => ({ ...prev, slug: event.target.value }))}
                    />

                    <TextField
                        fullWidth
                        margin="normal"
                        label="Description"
                        multiline
                        rows={3}
                        value={editState.description}
                        onChange={(event) => setEditState((prev) => ({ ...prev, description: event.target.value }))}
                    />

                    <ToggleButtonGroup
                        fullWidth
                        exclusive
                        value={editState.project_type}
                        onChange={(_, nextValue) => {
                            if (!nextValue) return;
                            setEditState((prev) => ({ ...prev, project_type: nextValue }));
                        }}
                        sx={{ mt: 1 }}
                    >
                        <ToggleButton value="device">Device Project</ToggleButton>
                        <ToggleButton value="accessory">Accessory Project</ToggleButton>
                    </ToggleButtonGroup>

                    <ToggleButtonGroup
                        fullWidth
                        exclusive
                        value={editState.status}
                        onChange={(_, nextValue) => {
                            if (!nextValue) return;
                            setEditState((prev) => ({ ...prev, status: nextValue }));
                        }}
                        sx={{ mt: 1.5 }}
                    >
                        {PROJECT_STATUS_OPTIONS.map((status) => (
                            <ToggleButton key={status} value={status}>
                                {toTitle(status)}
                            </ToggleButton>
                        ))}
                    </ToggleButtonGroup>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSaveEdit}>
                        Save Changes
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default ProjectDetailsPage;


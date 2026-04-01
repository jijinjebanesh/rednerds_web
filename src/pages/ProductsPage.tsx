import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Button,
    Chip,
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
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { setError, setLoading, setProducts, clearError } from '@/store/productSlice';
import { batchService, productService, projectService } from '@/services';
import { Batch, CreateProductForm, Product, ProductStage, ProductStatus, Project } from '@/types';
import PageHeader from '@/components/PageHeader';
import PageFeedback from '@/components/PageFeedback';
import { useAppUI } from '@/context/AppUIContext';
import { hasPermission } from '@/utils/rbac';
import {
    BACKEND_PRODUCT_STAGE_OPTIONS,
    BACKEND_PRODUCT_STATUS_OPTIONS,
    PRODUCT_STAGE_OPTIONS,
    PRODUCT_STATUS_OPTIONS,
    toBackendStage,
    toBackendStatus,
    toDateInputValue,
    toTitle,
} from '@/utils/workflowOptions';

const getStatusColor = (status: Product['status']): 'default' | 'success' | 'warning' | 'error' => {
    if (status === 'active' || status === 'shipped') return 'success';
    if (status === 'repair') return 'warning';
    if (status === 'returned' || status === 'scrapped') return 'error';
    return 'default';
};

const defaultCreateForm: CreateProductForm = {
    mac_address: '',
    batch_id: '',
    project_id: '',
    project_slug: '',
    model_variant: '',
    manufactured_at: new Date(),
    current_stage: 'testing',
    status: 'active',
};

const ProductsPage = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { notify } = useAppUI();
    const { products, isLoading, error, total } = useAppSelector((state) => state.products);
    const role = useAppSelector((state) => state.auth.user?.role);

    const [projects, setProjects] = useState<Project[]>([]);
    const [batches, setBatches] = useState<Batch[]>([]);

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [stageFilter, setStageFilter] = useState<string>('all');
    const [projectFilter, setProjectFilter] = useState<string>('all');

    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);

    const [openCreateDialog, setOpenCreateDialog] = useState(false);
    const [createForm, setCreateForm] = useState<CreateProductForm>(defaultCreateForm);

    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [editStage, setEditStage] = useState<ProductStage>('testing');
    const [editStatus, setEditStatus] = useState<ProductStatus>('active');

    const canCreateProduct = hasPermission(role, 'products.create');
    const canUpdateProduct = hasPermission(role, 'products.update');

    useEffect(() => {
        loadProjectsAndBatches();
    }, []);

    useEffect(() => {
        loadProducts();
    }, [page, rowsPerPage, statusFilter, stageFilter, projectFilter]);

    const filteredProducts = useMemo(() => {
        const term = search.trim().toLowerCase();

        return products.filter((product) => {
            if (!term) return true;
            return (
                product.product_id.toLowerCase().includes(term) ||
                product.mac_address.toLowerCase().includes(term) ||
                product.batch_id.toLowerCase().includes(term) ||
                product.project_id.toLowerCase().includes(term) ||
                product.current_stage.toLowerCase().includes(term)
            );
        });
    }, [products, search]);

    const selectedProject = useMemo(
        () => projects.find((project) => project._id === createForm.project_id) ?? null,
        [projects, createForm.project_id]
    );

    const availableBatches = useMemo(() => {
        if (!createForm.project_id) return batches;
        return batches.filter((batch) => batch.project_id === createForm.project_id);
    }, [batches, createForm.project_id]);

    const loadProjectsAndBatches = async () => {
        try {
            const [projectRes, batchRes] = await Promise.all([
                projectService.getProjects(1, 200),
                batchService.getBatches(1, 500),
            ]);
            setProjects(projectRes.data);
            setBatches(batchRes.data);
        } catch {
            setProjects([]);
            setBatches([]);
        }
    };

    const loadProducts = async () => {
        try {
            dispatch(setLoading(true));
            const response = await productService.getProducts(page + 1, rowsPerPage, {
                status: statusFilter === 'all' ? undefined : statusFilter,
                current_stage: stageFilter === 'all' || stageFilter === 'debugging' ? undefined : stageFilter,
                project_id: projectFilter === 'all' ? undefined : projectFilter,
            });
            dispatch(setProducts(response));
            dispatch(clearError());
        } catch (err: any) {
            const errorMessage = err?.response?.data?.message || err?.message || 'Failed to load products';
            dispatch(setError(errorMessage));
        } finally {
            dispatch(setLoading(false));
        }
    };

    const handleBatchChange = (batchId: string) => {
        const normalizedBatchId = String(batchId ?? '').trim();
        const batch = batches.find((item) => item._id === normalizedBatchId) ?? null;

        if (!batch) {
            setCreateForm((prev) => ({ ...prev, batch_id: normalizedBatchId }));
            return;
        }

        const linkedProject = projects.find((project) => project._id === batch.project_id) ?? null;

        setCreateForm((prev) => ({
            ...prev,
            batch_id: normalizedBatchId,
            project_id: batch.project_id,
            project_slug: linkedProject?.slug ?? prev.project_slug,
            model_variant: batch.model_variant || prev.model_variant,
        }));
    };

    const handleProjectChange = (projectId: string) => {
        const normalizedProjectId = String(projectId ?? '').trim();
        const project = projects.find((item) => item._id === normalizedProjectId) ?? null;

        setCreateForm((prev) => ({
            ...prev,
            project_id: normalizedProjectId,
            project_slug: project?.slug ?? prev.project_slug,
            batch_id:
                prev.batch_id && !batches.some((batch) => batch._id === prev.batch_id && batch.project_id === normalizedProjectId)
                    ? ''
                    : prev.batch_id,
        }));
    };

    const handleCreateProduct = async () => {
        const macAddress = createForm.mac_address.trim().toUpperCase();
        const batchId = createForm.batch_id.trim();
        const projectId = createForm.project_id.trim();
        const projectSlug = (createForm.project_slug || selectedProject?.slug || '').trim();
        const modelVariant = createForm.model_variant.trim();
        const manufacturedAt = new Date(createForm.manufactured_at);

        const missing: string[] = [];
        if (!macAddress) missing.push('MAC');
        if (!batchId) missing.push('Batch');
        if (!projectId) missing.push('Project');
        if (!projectSlug) missing.push('Project Slug');
        if (!modelVariant) missing.push('Model Variant');

        if (missing.length > 0) {
            notify({ message: `Please fill: ${missing.join(', ')}.`, severity: 'warning' });
            return;
        }

        if (Number.isNaN(manufacturedAt.getTime())) {
            notify({ message: 'Please provide a valid manufactured date.', severity: 'warning' });
            return;
        }

        try {
            dispatch(setLoading(true));
            await productService.createProduct({
                ...createForm,
                mac_address: macAddress,
                batch_id: batchId,
                project_id: projectId,
                project_slug: projectSlug,
                model_variant: modelVariant,
                manufactured_at: manufacturedAt,
                current_stage: toBackendStage(createForm.current_stage ?? 'testing'),
                status: toBackendStatus(createForm.status ?? 'active'),
            });

            const selectedBatch = batches.find((batch) => batch._id === batchId);
            if (selectedBatch) {
                await batchService.updateProductionQty(selectedBatch._id, selectedBatch.produced_qty + 1);
            }

            notify({ message: 'Product registered successfully.', severity: 'success' });
            setOpenCreateDialog(false);
            setCreateForm(defaultCreateForm);
            await loadProducts();
        } catch (err: any) {
            notify({ message: err?.response?.data?.message || err?.message || 'Failed to register product', severity: 'error' });
        } finally {
            dispatch(setLoading(false));
        }
    };

    const openUpdateDialog = (product: Product) => {
        setEditingProduct(product);
        setEditStage(product.current_stage);
        setEditStatus(product.status);
    };

    const handleUpdateStageAndStatus = async () => {
        if (!editingProduct) return;

        try {
            dispatch(setLoading(true));
            await productService.updateProductStage(editingProduct.product_id, {
                current_stage: toBackendStage(editStage),
                status: toBackendStatus(editStatus),
            });
            notify({ message: 'Product stage/status updated.', severity: 'success' });
            setEditingProduct(null);
            await loadProducts();
        } catch (err: any) {
            notify({ message: err?.response?.data?.message || err?.message || 'Failed to update product', severity: 'error' });
        } finally {
            dispatch(setLoading(false));
        }
    };

    return (
        <Box>
            <PageHeader
                title="Products"
                subtitle="Register products, monitor lifecycle stage, and move units through production quality flow."
                countLabel={`${filteredProducts.length} shown`}
                onRefresh={loadProducts}
                isRefreshing={isLoading}
                primaryAction={
                    canCreateProduct
                        ? {
                              label: 'Register Product',
                              onClick: () => {
                                  setCreateForm(defaultCreateForm);
                                  setOpenCreateDialog(true);
                              },
                          }
                        : undefined
                }
            />

            <PageFeedback isLoading={isLoading} error={error || null} />

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr 1fr 1fr' }, gap: 1.5, mb: 2 }}>
                <TextField
                    fullWidth
                    placeholder="Search by product ID, MAC, batch, project, or stage"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                />

                <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} fullWidth>
                    <MenuItem value="all">All Statuses</MenuItem>
                    {PRODUCT_STATUS_OPTIONS.map((status) => (
                        <MenuItem key={status} value={status}>
                            {toTitle(status)}
                        </MenuItem>
                    ))}
                </Select>

                <Select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)} fullWidth>
                    <MenuItem value="all">All Stages</MenuItem>
                    {PRODUCT_STAGE_OPTIONS.map((stage) => (
                        <MenuItem key={stage} value={stage}>
                            {toTitle(stage)}
                        </MenuItem>
                    ))}
                </Select>

                <Select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} fullWidth>
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
                            <TableCell sx={{ fontWeight: 'bold' }}>Product ID</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>MAC Address</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Batch</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Project</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Stage</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredProducts.length === 0 && !isLoading && (
                            <TableRow>
                                <TableCell colSpan={7} sx={{ py: 3 }}>
                                    <Typography color="text.secondary">No products found.</Typography>
                                </TableCell>
                            </TableRow>
                        )}

                        {filteredProducts.map((product: Product) => (
                            <TableRow
                                key={product._id}
                                hover
                                onClick={() => navigate(`/manufacturing/products/${product.product_id}`)}
                                sx={{ cursor: 'pointer' }}
                            >
                                <TableCell>{product.product_id}</TableCell>
                                <TableCell>{product.mac_address}</TableCell>
                                <TableCell>{product.batch_id}</TableCell>
                                <TableCell>{product.project_id}</TableCell>
                                <TableCell>
                                    <Chip label={toTitle(product.status)} size="small" color={getStatusColor(product.status)} />
                                </TableCell>
                                <TableCell>{toTitle(product.current_stage)}</TableCell>
                                <TableCell onClick={(event) => event.stopPropagation()}>
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        <Button size="small" onClick={() => navigate(`/manufacturing/products/${product.product_id}`)}>
                                            View
                                        </Button>
                                        <Button size="small" disabled={!canUpdateProduct} onClick={() => openUpdateDialog(product)}>
                                            Update
                                        </Button>
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
                <DialogTitle>Register Product</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        margin="normal"
                        label="MAC Address"
                        placeholder="A0:B7:65:00:00:1A"
                        value={createForm.mac_address}
                        onChange={(event) => setCreateForm((prev) => ({ ...prev, mac_address: event.target.value }))}
                    />

                    <Select
                        fullWidth
                        displayEmpty
                        value={createForm.batch_id}
                        onChange={(event) => handleBatchChange(String(event.target.value))}
                        sx={{ mt: 2 }}
                    >
                        <MenuItem value="">Select Batch</MenuItem>
                        {availableBatches.map((batch) => (
                            <MenuItem key={batch._id} value={batch._id}>
                                {batch._id} - {batch.batch_name || 'Unnamed'} ({batch.model_variant})
                            </MenuItem>
                        ))}
                    </Select>

                    <Select
                        fullWidth
                        displayEmpty
                        value={createForm.project_id}
                        onChange={(event) => handleProjectChange(String(event.target.value))}
                        sx={{ mt: 2 }}
                    >
                        <MenuItem value="">Select Project</MenuItem>
                        {projects.map((project) => (
                            <MenuItem key={project._id} value={project._id}>
                                {project.name}
                            </MenuItem>
                        ))}
                    </Select>

                    <TextField
                        fullWidth
                        margin="normal"
                        label="Project Slug"
                        value={createForm.project_slug}
                        onChange={(event) => setCreateForm((prev) => ({ ...prev, project_slug: event.target.value }))}
                        helperText={selectedProject ? `Detected from selected project: ${selectedProject.slug}` : ''}
                    />

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
                        label="Manufactured Date"
                        type="date"
                        value={toDateInputValue(createForm.manufactured_at)}
                        onChange={(event) => setCreateForm((prev) => ({ ...prev, manufactured_at: event.target.value }))}
                        InputLabelProps={{ shrink: true }}
                    />

                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mt: 1 }}>
                        <Select
                            fullWidth
                            value={createForm.current_stage ?? 'testing'}
                            onChange={(event) => setCreateForm((prev) => ({ ...prev, current_stage: event.target.value as ProductStage }))}
                        >
                            {BACKEND_PRODUCT_STAGE_OPTIONS.map((stage) => (
                                <MenuItem key={stage} value={stage}>
                                    {toTitle(stage)}
                                </MenuItem>
                            ))}
                        </Select>

                        <Select
                            fullWidth
                            value={createForm.status ?? 'active'}
                            onChange={(event) => setCreateForm((prev) => ({ ...prev, status: event.target.value as ProductStatus }))}
                        >
                            {BACKEND_PRODUCT_STATUS_OPTIONS.map((status) => (
                                <MenuItem key={status} value={status}>
                                    {toTitle(status)}
                                </MenuItem>
                            ))}
                        </Select>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenCreateDialog(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleCreateProduct} disabled={isLoading}>
                        Register
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(editingProduct)} onClose={() => setEditingProduct(null)} maxWidth="sm" fullWidth>
                <DialogTitle>Update Product Stage</DialogTitle>
                <DialogContent>
                    <Select fullWidth value={editStage} onChange={(event) => setEditStage(event.target.value as ProductStage)} sx={{ mt: 1 }}>
                        {PRODUCT_STAGE_OPTIONS.map((stage) => (
                            <MenuItem key={stage} value={stage}>
                                {toTitle(stage)}
                            </MenuItem>
                        ))}
                    </Select>

                    <Select fullWidth value={editStatus} onChange={(event) => setEditStatus(event.target.value as ProductStatus)} sx={{ mt: 2 }}>
                        {PRODUCT_STATUS_OPTIONS.map((status) => (
                            <MenuItem key={status} value={status}>
                                {toTitle(status)}
                            </MenuItem>
                        ))}
                    </Select>

                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                        Note: Backend currently maps Debugging stage to Testing and Scrapped status to Returned.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditingProduct(null)}>Cancel</Button>
                    <Button variant="contained" onClick={handleUpdateStageAndStatus} disabled={isLoading}>
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default ProductsPage;


import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Button,
    Checkbox,
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
import { Download, Plus } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { setError, setLoading, setProducts, clearError } from '@/store/productSlice';
import { batchService, productService, projectService } from '@/services';
import { Batch, CreateProductForm, Product, ProductStage, ProductStatus, Project } from '@/types';
import PageHeader from '@/components/PageHeader';
import PageFeedback from '@/components/PageFeedback';
import ActionDrawer from '@/components/ui/ActionDrawer';
import EmptyState from '@/components/ui/EmptyState';
import StatusChip from '@/components/ui/StatusChip';
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
    const [batchFilter, setBatchFilter] = useState<string>('all');
    const [modelFilter, setModelFilter] = useState<string>('all');

    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);

    const [openCreateDrawer, setOpenCreateDrawer] = useState(false);
    const [createForm, setCreateForm] = useState<CreateProductForm>(defaultCreateForm);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [editStage, setEditStage] = useState<ProductStage>('testing');
    const [editStatus, setEditStatus] = useState<ProductStatus>('active');
    const [selectedRows, setSelectedRows] = useState<string[]>([]);
    const [bulkStage, setBulkStage] = useState<ProductStage>('testing');

    const canCreateProduct = hasPermission(role, 'products.create');
    const canUpdateProduct = hasPermission(role, 'products.update');

    useEffect(() => {
        void loadProjectsAndBatches();
    }, []);

    useEffect(() => {
        void loadProducts();
    }, [page, rowsPerPage, statusFilter, stageFilter]);

    const filteredProducts = useMemo(() => {
        const term = search.trim().toLowerCase();
        return products.filter((product) => {
            if (batchFilter !== 'all' && product.batch_id !== batchFilter) return false;
            if (modelFilter !== 'all' && product.model_variant !== modelFilter) return false;
            if (!term) return true;
            return (
                product.product_id.toLowerCase().includes(term) ||
                product.mac_address.toLowerCase().includes(term) ||
                product.batch_id.toLowerCase().includes(term) ||
                product.project_id.toLowerCase().includes(term) ||
                product.model_variant.toLowerCase().includes(term)
            );
        });
    }, [batchFilter, modelFilter, products, search]);

    const selectedProject = useMemo(
        () => projects.find((project) => project._id === createForm.project_id) ?? null,
        [projects, createForm.project_id]
    );

    const availableBatches = useMemo(() => {
        if (!createForm.project_id) return batches;
        return batches.filter((batch) => batch.project_id === createForm.project_id);
    }, [batches, createForm.project_id]);

    const modelOptions = useMemo(() => {
        return Array.from(new Set(products.map((product) => product.model_variant))).sort();
    }, [products]);

    const loadProjectsAndBatches = async () => {
        try {
            const [projectRes, batchRes] = await Promise.all([projectService.getProjects(1, 200), batchService.getBatches(1, 500)]);
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
            });
            dispatch(setProducts(response));
            dispatch(clearError());
        } catch (err: any) {
            dispatch(setError(err?.response?.data?.message || err?.message || 'Failed to load products'));
        } finally {
            dispatch(setLoading(false));
        }
    };

    const handleBatchChange = (batchId: string) => {
        const batch = batches.find((item) => item._id === batchId) ?? null;

        if (!batch) {
            setCreateForm((previous) => ({ ...previous, batch_id: batchId }));
            return;
        }

        const linkedProject = projects.find((project) => project._id === batch.project_id) ?? null;

        setCreateForm((previous) => ({
            ...previous,
            batch_id: batchId,
            project_id: batch.project_id,
            project_slug: linkedProject?.slug ?? previous.project_slug,
            model_variant: batch.model_variant || previous.model_variant,
        }));
    };

    const handleProjectChange = (projectId: string) => {
        const project = projects.find((item) => item._id === projectId) ?? null;
        setCreateForm((previous) => ({
            ...previous,
            project_id: projectId,
            project_slug: project?.slug ?? previous.project_slug,
            batch_id: previous.batch_id && !batches.some((batch) => batch._id === previous.batch_id && batch.project_id === projectId) ? '' : previous.batch_id,
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
            setOpenCreateDrawer(false);
            setCreateForm(defaultCreateForm);
            await loadProducts();
        } catch (err: any) {
            notify({ message: err?.response?.data?.message || err?.message || 'Failed to register product', severity: 'error' });
        } finally {
            dispatch(setLoading(false));
        }
    };

    const openUpdateDrawer = (product: Product) => {
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

    const handleBulkStageUpdate = async () => {
        if (!selectedRows.length) return;

        try {
            dispatch(setLoading(true));
            await Promise.all(
                selectedRows.map((productId) =>
                    productService.updateProductStage(productId, {
                        current_stage: toBackendStage(bulkStage),
                    })
                )
            );
            notify({ message: `Updated ${selectedRows.length} product(s).`, severity: 'success' });
            setSelectedRows([]);
            await loadProducts();
        } catch (err: any) {
            notify({ message: err?.response?.data?.message || err?.message || 'Bulk update failed', severity: 'error' });
        } finally {
            dispatch(setLoading(false));
        }
    };

    const exportSelected = () => {
        const rows = filteredProducts.filter((product) => selectedRows.includes(product.product_id));
        const csv = [
            ['Product ID', 'MAC', 'Model Variant', 'Batch', 'Stage', 'Status', 'Grade'],
            ...rows.map((product) => [
                product.product_id,
                product.mac_address,
                product.model_variant,
                product.batch_id,
                product.current_stage,
                product.status,
                product.quality_grade ?? '',
            ]),
        ]
            .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'products-export.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const toggleSelection = (productId: string) => {
        setSelectedRows((previous) => (previous.includes(productId) ? previous.filter((id) => id !== productId) : [...previous, productId]));
    };

    const allSelected = filteredProducts.length > 0 && filteredProducts.every((product) => selectedRows.includes(product.product_id));

    return (
        <Box>
            <PageHeader
                title="Products"
                subtitle="Serialized device tracking with dense operational visibility across stage, status, grade, and batch context."
                countLabel={`${filteredProducts.length} shown`}
                onRefresh={loadProducts}
                isRefreshing={isLoading}
                primaryAction={canCreateProduct ? { label: 'Register Product', onClick: () => setOpenCreateDrawer(true) } : undefined}
            />

            <PageFeedback isLoading={isLoading} error={error || null} />

            {selectedRows.length > 0 ? (
                <Paper sx={{ p: 2, mb: 2.5 }}>
                    <Stack direction={{ xs: 'column', xl: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', xl: 'center' }} justifyContent="space-between">
                        <Typography variant="subtitle2">{selectedRows.length} product(s) selected</Typography>
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                            <Select value={bulkStage} onChange={(event) => setBulkStage(event.target.value as ProductStage)} size="small">
                                {BACKEND_PRODUCT_STAGE_OPTIONS.map((stage) => (
                                    <MenuItem key={stage} value={stage}>
                                        {toTitle(stage)}
                                    </MenuItem>
                                ))}
                            </Select>
                            <Button variant="outlined" startIcon={<Download size={16} />} onClick={exportSelected}>
                                Export
                            </Button>
                            <Button variant="contained" onClick={() => void handleBulkStageUpdate()}>
                                Reassign Stage
                            </Button>
                        </Stack>
                    </Stack>
                </Paper>
            ) : null}

            <Stack direction={{ xs: 'column', xl: 'row' }} spacing={1.5} sx={{ mb: 3 }}>
                <TextField
                    fullWidth
                    placeholder="Search product ID, MAC, project, batch, or model"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                />

                <Select fullWidth value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}>
                    <MenuItem value="all">All stages</MenuItem>
                    {PRODUCT_STAGE_OPTIONS.map((stage) => (
                        <MenuItem key={stage} value={stage}>
                            {toTitle(stage)}
                        </MenuItem>
                    ))}
                </Select>

                <Select fullWidth value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <MenuItem value="all">All statuses</MenuItem>
                    {PRODUCT_STATUS_OPTIONS.map((status) => (
                        <MenuItem key={status} value={status}>
                            {toTitle(status)}
                        </MenuItem>
                    ))}
                </Select>

                <Select fullWidth value={batchFilter} onChange={(event) => setBatchFilter(event.target.value)}>
                    <MenuItem value="all">All batches</MenuItem>
                    {batches.map((batch) => (
                        <MenuItem key={batch._id} value={batch._id}>
                            {batch._id}
                        </MenuItem>
                    ))}
                </Select>

                <Select fullWidth value={modelFilter} onChange={(event) => setModelFilter(event.target.value)}>
                    <MenuItem value="all">All models</MenuItem>
                    {modelOptions.map((model) => (
                        <MenuItem key={model} value={model}>
                            {model}
                        </MenuItem>
                    ))}
                </Select>
            </Stack>

            {filteredProducts.length === 0 && !isLoading ? (
                <EmptyState
                    title="No products found"
                    description="Register serialized products under device batches to populate this manufacturing table."
                    action={canCreateProduct ? { label: 'Register product', onClick: () => setOpenCreateDrawer(true) } : undefined}
                />
            ) : (
                <TableContainer component={Paper}>
                    <Table stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell padding="checkbox">
                                    <Checkbox
                                        checked={allSelected}
                                        indeterminate={selectedRows.length > 0 && !allSelected}
                                        onChange={(event) => {
                                            if (event.target.checked) {
                                                setSelectedRows(filteredProducts.map((product) => product.product_id));
                                            } else {
                                                setSelectedRows([]);
                                            }
                                        }}
                                    />
                                </TableCell>
                                <TableCell>Product ID</TableCell>
                                <TableCell>MAC</TableCell>
                                <TableCell>Model</TableCell>
                                <TableCell>Batch</TableCell>
                                <TableCell>Stage</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Grade</TableCell>
                                <TableCell>Last Updated</TableCell>
                                <TableCell align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredProducts.map((product) => (
                                <TableRow key={product._id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/manufacturing/products/${product.product_id}`)}>
                                    <TableCell padding="checkbox" onClick={(event) => event.stopPropagation()}>
                                        <Checkbox checked={selectedRows.includes(product.product_id)} onChange={() => toggleSelection(product.product_id)} />
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="subtitle2">{product.product_id}</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {product.project_id}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>{product.mac_address}</TableCell>
                                    <TableCell>{product.model_variant}</TableCell>
                                    <TableCell>{product.batch_id}</TableCell>
                                    <TableCell>
                                        <StatusChip value={product.current_stage} />
                                    </TableCell>
                                    <TableCell>
                                        <StatusChip value={product.status} />
                                    </TableCell>
                                    <TableCell>
                                        {product.quality_grade ? <StatusChip value={product.quality_grade} label={`Grade ${product.quality_grade}`} /> : <Typography variant="body2" color="text.secondary">-</Typography>}
                                    </TableCell>
                                    <TableCell>{new Date(product.updated_at ?? product.updatedAt ?? product.manufactured_at).toLocaleString()}</TableCell>
                                    <TableCell align="right" onClick={(event) => event.stopPropagation()}>
                                        <Button variant="outlined" size="small" onClick={() => openUpdateDrawer(product)} disabled={!canUpdateProduct}>
                                            Update
                                        </Button>
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
                        rowsPerPageOptions={[25, 50, 100]}
                    />
                </TableContainer>
            )}

            <ActionDrawer
                open={openCreateDrawer}
                onClose={() => setOpenCreateDrawer(false)}
                title="Register Product"
                subtitle="Create a serialized device unit without changing the existing registration payload."
            >
                <Stack spacing={2}>
                    <TextField
                        fullWidth
                        label="MAC Address"
                        value={createForm.mac_address}
                        onChange={(event) => setCreateForm((previous) => ({ ...previous, mac_address: event.target.value }))}
                    />

                    <Select fullWidth value={createForm.project_id} onChange={(event) => handleProjectChange(event.target.value)} displayEmpty>
                        <MenuItem value="">Select project</MenuItem>
                        {projects.filter((project) => project.project_type === 'device').map((project) => (
                            <MenuItem key={project._id} value={project._id}>
                                {project.name}
                            </MenuItem>
                        ))}
                    </Select>

                    <Select fullWidth value={createForm.batch_id} onChange={(event) => handleBatchChange(event.target.value)} displayEmpty>
                        <MenuItem value="">Select batch</MenuItem>
                        {availableBatches.map((batch) => (
                            <MenuItem key={batch._id} value={batch._id}>
                                {batch._id} - {batch.model_variant}
                            </MenuItem>
                        ))}
                    </Select>

                    <TextField
                        fullWidth
                        label="Project Slug"
                        value={createForm.project_slug || selectedProject?.slug || ''}
                        onChange={(event) => setCreateForm((previous) => ({ ...previous, project_slug: event.target.value }))}
                    />

                    <TextField
                        fullWidth
                        label="Model Variant"
                        value={createForm.model_variant}
                        onChange={(event) => setCreateForm((previous) => ({ ...previous, model_variant: event.target.value }))}
                    />

                    <TextField
                        fullWidth
                        label="Manufactured Date"
                        type="date"
                        value={toDateInputValue(createForm.manufactured_at)}
                        onChange={(event) => setCreateForm((previous) => ({ ...previous, manufactured_at: event.target.value }))}
                        InputLabelProps={{ shrink: true }}
                    />

                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                        <Select
                            fullWidth
                            value={createForm.current_stage ?? 'testing'}
                            onChange={(event) => setCreateForm((previous) => ({ ...previous, current_stage: event.target.value as ProductStage }))}
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
                            onChange={(event) => setCreateForm((previous) => ({ ...previous, status: event.target.value as ProductStatus }))}
                        >
                            {BACKEND_PRODUCT_STATUS_OPTIONS.map((status) => (
                                <MenuItem key={status} value={status}>
                                    {toTitle(status)}
                                </MenuItem>
                            ))}
                        </Select>
                    </Stack>

                    <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
                        <Button variant="outlined" onClick={() => setOpenCreateDrawer(false)}>
                            Cancel
                        </Button>
                        <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => void handleCreateProduct()} disabled={isLoading}>
                            Register Product
                        </Button>
                    </Stack>
                </Stack>
            </ActionDrawer>

            <ActionDrawer
                open={Boolean(editingProduct)}
                onClose={() => setEditingProduct(null)}
                title={editingProduct ? `Update ${editingProduct.product_id}` : 'Update Product'}
                subtitle="Stage and status updates keep using the current backend stage endpoint."
            >
                <Stack spacing={2}>
                    <Select fullWidth value={editStage} onChange={(event) => setEditStage(event.target.value as ProductStage)}>
                        {BACKEND_PRODUCT_STAGE_OPTIONS.map((stage) => (
                            <MenuItem key={stage} value={stage}>
                                {toTitle(stage)}
                            </MenuItem>
                        ))}
                    </Select>

                    <Select fullWidth value={editStatus} onChange={(event) => setEditStatus(event.target.value as ProductStatus)}>
                        {BACKEND_PRODUCT_STATUS_OPTIONS.map((status) => (
                            <MenuItem key={status} value={status}>
                                {toTitle(status)}
                            </MenuItem>
                        ))}
                    </Select>

                    <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
                        <Button variant="outlined" onClick={() => setEditingProduct(null)}>
                            Cancel
                        </Button>
                        <Button variant="contained" onClick={() => void handleUpdateStageAndStatus()} disabled={isLoading}>
                            Save Changes
                        </Button>
                    </Stack>
                </Stack>
            </ActionDrawer>
        </Box>
    );
};

export default ProductsPage;

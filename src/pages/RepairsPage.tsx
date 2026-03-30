import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Drawer,
    FormControlLabel,
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
    TablePagination,
    TableRow,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material';
import PageHeader from '@/components/PageHeader';
import PageFeedback from '@/components/PageFeedback';
import { customerRepairService, productService } from '@/services';
import { CreateCustomerRepairForm } from '@/services/repairs';
import { CustomerRepair, Product } from '@/types';
import { useAppUI } from '@/context/AppUIContext';
import { REPAIR_STATUS_OPTIONS, toDateInputValue, toTitle } from '@/utils/workflowOptions';

interface IntakeFormState extends CreateCustomerRepairForm {
    customer_name: string;
    customer_phone: string;
    customer_email: string;
}

const defaultIntakeForm: IntakeFormState = {
    product_id: '',
    mac_address: '',
    customer_id: '',
    complaint: '',
    in_warranty: true,
    received_date: new Date(),
    customer_name: '',
    customer_phone: '',
    customer_email: '',
};

const getDurationInDays = (start: Date, end: Date) => {
    const ms = end.getTime() - start.getTime();
    return Math.max(0, ms / (1000 * 60 * 60 * 24));
};

const RepairsPage = () => {
    const navigate = useNavigate();
    const { notify } = useAppUI();

    const [repairs, setRepairs] = useState<CustomerRepair[]>([]);
    const [products, setProducts] = useState<Product[]>([]);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [projectFilter, setProjectFilter] = useState<string>('all');
    const [warrantyOnly, setWarrantyOnly] = useState(false);
    const [dateRangeFilter, setDateRangeFilter] = useState<'7d' | '30d' | 'all'>('30d');

    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(20);

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [intakeForm, setIntakeForm] = useState<IntakeFormState>(defaultIntakeForm);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [lookupError, setLookupError] = useState<string | null>(null);
    const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        void loadData();
    }, []);

    const loadData = async () => {
        try {
            setIsLoading(true);
            setError(null);

            const [repairsRes, productsRes] = await Promise.all([
                customerRepairService.getRepairs(1, 1000),
                productService.getProducts(1, 1000),
            ]);

            setRepairs(repairsRes.data);
            setProducts(productsRes.data);
        } catch (err: any) {
            setError(err?.response?.data?.message || err?.message || 'Failed to load repair cases');
        } finally {
            setIsLoading(false);
        }
    };

    const productById = useMemo(() => {
        const map = new Map<string, Product>();
        for (const product of products) {
            map.set(product.product_id, product);
        }
        return map;
    }, [products]);

    const projectOptions = useMemo(() => {
        return Array.from(new Set(products.map((product) => product.project_id))).sort();
    }, [products]);

    const customerOptions = useMemo(() => {
        return Array.from(new Set(repairs.map((repair) => repair.customer_id))).sort();
    }, [repairs]);

    const filteredRepairs = useMemo(() => {
        const term = search.trim().toLowerCase();
        const now = new Date();

        return repairs.filter((repair) => {
            if (statusFilter !== 'all' && repair.status !== statusFilter) return false;
            if (warrantyOnly && !repair.in_warranty) return false;

            const linkedProduct = productById.get(repair.product_id);
            if (projectFilter !== 'all' && linkedProduct?.project_id !== projectFilter) return false;

            if (dateRangeFilter !== 'all') {
                const received = new Date(repair.received_date);
                const limit = new Date(now);
                limit.setDate(now.getDate() - (dateRangeFilter === '7d' ? 7 : 30));
                if (received < limit) return false;
            }

            if (!term) return true;
            return (
                repair.product_id.toLowerCase().includes(term) ||
                repair.customer_id.toLowerCase().includes(term) ||
                repair.status.toLowerCase().includes(term) ||
                repair.complaint.toLowerCase().includes(term)
            );
        });
    }, [repairs, productById, search, statusFilter, projectFilter, warrantyOnly, dateRangeFilter]);

    const pagedRepairs = useMemo(() => {
        const start = page * rowsPerPage;
        return filteredRepairs.slice(start, start + rowsPerPage);
    }, [filteredRepairs, page, rowsPerPage]);

    const stats = useMemo(() => {
        const openCases = repairs.filter((repair) => ['received', 'in_progress'].includes(repair.status)).length;
        const warrantyCases = repairs.filter((repair) => repair.in_warranty).length;

        const now = new Date();
        const month = now.getMonth();
        const year = now.getFullYear();
        const resolvedThisMonth = repairs.filter((repair) => {
            if (!repair.closed_date) return false;
            const closedAt = new Date(repair.closed_date);
            return closedAt.getMonth() === month && closedAt.getFullYear() === year;
        }).length;

        const closedWithDates = repairs.filter((repair) => repair.closed_date);
        const averageResolutionDays =
            closedWithDates.length > 0
                ? closedWithDates.reduce((sum, repair) => {
                      return sum + getDurationInDays(new Date(repair.received_date), new Date(repair.closed_date!));
                  }, 0) / closedWithDates.length
                : 0;

        return {
            openCases,
            warrantyCases,
            resolvedThisMonth,
            averageResolutionDays,
        };
    }, [repairs]);

    const openIntakeDrawer = () => {
        setDrawerOpen(true);
        setIntakeForm({ ...defaultIntakeForm, received_date: new Date() });
        setSelectedProduct(null);
        setLookupError(null);
        setShowNewCustomerForm(false);
    };

    const lookupByMac = async () => {
        const mac = intakeForm.mac_address.trim().toUpperCase();
        if (!mac) return;

        try {
            setLookupError(null);
            const product = await productService.getProductByMac(mac);
            const priorCases = repairs.filter((repair) => repair.product_id === product.product_id).length;

            setSelectedProduct(product);
            setIntakeForm((prev) => ({
                ...prev,
                mac_address: product.mac_address,
                product_id: product.product_id,
                in_warranty: product.warranty_expiry ? new Date(product.warranty_expiry) > new Date() : prev.in_warranty,
            }));

            notify({ message: `Product loaded. ${priorCases} prior repair case(s).`, severity: 'info' });
        } catch (err: any) {
            setSelectedProduct(null);
            setLookupError(err?.response?.data?.message || 'Product not found for this MAC address.');
        }
    };

    const handleCreateRepair = async () => {
        if (!selectedProduct) {
            notify({ message: 'Lookup and select a valid product first.', severity: 'warning' });
            return;
        }

        const customerId = intakeForm.customer_id.trim() || (intakeForm.customer_phone ? `CUST-${intakeForm.customer_phone.trim()}` : '');

        if (!customerId || !intakeForm.complaint.trim()) {
            notify({ message: 'Customer and complaint are required.', severity: 'warning' });
            return;
        }

        try {
            setIsSubmitting(true);
            await customerRepairService.createRepair({
                product_id: selectedProduct.product_id,
                mac_address: selectedProduct.mac_address,
                customer_id: customerId,
                complaint: intakeForm.complaint.trim(),
                in_warranty: intakeForm.in_warranty,
                received_date: intakeForm.received_date,
            });

            notify({ message: 'Repair intake created successfully.', severity: 'success' });
            setDrawerOpen(false);
            await loadData();
        } catch (err: any) {
            notify({ message: err?.response?.data?.message || err?.message || 'Failed to create repair intake', severity: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Box>
            <PageHeader
                title="Customer Repairs"
                subtitle="Track incoming repair cases, warranty coverage, and resolution progress."
                countLabel={`${filteredRepairs.length} cases`}
                onRefresh={loadData}
                isRefreshing={isLoading}
                primaryAction={{
                    label: 'New Repair Intake',
                    onClick: openIntakeDrawer,
                }}
            />

            <PageFeedback isLoading={isLoading} error={error} />

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
                <Card sx={{ flex: 1 }}>
                    <CardContent>
                        <Typography color="text.secondary">Open Cases</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700 }}>
                            {stats.openCases}
                        </Typography>
                    </CardContent>
                </Card>

                <Card sx={{ flex: 1 }}>
                    <CardContent>
                        <Typography color="text.secondary">In Warranty</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700 }}>
                            {stats.warrantyCases}
                        </Typography>
                    </CardContent>
                </Card>

                <Card sx={{ flex: 1 }}>
                    <CardContent>
                        <Typography color="text.secondary">Resolved This Month</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700 }}>
                            {stats.resolvedThisMonth}
                        </Typography>
                    </CardContent>
                </Card>

                <Card sx={{ flex: 1 }}>
                    <CardContent>
                        <Typography color="text.secondary">Avg Resolution (Days)</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700 }}>
                            {stats.averageResolutionDays.toFixed(1)}
                        </Typography>
                    </CardContent>
                </Card>
            </Stack>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr 1fr' }, gap: 1.5, mb: 1.5 }}>
                <TextField
                    fullWidth
                    placeholder="Search by product ID, customer ID, status, or complaint"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                />

                <Select fullWidth value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <MenuItem value="all">All Statuses</MenuItem>
                    {REPAIR_STATUS_OPTIONS.map((status) => (
                        <MenuItem key={status} value={status}>
                            {toTitle(status)}
                        </MenuItem>
                    ))}
                </Select>

                <Select fullWidth value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
                    <MenuItem value="all">All Projects</MenuItem>
                    {projectOptions.map((projectId) => (
                        <MenuItem key={projectId} value={projectId}>
                            {projectId}
                        </MenuItem>
                    ))}
                </Select>
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
                <FormControlLabel control={<Switch checked={warrantyOnly} onChange={(event) => setWarrantyOnly(event.target.checked)} />} label="In Warranty Only" />

                <ToggleButtonGroup
                    value={dateRangeFilter}
                    exclusive
                    onChange={(_, nextValue) => {
                        if (!nextValue) return;
                        setDateRangeFilter(nextValue);
                    }}
                    size="small"
                >
                    <ToggleButton value="7d">Last 7 Days</ToggleButton>
                    <ToggleButton value="30d">Last 30 Days</ToggleButton>
                    <ToggleButton value="all">All</ToggleButton>
                </ToggleButtonGroup>
            </Stack>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Repair ID</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Product</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Customer</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Warranty</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Received</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {pagedRepairs.length === 0 && !isLoading && (
                            <TableRow>
                                <TableCell colSpan={6} sx={{ py: 3 }}>
                                    <Typography color="text.secondary">No repair cases found.</Typography>
                                </TableCell>
                            </TableRow>
                        )}

                        {pagedRepairs.map((repair) => (
                            <TableRow key={repair._id} hover onClick={() => navigate(`/quality/repairs/${repair._id}`)} sx={{ cursor: 'pointer' }}>
                                <TableCell>{repair._id}</TableCell>
                                <TableCell>{repair.product_id}</TableCell>
                                <TableCell>{repair.customer_id}</TableCell>
                                <TableCell>
                                    <Chip label={toTitle(repair.status)} size="small" />
                                </TableCell>
                                <TableCell>{repair.in_warranty ? 'In Warranty' : 'Out of Warranty'}</TableCell>
                                <TableCell>{new Date(repair.received_date).toLocaleDateString()}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                <TablePagination
                    component="div"
                    count={filteredRepairs.length}
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

            <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
                <Box sx={{ width: { xs: '100vw', sm: 460 }, p: 2.5 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                        New Repair Intake
                    </Typography>

                    <TextField
                        fullWidth
                        label="MAC Address"
                        value={intakeForm.mac_address}
                        onChange={(event) => {
                            setIntakeForm((prev) => ({ ...prev, mac_address: event.target.value, product_id: '' }));
                            setSelectedProduct(null);
                            setLookupError(null);
                        }}
                        onBlur={() => void lookupByMac()}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                void lookupByMac();
                            }
                        }}
                        placeholder="A0:B7:65:00:00:1A"
                        sx={{ mt: 1 }}
                    />

                    {lookupError && (
                        <Alert severity="error" sx={{ mt: 1.5 }}>
                            {lookupError}
                        </Alert>
                    )}

                    {selectedProduct && (
                        <Paper variant="outlined" sx={{ mt: 1.5, p: 1.5 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                Product Preview
                            </Typography>
                            <Typography variant="body2">Product: {selectedProduct.product_id}</Typography>
                            <Typography variant="body2">Project: {selectedProduct.project_id}</Typography>
                            <Typography variant="body2">Warranty Expiry: {selectedProduct.warranty_expiry ? toDateInputValue(selectedProduct.warranty_expiry) : 'N/A'}</Typography>
                            <Typography variant="body2" sx={{ mt: 0.5 }}>
                                {intakeForm.in_warranty ? 'In warranty' : 'Out of warranty'}
                            </Typography>
                        </Paper>
                    )}

                    <Select
                        fullWidth
                        displayEmpty
                        value={intakeForm.customer_id}
                        onChange={(event) => {
                            if (event.target.value === '__new__') {
                                setShowNewCustomerForm(true);
                                return;
                            }
                            setShowNewCustomerForm(false);
                            setIntakeForm((prev) => ({ ...prev, customer_id: event.target.value }));
                        }}
                        sx={{ mt: 2 }}
                        disabled={!selectedProduct}
                    >
                        <MenuItem value="">Select Customer</MenuItem>
                        {customerOptions.map((customerId) => (
                            <MenuItem key={customerId} value={customerId}>
                                {customerId}
                            </MenuItem>
                        ))}
                        <MenuItem value="__new__">Add New Customer</MenuItem>
                    </Select>

                    {showNewCustomerForm && (
                        <Box sx={{ mt: 1.5, display: 'grid', gap: 1 }}>
                            <TextField
                                fullWidth
                                label="Customer Name"
                                value={intakeForm.customer_name}
                                onChange={(event) => setIntakeForm((prev) => ({ ...prev, customer_name: event.target.value }))}
                            />
                            <TextField
                                fullWidth
                                label="Phone"
                                value={intakeForm.customer_phone}
                                onChange={(event) => {
                                    const phone = event.target.value;
                                    setIntakeForm((prev) => ({ ...prev, customer_phone: phone, customer_id: phone ? `CUST-${phone}` : '' }));
                                }}
                            />
                            <TextField
                                fullWidth
                                label="Email"
                                value={intakeForm.customer_email}
                                onChange={(event) => setIntakeForm((prev) => ({ ...prev, customer_email: event.target.value }))}
                            />
                        </Box>
                    )}

                    <TextField
                        fullWidth
                        label="Complaint"
                        multiline
                        rows={3}
                        value={intakeForm.complaint}
                        onChange={(event) => setIntakeForm((prev) => ({ ...prev, complaint: event.target.value }))}
                        sx={{ mt: 2 }}
                        disabled={!selectedProduct}
                    />

                    <TextField
                        fullWidth
                        type="date"
                        label="Received Date"
                        value={toDateInputValue(intakeForm.received_date)}
                        onChange={(event) => setIntakeForm((prev) => ({ ...prev, received_date: event.target.value }))}
                        InputLabelProps={{ shrink: true }}
                        sx={{ mt: 2 }}
                    />

                    <FormControlLabel
                        sx={{ mt: 1 }}
                        control={
                            <Switch
                                checked={intakeForm.in_warranty}
                                onChange={(event) => setIntakeForm((prev) => ({ ...prev, in_warranty: event.target.checked }))}
                            />
                        }
                        label="In Warranty"
                    />

                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
                        <Button onClick={() => setDrawerOpen(false)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button variant="contained" onClick={handleCreateRepair} disabled={isSubmitting || !selectedProduct}>
                            {isSubmitting ? 'Saving...' : 'Create Intake'}
                        </Button>
                    </Box>
                </Box>
            </Drawer>
        </Box>
    );
};

export default RepairsPage;

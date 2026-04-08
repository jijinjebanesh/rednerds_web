import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    FormControlLabel,
    Grid,
    MenuItem,
    Paper,
    Select,
    Stack,
    Switch,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material';
import { PlusCircle, ShieldCheck, Wrench } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import PageFeedback from '@/components/PageFeedback';
import { customerRepairService, productService } from '@/services';
import { CreateCustomerRepairForm } from '@/services/repairs';
import { CustomerRepair, Product } from '@/types';
import MetricCard from '@/components/ui/MetricCard';
import EmptyState from '@/components/ui/EmptyState';
import ActionDrawer from '@/components/ui/ActionDrawer';
import StatusChip from '@/components/ui/StatusChip';
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

const BOARD_COLUMNS: Array<CustomerRepair['status']> = ['received', 'in_progress', 'returned_to_customer', 'unrepairable'];

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

    const projectOptions = useMemo(() => Array.from(new Set(products.map((product) => product.project_id))).sort(), [products]);
    const customerOptions = useMemo(() => Array.from(new Set(repairs.map((repair) => repair.customer_id))).sort(), [repairs]);

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
    }, [dateRangeFilter, productById, projectFilter, repairs, search, statusFilter, warrantyOnly]);

    const stats = useMemo(() => {
        const openCases = repairs.filter((repair) => ['received', 'in_progress'].includes(repair.status)).length;
        const warrantyCases = repairs.filter((repair) => repair.in_warranty).length;
        const resolvedThisMonth = repairs.filter((repair) => {
            if (!repair.closed_date) return false;
            const closedAt = new Date(repair.closed_date);
            const now = new Date();
            return closedAt.getMonth() === now.getMonth() && closedAt.getFullYear() === now.getFullYear();
        }).length;
        const closedWithDates = repairs.filter((repair) => repair.closed_date);
        const averageResolutionDays =
            closedWithDates.length > 0
                ? closedWithDates.reduce((sum, repair) => sum + getDurationInDays(new Date(repair.received_date), new Date(repair.closed_date!)), 0) / closedWithDates.length
                : 0;

        return {
            openCases,
            warrantyCases,
            resolvedThisMonth,
            averageResolutionDays,
        };
    }, [repairs]);

    const boardData = useMemo(() => {
        return BOARD_COLUMNS.map((status) => ({
            status,
            items: filteredRepairs.filter((repair) => repair.status === status),
        }));
    }, [filteredRepairs]);

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
            setIntakeForm((previous) => ({
                ...previous,
                mac_address: product.mac_address,
                product_id: product.product_id,
                in_warranty: product.warranty_expiry ? new Date(product.warranty_expiry) > new Date() : previous.in_warranty,
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
                subtitle="Triage incoming repair cases, monitor warranty coverage, and keep the quality service queue visible at a glance."
                countLabel={`${filteredRepairs.length} cases`}
                onRefresh={loadData}
                isRefreshing={isLoading}
                primaryAction={{ label: 'New Repair Intake', onClick: openIntakeDrawer }}
            />

            <PageFeedback isLoading={isLoading} error={error} />

            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={3}>
                    <MetricCard title="Open Cases" value={stats.openCases} subtitle="Received and in progress" icon={<Wrench size={18} />} />
                </Grid>
                <Grid item xs={12} md={3}>
                    <MetricCard title="In Warranty" value={stats.warrantyCases} subtitle="Covered under service policy" icon={<ShieldCheck size={18} />} accent="#4FD18B" />
                </Grid>
                <Grid item xs={12} md={3}>
                    <MetricCard title="Resolved This Month" value={stats.resolvedThisMonth} subtitle="Closed repair cases" icon={<PlusCircle size={18} />} accent="#00C9B1" />
                </Grid>
                <Grid item xs={12} md={3}>
                    <MetricCard title="Avg Resolution Days" value={stats.averageResolutionDays.toFixed(1)} subtitle="Average for closed cases" icon={<Wrench size={18} />} accent="#F7A84F" />
                </Grid>
            </Grid>

            <Stack direction={{ xs: 'column', xl: 'row' }} spacing={1.5} sx={{ mb: 2.5 }}>
                <TextField
                    fullWidth
                    placeholder="Search by product ID, customer ID, status, or complaint"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                />

                <Select fullWidth value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <MenuItem value="all">All statuses</MenuItem>
                    {REPAIR_STATUS_OPTIONS.map((status) => (
                        <MenuItem key={status} value={status}>
                            {toTitle(status)}
                        </MenuItem>
                    ))}
                </Select>

                <Select fullWidth value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
                    <MenuItem value="all">All projects</MenuItem>
                    {projectOptions.map((projectId) => (
                        <MenuItem key={projectId} value={projectId}>
                            {projectId}
                        </MenuItem>
                    ))}
                </Select>
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', md: 'center' }} sx={{ mb: 3 }}>
                <FormControlLabel control={<Switch checked={warrantyOnly} onChange={(event) => setWarrantyOnly(event.target.checked)} />} label="In warranty only" />
                <ToggleButtonGroup
                    value={dateRangeFilter}
                    exclusive
                    onChange={(_, nextValue) => {
                        if (!nextValue) return;
                        setDateRangeFilter(nextValue);
                    }}
                    size="small"
                >
                    <ToggleButton value="7d">Last 7 days</ToggleButton>
                    <ToggleButton value="30d">Last 30 days</ToggleButton>
                    <ToggleButton value="all">All</ToggleButton>
                </ToggleButtonGroup>
            </Stack>

            {filteredRepairs.length === 0 && !isLoading ? (
                <EmptyState
                    icon={<Wrench size={24} />}
                    title="No repair cases found"
                    description="When customer devices are received for servicing they will appear here. You can also create a fresh intake now."
                    action={{ label: 'Create repair intake', onClick: openIntakeDrawer }}
                />
            ) : (
                <Grid container spacing={2}>
                    {boardData.map((column) => (
                        <Grid item xs={12} md={6} xl={3} key={column.status}>
                            <Paper sx={{ p: 2, height: '100%' }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                                    <Typography variant="subtitle1">{toTitle(column.status)}</Typography>
                                    <StatusChip value={column.status} />
                                </Stack>

                                <Stack spacing={1.5}>
                                    {column.items.map((repair) => {
                                        const product = productById.get(repair.product_id);
                                        const daysOpen = getDurationInDays(new Date(repair.received_date), new Date());

                                        return (
                                            <Paper
                                                key={repair._id}
                                                sx={{
                                                    p: 1.75,
                                                    cursor: 'pointer',
                                                    transition: 'transform 160ms ease, border-color 160ms ease',
                                                    '&:hover': {
                                                        transform: 'translateY(-2px)',
                                                        borderColor: 'primary.main',
                                                    },
                                                }}
                                                onClick={() => navigate(`/quality/repairs/${repair._id}`)}
                                            >
                                                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
                                                    <Box>
                                                        <Typography variant="subtitle2">{repair.product_id}</Typography>
                                                        <Typography variant="body2" color="text.secondary">
                                                            {repair.customer_id}
                                                        </Typography>
                                                    </Box>
                                                    <StatusChip value={repair.in_warranty ? 'active' : 'partial'} label={repair.in_warranty ? 'Warranty' : 'Out of warranty'} />
                                                </Stack>

                                                <Typography variant="body2" sx={{ mt: 1.25 }}>
                                                    {repair.complaint}
                                                </Typography>

                                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
                                                    <StatusChip label={`${daysOpen.toFixed(0)}d open`} />
                                                    {product ? <StatusChip label={product.project_id} /> : null}
                                                </Stack>
                                            </Paper>
                                        );
                                    })}

                                    {column.items.length === 0 ? (
                                        <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                                            <Typography variant="body2" color="text.secondary">
                                                No cases in this column.
                                            </Typography>
                                        </Paper>
                                    ) : null}
                                </Stack>
                            </Paper>
                        </Grid>
                    ))}
                </Grid>
            )}

            <ActionDrawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                title="New Repair Intake"
                subtitle="Lookup the serialized product first, then register the customer issue against it."
            >
                <Stack spacing={2}>
                    <TextField
                        fullWidth
                        label="MAC Address"
                        value={intakeForm.mac_address}
                        onChange={(event) => {
                            setIntakeForm((previous) => ({ ...previous, mac_address: event.target.value, product_id: '' }));
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
                    />

                    {lookupError ? <Alert severity="error">{lookupError}</Alert> : null}

                    {selectedProduct ? (
                        <Paper sx={{ p: 1.75 }}>
                            <Typography variant="subtitle2">Product Preview</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                                Product: {selectedProduct.product_id}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Project: {selectedProduct.project_id}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Warranty expiry: {selectedProduct.warranty_expiry ? toDateInputValue(selectedProduct.warranty_expiry) : 'N/A'}
                            </Typography>
                        </Paper>
                    ) : null}

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
                            setIntakeForm((previous) => ({ ...previous, customer_id: event.target.value }));
                        }}
                        disabled={!selectedProduct}
                    >
                        <MenuItem value="">Select customer</MenuItem>
                        {customerOptions.map((customerId) => (
                            <MenuItem key={customerId} value={customerId}>
                                {customerId}
                            </MenuItem>
                        ))}
                        <MenuItem value="__new__">Add new customer</MenuItem>
                    </Select>

                    {showNewCustomerForm ? (
                        <Stack spacing={1.5}>
                            <TextField fullWidth label="Customer Name" value={intakeForm.customer_name} onChange={(event) => setIntakeForm((previous) => ({ ...previous, customer_name: event.target.value }))} />
                            <TextField
                                fullWidth
                                label="Phone"
                                value={intakeForm.customer_phone}
                                onChange={(event) => {
                                    const phone = event.target.value;
                                    setIntakeForm((previous) => ({ ...previous, customer_phone: phone, customer_id: phone ? `CUST-${phone}` : '' }));
                                }}
                            />
                            <TextField fullWidth label="Email" value={intakeForm.customer_email} onChange={(event) => setIntakeForm((previous) => ({ ...previous, customer_email: event.target.value }))} />
                        </Stack>
                    ) : null}

                    <TextField
                        fullWidth
                        label="Complaint"
                        multiline
                        rows={4}
                        value={intakeForm.complaint}
                        onChange={(event) => setIntakeForm((previous) => ({ ...previous, complaint: event.target.value }))}
                        disabled={!selectedProduct}
                    />

                    <TextField
                        fullWidth
                        type="date"
                        label="Received Date"
                        value={toDateInputValue(intakeForm.received_date)}
                        onChange={(event) => setIntakeForm((previous) => ({ ...previous, received_date: event.target.value }))}
                        InputLabelProps={{ shrink: true }}
                    />

                    <FormControlLabel
                        control={<Switch checked={intakeForm.in_warranty} onChange={(event) => setIntakeForm((previous) => ({ ...previous, in_warranty: event.target.checked }))} />}
                        label="In warranty"
                    />

                    <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
                        <Button variant="outlined" onClick={() => setDrawerOpen(false)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button variant="contained" onClick={() => void handleCreateRepair()} disabled={isSubmitting || !selectedProduct}>
                            {isSubmitting ? 'Saving...' : 'Create Intake'}
                        </Button>
                    </Stack>
                </Stack>
            </ActionDrawer>
        </Box>
    );
};

export default RepairsPage;

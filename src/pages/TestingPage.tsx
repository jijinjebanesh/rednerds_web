import { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Chip,
    Drawer,
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
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material';
import PageHeader from '@/components/PageHeader';
import PageFeedback from '@/components/PageFeedback';
import { productService, testLogService } from '@/services';
import { Product, TestLog } from '@/types';
import { useAppSelector } from '@/hooks/redux';
import { useAppUI } from '@/context/AppUIContext';
import { TEST_RESULT_OPTIONS, toTitle } from '@/utils/workflowOptions';

interface TestFormState {
    mac_address: string;
    station: string;
    result: TestLog['result'];
    symptoms: string;
    notes: string;
}

const defaultForm: TestFormState = {
    mac_address: '',
    station: '',
    result: 'pass',
    symptoms: '',
    notes: '',
};

const getDateBoundary = (range: string): { start: Date; end: Date } | null => {
    const now = new Date();

    if (range === 'today') {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }

    if (range === '7d') {
        const start = new Date(now);
        start.setDate(now.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        return { start, end: now };
    }

    if (range === '30d') {
        const start = new Date(now);
        start.setDate(now.getDate() - 29);
        start.setHours(0, 0, 0, 0);
        return { start, end: now };
    }

    return null;
};

const TestingPage = () => {
    const { user } = useAppSelector((state) => state.auth);
    const { notify } = useAppUI();

    const [testLogs, setTestLogs] = useState<TestLog[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [search, setSearch] = useState('');
    const [resultFilter, setResultFilter] = useState<string>('all');
    const [stationFilter, setStationFilter] = useState<string>('all');
    const [dateRangeFilter, setDateRangeFilter] = useState<'today' | '7d' | '30d' | 'custom'>('7d');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(20);

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [form, setForm] = useState<TestFormState>({ ...defaultForm, station: user?.assigned_station ?? '' });
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [productLookupError, setProductLookupError] = useState<string | null>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [highlightedLogId, setHighlightedLogId] = useState<string | null>(null);

    useEffect(() => {
        void loadTestLogs();
    }, []);

    useEffect(() => {
        if (!highlightedLogId) return;
        const timer = setTimeout(() => setHighlightedLogId(null), 2200);
        return () => clearTimeout(timer);
    }, [highlightedLogId]);

    const loadTestLogs = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await testLogService.getTestLogs(1, 500);
            setTestLogs(response.data);
        } catch (err: any) {
            setError(err?.response?.data?.message || err?.message || 'Failed to load test logs');
        } finally {
            setIsLoading(false);
        }
    };

    const stations = useMemo(() => {
        const values = new Set<string>();
        for (const log of testLogs) {
            if (log.station) values.add(log.station);
        }
        if (user?.assigned_station) values.add(user.assigned_station);
        return Array.from(values).sort();
    }, [testLogs, user?.assigned_station]);

    const filteredLogs = useMemo(() => {
        const term = search.trim().toLowerCase();
        const staticRange = getDateBoundary(dateRangeFilter);

        let startDate: Date | null = staticRange?.start ?? null;
        let endDate: Date | null = staticRange?.end ?? null;

        if (dateRangeFilter === 'custom') {
            startDate = customStart ? new Date(`${customStart}T00:00:00`) : null;
            endDate = customEnd ? new Date(`${customEnd}T23:59:59.999`) : null;
        }

        return testLogs.filter((log) => {
            if (resultFilter !== 'all' && log.result !== resultFilter) return false;
            if (stationFilter !== 'all' && log.station !== stationFilter) return false;

            const testedAt = new Date(log.tested_at);
            if (startDate && testedAt < startDate) return false;
            if (endDate && testedAt > endDate) return false;

            if (!term) return true;
            return (
                log.product_id.toLowerCase().includes(term) ||
                log.mac_address.toLowerCase().includes(term) ||
                log.station.toLowerCase().includes(term)
            );
        });
    }, [testLogs, search, resultFilter, stationFilter, dateRangeFilter, customStart, customEnd]);

    const pagedLogs = useMemo(() => {
        const start = page * rowsPerPage;
        return filteredLogs.slice(start, start + rowsPerPage);
    }, [filteredLogs, page, rowsPerPage]);

    const openDrawer = () => {
        setDrawerOpen(true);
        setForm({ ...defaultForm, station: user?.assigned_station ?? '' });
        setSelectedProduct(null);
        setProductLookupError(null);
    };

    const lookupProductByMac = async () => {
        const mac = form.mac_address.trim().toUpperCase();
        if (!mac) return;

        try {
            setProductLookupError(null);
            const product = await productService.getProductByMac(mac);
            setSelectedProduct(product);
        } catch (err: any) {
            setSelectedProduct(null);
            setProductLookupError(err?.response?.data?.message || 'Product not found for this MAC address.');
        }
    };

    const handleSubmit = async () => {
        if (!selectedProduct) {
            notify({ message: 'Select a valid product by MAC first.', severity: 'warning' });
            return;
        }

        if (!form.station) {
            notify({ message: 'Station is required.', severity: 'warning' });
            return;
        }

        if ((form.result === 'fail' || form.result === 'partial') && !form.symptoms.trim()) {
            notify({ message: 'Symptoms are required for fail or partial results.', severity: 'warning' });
            return;
        }

        try {
            setIsSubmitting(true);
            const created = await testLogService.createTestLog({
                product_id: selectedProduct.product_id,
                mac_address: selectedProduct.mac_address,
                station: form.station,
                operator_id: user?._id ?? 'SYSTEM',
                result: form.result,
                symptoms: form.result === 'pass' ? undefined : form.symptoms.trim(),
                notes: form.notes.trim() || undefined,
            });

            if (form.result === 'pass') {
                await productService.updateProductStage(selectedProduct.product_id, {
                    current_stage: 'qc',
                    status: 'active',
                });
            } else {
                await productService.updateProductStage(selectedProduct.product_id, {
                    current_stage: 'testing',
                    status: 'active',
                });
            }

            setTestLogs((prev) => [created, ...prev]);
            setHighlightedLogId(created._id);
            setDrawerOpen(false);
            notify({ message: 'Test log saved.', severity: 'success' });

            if (form.result !== 'pass') {
                notify({ message: 'Product moved to debugging queue.', severity: 'info' });
            }
        } catch (err: any) {
            notify({ message: err?.response?.data?.message || err?.message || 'Failed to save test log', severity: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Box>
            <PageHeader
                title="Production Testing"
                subtitle="Log functional test outcomes and route failed devices to debugging queue."
                countLabel={`${filteredLogs.length} logs`}
                onRefresh={loadTestLogs}
                isRefreshing={isLoading}
                primaryAction={{
                    label: 'Log Test Result',
                    onClick: openDrawer,
                }}
            />

            <PageFeedback isLoading={isLoading} error={error} />

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr 1fr' }, gap: 1.5, mb: 2 }}>
                <TextField
                    fullWidth
                    placeholder="Search by product ID or MAC"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                />

                <Select fullWidth value={stationFilter} onChange={(event) => setStationFilter(event.target.value)}>
                    <MenuItem value="all">All Stations</MenuItem>
                    {stations.map((station) => (
                        <MenuItem key={station} value={station}>
                            {station}
                        </MenuItem>
                    ))}
                </Select>

                <Select fullWidth value={dateRangeFilter} onChange={(event) => setDateRangeFilter(event.target.value as 'today' | '7d' | '30d' | 'custom')}>
                    <MenuItem value="today">Today</MenuItem>
                    <MenuItem value="7d">Last 7 Days</MenuItem>
                    <MenuItem value="30d">Last 30 Days</MenuItem>
                    <MenuItem value="custom">Custom Range</MenuItem>
                </Select>
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
                <ToggleButtonGroup
                    value={resultFilter}
                    exclusive
                    onChange={(_, nextValue) => {
                        if (!nextValue) return;
                        setResultFilter(nextValue);
                    }}
                    size="small"
                >
                    <ToggleButton value="all">All</ToggleButton>
                    {TEST_RESULT_OPTIONS.map((result) => (
                        <ToggleButton key={result} value={result}>
                            {toTitle(result)}
                        </ToggleButton>
                    ))}
                </ToggleButtonGroup>

                {dateRangeFilter === 'custom' && (
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                        <TextField
                            size="small"
                            type="date"
                            label="Start"
                            value={customStart}
                            onChange={(event) => setCustomStart(event.target.value)}
                            InputLabelProps={{ shrink: true }}
                        />
                        <TextField
                            size="small"
                            type="date"
                            label="End"
                            value={customEnd}
                            onChange={(event) => setCustomEnd(event.target.value)}
                            InputLabelProps={{ shrink: true }}
                        />
                    </Stack>
                )}
            </Stack>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Product</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>MAC</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Station</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Result</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Symptoms</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Tested At</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {pagedLogs.length === 0 && !isLoading && (
                            <TableRow>
                                <TableCell colSpan={6} sx={{ py: 3 }}>
                                    <Typography color="text.secondary">No test results found.</Typography>
                                </TableCell>
                            </TableRow>
                        )}

                        {pagedLogs.map((log) => (
                            <TableRow
                                key={log._id}
                                hover
                                sx={{
                                    bgcolor: highlightedLogId === log._id ? 'rgba(46, 125, 50, 0.12)' : undefined,
                                    transition: 'background-color 350ms ease',
                                }}
                            >
                                <TableCell>{log.product_id}</TableCell>
                                <TableCell>{log.mac_address}</TableCell>
                                <TableCell>{log.station}</TableCell>
                                <TableCell>
                                    <Chip
                                        label={toTitle(log.result)}
                                        color={log.result === 'pass' ? 'success' : log.result === 'partial' ? 'warning' : 'error'}
                                        size="small"
                                    />
                                </TableCell>
                                <TableCell>{log.symptoms || '-'}</TableCell>
                                <TableCell>{new Date(log.tested_at).toLocaleString()}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                <TablePagination
                    component="div"
                    count={filteredLogs.length}
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
                        Log Test Result
                    </Typography>

                    <TextField
                        fullWidth
                        label="MAC Address"
                        value={form.mac_address}
                        onChange={(event) => {
                            setForm((prev) => ({ ...prev, mac_address: event.target.value }));
                            setSelectedProduct(null);
                            setProductLookupError(null);
                        }}
                        onBlur={lookupProductByMac}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                void lookupProductByMac();
                            }
                        }}
                        placeholder="A0:B7:65:00:00:1A"
                        sx={{ mt: 1 }}
                    />

                    {productLookupError && (
                        <Alert severity="error" sx={{ mt: 1.5 }}>
                            {productLookupError}
                        </Alert>
                    )}

                    {selectedProduct && (
                        <Paper variant="outlined" sx={{ mt: 1.5, p: 1.5 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                                Product Preview
                            </Typography>
                            <Typography variant="body2">Product: {selectedProduct.product_id}</Typography>
                            <Typography variant="body2">Batch: {selectedProduct.batch_id}</Typography>
                            <Typography variant="body2">Project: {selectedProduct.project_id}</Typography>
                            <Typography variant="body2">Stage: {toTitle(selectedProduct.current_stage)}</Typography>
                        </Paper>
                    )}

                    {selectedProduct && selectedProduct.current_stage !== 'testing' && (
                        <Alert severity="warning" sx={{ mt: 1.5 }}>
                            This product is currently in stage: {toTitle(selectedProduct.current_stage)}. Continue only if this is intended.
                        </Alert>
                    )}

                    <Select
                        fullWidth
                        value={form.station}
                        onChange={(event) => setForm((prev) => ({ ...prev, station: event.target.value }))}
                        sx={{ mt: 2 }}
                        disabled={!selectedProduct}
                    >
                        <MenuItem value="">Select Station</MenuItem>
                        {stations.map((station) => (
                            <MenuItem key={station} value={station}>
                                {station}
                            </MenuItem>
                        ))}
                    </Select>

                    <Select
                        fullWidth
                        value={form.result}
                        onChange={(event) => setForm((prev) => ({ ...prev, result: event.target.value as TestLog['result'] }))}
                        sx={{ mt: 2 }}
                        disabled={!selectedProduct}
                    >
                        {TEST_RESULT_OPTIONS.map((result) => (
                            <MenuItem key={result} value={result}>
                                {toTitle(result)}
                            </MenuItem>
                        ))}
                    </Select>

                    {(form.result === 'fail' || form.result === 'partial') && (
                        <TextField
                            fullWidth
                            label="Symptoms"
                            multiline
                            rows={3}
                            required
                            value={form.symptoms}
                            onChange={(event) => setForm((prev) => ({ ...prev, symptoms: event.target.value }))}
                            sx={{ mt: 2 }}
                            disabled={!selectedProduct}
                        />
                    )}

                    <TextField
                        fullWidth
                        label="Notes"
                        multiline
                        rows={3}
                        value={form.notes}
                        onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                        sx={{ mt: 2 }}
                        disabled={!selectedProduct}
                    />

                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
                        <Button onClick={() => setDrawerOpen(false)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button variant="contained" onClick={handleSubmit} disabled={isSubmitting || !selectedProduct}>
                            {isSubmitting ? 'Saving...' : 'Save Test Log'}
                        </Button>
                    </Box>
                </Box>
            </Drawer>
        </Box>
    );
};

export default TestingPage;


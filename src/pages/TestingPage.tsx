import { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Autocomplete,
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
import { debugSessionService, productService, testLogService, userService } from '@/services';
import { DebugSession, Product, TestLog } from '@/types';
import { useAppSelector } from '@/hooks/redux';
import { useAppUI } from '@/context/AppUIContext';
import { TEST_RESULT_OPTIONS, toTitle } from '@/utils/workflowOptions';
import { hasPermission } from '@/utils/rbac';

interface TestFormState {
    station: string;
    result: TestLog['result'];
    symptoms: string;
    notes: string;
}

type QueueSource = 'fresh' | 'retest';

const defaultForm: TestFormState = {
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
    const canWriteTestLogs =
        hasPermission(user?.role, 'testing.create') || hasPermission(user?.role, 'testing.update');

    const [testLogs, setTestLogs] = useState<TestLog[]>([]);
    const [testingProducts, setTestingProducts] = useState<Product[]>([]);
    const [debugSessions, setDebugSessions] = useState<DebugSession[]>([]);
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
    const [selectedSource, setSelectedSource] = useState<QueueSource>('fresh');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [highlightedLogId, setHighlightedLogId] = useState<string | null>(null);
    const [configuredStations, setConfiguredStations] = useState<string[]>([]);

    useEffect(() => {
        void loadTestingData();
    }, []);

    useEffect(() => {
        let mounted = true;

        const loadConfiguredStations = async () => {
            try {
                const users = await userService.getUsers();
                if (!mounted) return;

                const stationsFromUsers = Array.from(
                    new Set(
                        users
                            .map((entry) => (entry.assigned_station ?? '').trim())
                            .filter(Boolean)
                    )
                ).sort();

                setConfiguredStations(stationsFromUsers);
            } catch {
                if (mounted) {
                    setConfiguredStations([]);
                }
            }
        };

        void loadConfiguredStations();

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        if (!highlightedLogId) return;
        const timer = setTimeout(() => setHighlightedLogId(null), 2200);
        return () => clearTimeout(timer);
    }, [highlightedLogId]);

    const loadTestingData = async () => {
        try {
            setIsLoading(true);
            setError(null);

            const [logsRes, productsRes, debugRes] = await Promise.all([
                testLogService.getTestLogs(1, 1000),
                productService.getProducts(1, 1000, { current_stage: 'testing' }),
                debugSessionService.getDebugSessions(1, 1000),
            ]);

            setTestLogs(logsRes.data);
            setTestingProducts(productsRes.data);
            setDebugSessions(debugRes.data);
        } catch (err: any) {
            setError(err?.response?.data?.message || err?.message || 'Failed to load testing data');
        } finally {
            setIsLoading(false);
        }
    };

    const latestTestByProduct = useMemo(() => {
        const map = new Map<string, TestLog>();
        for (const log of testLogs) {
            const existing = map.get(log.product_id);
            if (!existing || new Date(log.tested_at).getTime() > new Date(existing.tested_at).getTime()) {
                map.set(log.product_id, log);
            }
        }
        return map;
    }, [testLogs]);

    const latestDebugByProduct = useMemo(() => {
        const map = new Map<string, DebugSession>();
        for (const session of debugSessions) {
            const existing = map.get(session.product_id);
            if (!existing || new Date(session.debugged_at).getTime() > new Date(existing.debugged_at).getTime()) {
                map.set(session.product_id, session);
            }
        }
        return map;
    }, [debugSessions]);

    const retestProductIds = useMemo(() => {
        const ids = new Set<string>();

        for (const product of testingProducts) {
            const latestDebug = latestDebugByProduct.get(product.product_id);
            if (!latestDebug || !latestDebug.re_test_required) continue;

            const latestTest = latestTestByProduct.get(product.product_id);
            if (!latestTest || new Date(latestDebug.debugged_at).getTime() > new Date(latestTest.tested_at).getTime()) {
                ids.add(product.product_id);
            }
        }

        return ids;
    }, [latestDebugByProduct, latestTestByProduct, testingProducts]);

    const freshQueue = useMemo(() => {
        return testingProducts.filter((product) => {
            if (retestProductIds.has(product.product_id)) return false;
            return !latestTestByProduct.has(product.product_id);
        });
    }, [latestTestByProduct, retestProductIds, testingProducts]);

    const retestQueue = useMemo(() => {
        return testingProducts.filter((product) => retestProductIds.has(product.product_id));
    }, [retestProductIds, testingProducts]);

    const stations = useMemo(() => {
        const values = new Set<string>();
        for (const station of configuredStations) {
            if (station) values.add(station);
        }
        for (const log of testLogs) {
            if (log.station) values.add(log.station);
        }
        if (user?.assigned_station) values.add(user.assigned_station);
        return Array.from(values).sort();
    }, [configuredStations, testLogs, user?.assigned_station]);

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

    const queueSearch = search.trim().toLowerCase();

    const filteredFreshQueue = useMemo(() => {
        if (!queueSearch) return freshQueue;
        return freshQueue.filter((product) => {
            return (
                product.product_id.toLowerCase().includes(queueSearch) ||
                product.mac_address.toLowerCase().includes(queueSearch) ||
                product.batch_id.toLowerCase().includes(queueSearch) ||
                product.project_id.toLowerCase().includes(queueSearch)
            );
        });
    }, [freshQueue, queueSearch]);

    const filteredRetestQueue = useMemo(() => {
        if (!queueSearch) return retestQueue;
        return retestQueue.filter((product) => {
            return (
                product.product_id.toLowerCase().includes(queueSearch) ||
                product.mac_address.toLowerCase().includes(queueSearch) ||
                product.batch_id.toLowerCase().includes(queueSearch) ||
                product.project_id.toLowerCase().includes(queueSearch)
            );
        });
    }, [retestQueue, queueSearch]);

    const openDrawerForProduct = (product: Product, source: QueueSource) => {
        if (!canWriteTestLogs) {
            notify({ message: 'You do not have permission to log test results.', severity: 'error' });
            return;
        }

        const defaultStation = (user?.assigned_station ?? '').trim() || configuredStations[0] || '';
        setSelectedProduct(product);
        setSelectedSource(source);
        setForm({ ...defaultForm, station: defaultStation });
        setDrawerOpen(true);
    };

    const handleSubmit = async () => {
        if (!canWriteTestLogs) {
            notify({ message: 'You do not have permission to log test results.', severity: 'error' });
            return;
        }

        if (!selectedProduct) {
            notify({ message: 'Select a product from the queue first.', severity: 'warning' });
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
                    status: 'repair',
                });
            }

            await loadTestingData();
            setHighlightedLogId(created._id);
            setDrawerOpen(false);
            notify({ message: 'Test log saved and product status updated.', severity: 'success' });

            if (form.result !== 'pass') {
                notify({ message: 'Product moved out of pending test queue for debugging review.', severity: 'info' });
            }
        } catch (err: any) {
            notify({ message: err?.response?.data?.message || err?.message || 'Failed to save test log', severity: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const pendingCount = filteredFreshQueue.length + filteredRetestQueue.length;
    const selectedLatestDebug = selectedProduct ? latestDebugByProduct.get(selectedProduct.product_id) ?? null : null;

    return (
        <Box>
            <PageHeader
                title="Production Testing"
                subtitle="Click a product from queue, log result, and product stage/status will update automatically."
                countLabel={`${pendingCount} pending (${filteredFreshQueue.length} fresh, ${filteredRetestQueue.length} re-test)`}
                onRefresh={loadTestingData}
                isRefreshing={isLoading}
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

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' }, gap: 2, mb: 2 }}>
                <TableContainer component={Paper}>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 'bold' }}>Yet To Be Tested ({filteredFreshQueue.length})</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>MAC</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>Batch</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>Action</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredFreshQueue.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4}>
                                        <Typography variant="body2" color="text.secondary">
                                            No untested products in testing stage.
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                            {filteredFreshQueue.map((product) => (
                                <TableRow key={`fresh-${product.product_id}`} hover onClick={() => openDrawerForProduct(product, 'fresh')} sx={{ cursor: 'pointer' }}>
                                    <TableCell>{product.product_id}</TableCell>
                                    <TableCell>{product.mac_address}</TableCell>
                                    <TableCell>{product.batch_id}</TableCell>
                                    <TableCell onClick={(event) => event.stopPropagation()}>
                                        <Button size="small" variant="contained" onClick={() => openDrawerForProduct(product, 'fresh')} disabled={!canWriteTestLogs}>
                                            Log Test
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>

                <TableContainer component={Paper}>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 'bold' }}>From Debugging (Re-test) ({filteredRetestQueue.length})</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>MAC</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>Last Debug</TableCell>
                                <TableCell sx={{ fontWeight: 'bold' }}>Action</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredRetestQueue.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4}>
                                        <Typography variant="body2" color="text.secondary">
                                            No re-test products returned from debugging.
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                            {filteredRetestQueue.map((product) => {
                                const latestDebug = latestDebugByProduct.get(product.product_id);
                                return (
                                    <TableRow
                                        key={`retest-${product.product_id}`}
                                        hover
                                        onClick={() => openDrawerForProduct(product, 'retest')}
                                        sx={{ cursor: 'pointer', borderLeft: '4px solid #ed6c02' }}
                                    >
                                        <TableCell>{product.product_id}</TableCell>
                                        <TableCell>{product.mac_address}</TableCell>
                                        <TableCell>{latestDebug ? new Date(latestDebug.debugged_at).toLocaleString() : '-'}</TableCell>
                                        <TableCell onClick={(event) => event.stopPropagation()}>
                                            <Button size="small" variant="contained" color="warning" onClick={() => openDrawerForProduct(product, 'retest')} disabled={!canWriteTestLogs}>
                                                Re-test
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
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
                        {selectedSource === 'retest' ? 'Log Re-test Result' : 'Log Test Result'}
                    </Typography>

                    {selectedProduct && (
                        <Paper variant="outlined" sx={{ mt: 1.5, p: 1.5 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                                Product
                            </Typography>
                            <Typography variant="body2">Product: {selectedProduct.product_id}</Typography>
                            <Typography variant="body2">MAC: {selectedProduct.mac_address}</Typography>
                            <Typography variant="body2">Batch: {selectedProduct.batch_id}</Typography>
                            <Typography variant="body2">Project: {selectedProduct.project_id}</Typography>
                            <Typography variant="body2">Current Status: {toTitle(selectedProduct.status)}</Typography>
                        </Paper>
                    )}

                    {selectedSource === 'retest' && selectedLatestDebug && (
                        <Alert severity="info" sx={{ mt: 1.5 }}>
                            Returned from debugging on {new Date(selectedLatestDebug.debugged_at).toLocaleString()}.
                        </Alert>
                    )}

                    <Autocomplete
                        freeSolo
                        options={stations}
                        value={form.station}
                        onChange={(_, value) => setForm((prev) => ({ ...prev, station: (value ?? '').trim() }))}
                        onInputChange={(_, value) => setForm((prev) => ({ ...prev, station: value.trimStart() }))}
                        sx={{ mt: 2 }}
                        renderInput={(params) => <TextField {...params} label="Select or Enter Station" />}
                    />

                    <Select fullWidth value={form.result} onChange={(event) => setForm((prev) => ({ ...prev, result: event.target.value as TestLog['result'] }))} sx={{ mt: 2 }}>
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

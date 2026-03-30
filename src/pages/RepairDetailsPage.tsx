import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Divider,
    MenuItem,
    Paper,
    Select,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import PageHeader from '@/components/PageHeader';
import PageFeedback from '@/components/PageFeedback';
import { customerRepairService, productService, repairSessionService } from '@/services';
import { CreateRepairSessionForm } from '@/services/repairs';
import { CustomerRepair, Product, RepairSession } from '@/types';
import { useAppSelector } from '@/hooks/redux';
import { useAppUI } from '@/context/AppUIContext';
import { REPAIR_SESSION_RESOLUTION_OPTIONS, toTitle } from '@/utils/workflowOptions';

interface SessionFormState {
    issue_identified: string;
    root_cause: string;
    action_taken: string;
    parts_replaced_text: string;
    resolution_status: RepairSession['resolution_status'];
}

const defaultSessionForm: SessionFormState = {
    issue_identified: '',
    root_cause: '',
    action_taken: '',
    parts_replaced_text: '',
    resolution_status: 'unresolved',
};

const RepairDetailsPage = () => {
    const { repairId } = useParams<{ repairId: string }>();
    const { user } = useAppSelector((state) => state.auth);
    const { notify } = useAppUI();

    const [repair, setRepair] = useState<CustomerRepair | null>(null);
    const [product, setProduct] = useState<Product | null>(null);
    const [sessions, setSessions] = useState<RepairSession[]>([]);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [form, setForm] = useState<SessionFormState>(defaultSessionForm);

    useEffect(() => {
        if (repairId) {
            void loadDetails();
        }
    }, [repairId]);

    const loadDetails = async () => {
        if (!repairId) return;

        try {
            setIsLoading(true);
            setError(null);

            const repairData = await customerRepairService.getRepairById(repairId);
            setRepair(repairData);

            const [sessionsRes, productData] = await Promise.all([
                repairSessionService.getRepairSessionsByRepair(repairId, 1, 500),
                productService.getProductById(repairData.product_id).catch(() => null),
            ]);

            setSessions(
                sessionsRes.data
                    .slice()
                    .sort((a, b) => new Date(b.sessioned_at).getTime() - new Date(a.sessioned_at).getTime())
            );
            setProduct(productData);
        } catch (err: any) {
            setError(err?.response?.data?.message || err?.message || 'Failed to load repair details');
        } finally {
            setIsLoading(false);
        }
    };

    const latestSession = sessions.length > 0 ? sessions[0] : null;

    const canReturnToCustomer = useMemo(() => {
        if (!repair) return false;
        if (repair.status === 'returned_to_customer') return false;
        return latestSession?.resolution_status === 'resolved';
    }, [latestSession, repair]);

    const updateRepairStatus = async (status: CustomerRepair['status']) => {
        if (!repair) return;

        try {
            setIsLoading(true);
            const updated = await customerRepairService.updateRepairStatus(repair._id, status);
            setRepair(updated);
            notify({ message: `Repair status updated to ${toTitle(status)}.`, severity: 'success' });

            if (product && status === 'returned_to_customer') {
                await productService.updateProductStage(product.product_id, {
                    current_stage: 'stock',
                    status: 'active',
                });
            }
        } catch (err: any) {
            notify({ message: err?.response?.data?.message || err?.message || 'Failed to update repair status', severity: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddSession = async () => {
        if (!repair) return;

        if (!form.issue_identified.trim() || !form.root_cause.trim() || !form.action_taken.trim()) {
            notify({ message: 'Issue identified, root cause, and action taken are required.', severity: 'warning' });
            return;
        }

        try {
            setIsSubmitting(true);

            const payload: CreateRepairSessionForm = {
                repair_id: repair._id,
                product_id: repair.product_id,
                issue_identified: form.issue_identified.trim(),
                root_cause: form.root_cause.trim(),
                action_taken: form.action_taken.trim(),
                parts_replaced: form.parts_replaced_text
                    .split(',')
                    .map((part) => part.trim())
                    .filter(Boolean),
                resolution_status: form.resolution_status,
                technician_id: user?._id ?? 'SYSTEM',
            };

            await repairSessionService.createRepairSession(payload);

            if (repair.status === 'received') {
                await customerRepairService.updateRepairStatus(repair._id, 'in_progress');
            }

            if (payload.resolution_status === 'resolved' && repair.status !== 'returned_to_customer') {
                await customerRepairService.updateRepairStatus(repair._id, 'resolved');
            }

            notify({ message: 'Repair session added.', severity: 'success' });
            setForm(defaultSessionForm);
            await loadDetails();
        } catch (err: any) {
            notify({ message: err?.response?.data?.message || err?.message || 'Failed to add repair session', severity: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Box>
            <PageHeader
                title={repair ? `Repair ${repair._id}` : 'Repair Case Details'}
                subtitle={repair ? `Product ${repair.product_id} • ${toTitle(repair.status)}` : 'View complaint, sessions, and closure actions.'}
                onRefresh={loadDetails}
                isRefreshing={isLoading}
            />

            <PageFeedback isLoading={isLoading} error={error} />

            {repair && (
                <Stack spacing={2}>
                    <Card>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                                <Box>
                                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                        Complaint
                                    </Typography>
                                    <Typography sx={{ mt: 0.5 }}>{repair.complaint}</Typography>
                                </Box>

                                <Stack direction="row" spacing={1} alignItems="flex-start">
                                    <Chip label={toTitle(repair.status)} />
                                    <Chip label={repair.in_warranty ? 'In Warranty' : 'Out of Warranty'} color={repair.in_warranty ? 'success' : 'error'} />
                                </Stack>
                            </Box>

                            <Divider sx={{ my: 2 }} />

                            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
                                <Box>
                                    <Typography color="text.secondary">Customer ID</Typography>
                                    <Typography sx={{ fontWeight: 700 }}>{repair.customer_id}</Typography>
                                </Box>
                                <Box>
                                    <Typography color="text.secondary">Received</Typography>
                                    <Typography sx={{ fontWeight: 700 }}>{new Date(repair.received_date).toLocaleString()}</Typography>
                                </Box>
                                <Box>
                                    <Typography color="text.secondary">Closed</Typography>
                                    <Typography sx={{ fontWeight: 700 }}>{repair.closed_date ? new Date(repair.closed_date).toLocaleString() : '-'}</Typography>
                                </Box>
                            </Box>

                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }}>
                                <Button variant="outlined" onClick={() => void updateRepairStatus('in_progress')} disabled={repair.status !== 'received'}>
                                    Mark In Progress
                                </Button>
                                <Button variant="outlined" color="error" onClick={() => void updateRepairStatus('unrepairable')}>
                                    Mark Unrepairable
                                </Button>
                                <Button
                                    variant="contained"
                                    onClick={() => void updateRepairStatus('returned_to_customer')}
                                    disabled={!canReturnToCustomer}
                                >
                                    Return To Customer
                                </Button>
                            </Stack>
                        </CardContent>
                    </Card>

                    <Paper sx={{ p: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                            Repair Sessions
                        </Typography>

                        {sessions.length === 0 ? (
                            <Typography color="text.secondary">No repair sessions added yet.</Typography>
                        ) : (
                            <Stack spacing={1.5}>
                                {sessions.map((session) => (
                                    <Paper key={session._id} variant="outlined" sx={{ p: 1.5 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                                            <Typography sx={{ fontWeight: 700 }}>{session.issue_identified}</Typography>
                                            <Chip label={toTitle(session.resolution_status)} size="small" />
                                        </Box>

                                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                                            Root Cause: {session.root_cause}
                                        </Typography>
                                        <Typography variant="body2">Action: {session.action_taken}</Typography>
                                        <Typography variant="body2">Technician: {session.technician_id}</Typography>
                                        <Typography variant="body2">Time: {new Date(session.sessioned_at).toLocaleString()}</Typography>

                                        {session.parts_replaced.length > 0 && (
                                            <Stack direction="row" spacing={0.75} sx={{ mt: 1, flexWrap: 'wrap' }}>
                                                {session.parts_replaced.map((part, index) => (
                                                    <Chip key={`${session._id}-part-${index}`} label={part} size="small" variant="outlined" />
                                                ))}
                                            </Stack>
                                        )}
                                    </Paper>
                                ))}
                            </Stack>
                        )}
                    </Paper>

                    <Paper sx={{ p: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                            Add Session
                        </Typography>

                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
                            <TextField
                                fullWidth
                                label="Issue Identified"
                                value={form.issue_identified}
                                onChange={(event) => setForm((prev) => ({ ...prev, issue_identified: event.target.value }))}
                            />

                            <TextField
                                fullWidth
                                label="Root Cause"
                                value={form.root_cause}
                                onChange={(event) => setForm((prev) => ({ ...prev, root_cause: event.target.value }))}
                            />
                        </Box>

                        <TextField
                            fullWidth
                            multiline
                            rows={3}
                            label="Action Taken"
                            value={form.action_taken}
                            onChange={(event) => setForm((prev) => ({ ...prev, action_taken: event.target.value }))}
                            sx={{ mt: 1.5 }}
                        />

                        <TextField
                            fullWidth
                            label="Parts Replaced (comma separated)"
                            value={form.parts_replaced_text}
                            onChange={(event) => setForm((prev) => ({ ...prev, parts_replaced_text: event.target.value }))}
                            sx={{ mt: 1.5 }}
                        />

                        <Select
                            fullWidth
                            value={form.resolution_status}
                            onChange={(event) => setForm((prev) => ({ ...prev, resolution_status: event.target.value as RepairSession['resolution_status'] }))}
                            sx={{ mt: 1.5 }}
                        >
                            {REPAIR_SESSION_RESOLUTION_OPTIONS.map((status) => (
                                <MenuItem key={status} value={status}>
                                    {toTitle(status)}
                                </MenuItem>
                            ))}
                        </Select>

                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.5 }}>
                            <Button variant="contained" onClick={handleAddSession} disabled={isSubmitting}>
                                {isSubmitting ? 'Saving...' : 'Add Session'}
                            </Button>
                        </Box>
                    </Paper>
                </Stack>
            )}
        </Box>
    );
};

export default RepairDetailsPage;

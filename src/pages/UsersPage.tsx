import { useEffect, useMemo, useState } from 'react';
import {
    Box,
    Button,
    FormControlLabel,
    MenuItem,
    Select,
    Stack,
    Switch,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import { MailPlus, ShieldCheck, UserCog } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import PageFeedback from '@/components/PageFeedback';
import { userService } from '@/services';
import { AppUser } from '@/services/users';
import ActionDrawer from '@/components/ui/ActionDrawer';
import EmptyState from '@/components/ui/EmptyState';
import StatusChip from '@/components/ui/StatusChip';
import { useAppUI } from '@/context/AppUIContext';
import { USER_ROLE_OPTIONS, toTitle } from '@/utils/workflowOptions';

interface EditUserState {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    assigned_station: string;
    is_active: boolean;
}

interface NewUserState {
    name: string;
    email: string;
    phone: string;
    password: string;
    role: string;
    assigned_station: string;
    is_active: boolean;
}

const emptyEditState: EditUserState = {
    id: '',
    name: '',
    email: '',
    phone: '',
    role: 'user',
    assigned_station: '',
    is_active: true,
};

const generatePassword = (length = 12) => {
    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let result = '';
    for (let i = 0; i < length; i += 1) {
        result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return result;
};

const createInitialUserState = (): NewUserState => ({
    name: '',
    email: '',
    phone: '',
    password: generatePassword(),
    role: 'user',
    assigned_station: '',
    is_active: true,
});

const UsersPage = () => {
    const { notify, confirm } = useAppUI();

    const [users, setUsers] = useState<AppUser[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    const [editOpen, setEditOpen] = useState(false);
    const [editState, setEditState] = useState<EditUserState>(emptyEditState);

    const [createOpen, setCreateOpen] = useState(false);
    const [createState, setCreateState] = useState<NewUserState>(createInitialUserState());

    useEffect(() => {
        void loadUsers();
    }, []);

    const loadUsers = async (): Promise<AppUser[]> => {
        try {
            setIsLoading(true);
            setError(null);
            const data = await userService.getUsers();
            setUsers(data);
            return data;
        } catch (err: any) {
            setError(err?.response?.data?.message || err?.message || 'Failed to load users');
            return [];
        } finally {
            setIsLoading(false);
        }
    };

    const filteredUsers = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return users;

        return users.filter((user) => {
            return (
                user.name.toLowerCase().includes(term) ||
                user.email.toLowerCase().includes(term) ||
                (user.phone ?? '').toLowerCase().includes(term) ||
                (user.role ?? '').toLowerCase().includes(term)
            );
        });
    }, [users, search]);

    const openEditDrawer = (user: AppUser) => {
        setEditState({
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone ?? '',
            role: user.role ?? 'user',
            assigned_station: user.assigned_station ?? '',
            is_active: (user.status ?? 'active') === 'active',
        });
        setEditOpen(true);
    };

    const handleCreateUser = async () => {
        if (!createState.name.trim() || !createState.email.trim() || !createState.phone.trim()) {
            notify({ message: 'Name, email, and phone are required.', severity: 'warning' });
            return;
        }

        const needsAssignedStation = createState.role === 'test_operator' || createState.role === 'flash_operator';
        const assignedStation = createState.assigned_station.trim();
        if (needsAssignedStation && !assignedStation) {
            notify({ message: 'Assigned station is required for this role.', severity: 'warning' });
            return;
        }

        try {
            setIsLoading(true);

            await userService.createUser({
                name: createState.name.trim(),
                email: createState.email.trim(),
                phone: createState.phone.trim(),
                password: createState.password,
                role: createState.role,
                assigned_station: assignedStation || null,
            });

            if (!createState.is_active) {
                const refreshed = await loadUsers();
                const createdUser = refreshed.find((user) => user.email.toLowerCase() === createState.email.trim().toLowerCase());
                if (createdUser) {
                    await userService.updateUser(createdUser.id, {
                        status: 'deactive',
                    } as any);
                    await loadUsers();
                }
            } else {
                await loadUsers();
            }

            notify({ message: 'User created successfully.', severity: 'success' });
            setCreateOpen(false);
        } catch (err: any) {
            notify({ message: err?.response?.data?.message || err?.message || 'Failed to create user', severity: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveUser = async () => {
        try {
            setIsLoading(true);
            await userService.updateUser(editState.id, {
                id: editState.id,
                name: editState.name,
                email: editState.email,
                phone: editState.phone,
                role: editState.role,
                status: editState.is_active ? 'active' : 'deactive',
                assigned_station: editState.assigned_station,
            } as any);

            notify({ message: 'User updated successfully.', severity: 'success' });
            setEditOpen(false);
            await loadUsers();
        } catch (err: any) {
            notify({ message: err?.response?.data?.message || err?.message || 'Failed to update user', severity: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeactivate = async (user: AppUser) => {
        const approved = await confirm({
            title: 'Deactivate User',
            message: `Deactivate ${user.name}? They will lose access until reactivated.`,
            confirmText: 'Deactivate',
            tone: 'error',
        });

        if (!approved) return;

        try {
            setIsLoading(true);
            await userService.deleteUser(user.id);
            notify({ message: 'User deactivated.', severity: 'success' });
            await loadUsers();
        } catch (err: any) {
            notify({ message: err?.response?.data?.message || err?.message || 'Failed to deactivate user', severity: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Box>
            <PageHeader
                title="User Management"
                subtitle="Admin-only controls for invitations, role assignment, station mapping, and activation state."
                countLabel={`${filteredUsers.length} users`}
                onRefresh={loadUsers}
                isRefreshing={isLoading}
                primaryAction={{ label: 'Invite User', onClick: () => setCreateOpen(true) }}
            />

            <PageFeedback isLoading={isLoading} error={error} />

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2.5 }}>
                <TextField
                    fullWidth
                    placeholder="Search by name, email, phone, or role"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                />

                <Button variant="outlined" startIcon={<UserCog size={16} />} onClick={() => setCreateOpen(true)}>
                    New account
                </Button>
            </Stack>

            {filteredUsers.length === 0 && !isLoading ? (
                <EmptyState
                    icon={<ShieldCheck size={24} />}
                    title="No users found"
                    description="Invite the first operational user to start role-based access across testing, debugging, QC, and administration."
                    action={{ label: 'Invite user', onClick: () => setCreateOpen(true) }}
                />
            ) : (
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Name</TableCell>
                                <TableCell>Email</TableCell>
                                <TableCell>Role</TableCell>
                                <TableCell>Assigned Station</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Last Login</TableCell>
                                <TableCell align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredUsers.map((user) => {
                                const active = (user.status ?? 'active') === 'active';
                                return (
                                    <TableRow key={user.id} hover>
                                        <TableCell>
                                            <Typography variant="subtitle2">{user.name}</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {user.phone || 'No phone'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>
                                            <StatusChip value={user.role ?? 'user'} />
                                        </TableCell>
                                        <TableCell>{user.assigned_station ?? '-'}</TableCell>
                                        <TableCell>
                                            <StatusChip value={active ? 'active' : 'inactive'} label={active ? 'Active' : 'Inactive'} />
                                        </TableCell>
                                        <TableCell>{user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}</TableCell>
                                        <TableCell align="right">
                                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                                                <Button size="small" variant="outlined" onClick={() => openEditDrawer(user)}>
                                                    Edit
                                                </Button>
                                                <Button size="small" color="error" variant="text" onClick={() => void handleDeactivate(user)} disabled={!active}>
                                                    Deactivate
                                                </Button>
                                            </Stack>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            <ActionDrawer
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                title="Invite User"
                subtitle="Create a login, assign the correct role, and optionally bind an operating station."
            >
                <Stack spacing={2}>
                    <TextField fullWidth label="Name" value={createState.name} onChange={(event) => setCreateState((previous) => ({ ...previous, name: event.target.value }))} />
                    <TextField fullWidth label="Email" value={createState.email} onChange={(event) => setCreateState((previous) => ({ ...previous, email: event.target.value }))} />
                    <TextField fullWidth label="Phone" value={createState.phone} onChange={(event) => setCreateState((previous) => ({ ...previous, phone: event.target.value }))} />
                    <TextField
                        fullWidth
                        label="Temporary Password"
                        value={createState.password}
                        onChange={(event) => setCreateState((previous) => ({ ...previous, password: event.target.value }))}
                        helperText="Share this securely with the user after creation."
                    />
                    <Select fullWidth value={createState.role} onChange={(event) => setCreateState((previous) => ({ ...previous, role: event.target.value }))}>
                        {USER_ROLE_OPTIONS.map((role) => (
                            <MenuItem key={role} value={role}>
                                {toTitle(role)}
                            </MenuItem>
                        ))}
                    </Select>
                    {(createState.role === 'test_operator' || createState.role === 'flash_operator') ? (
                        <TextField
                            fullWidth
                            label="Assigned Station"
                            value={createState.assigned_station}
                            onChange={(event) => setCreateState((previous) => ({ ...previous, assigned_station: event.target.value }))}
                        />
                    ) : null}
                    <FormControlLabel
                        control={<Switch checked={createState.is_active} onChange={(event) => setCreateState((previous) => ({ ...previous, is_active: event.target.checked }))} />}
                        label="User active immediately"
                    />
                    <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
                        <Button variant="outlined" onClick={() => setCreateOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="contained" startIcon={<MailPlus size={16} />} onClick={() => void handleCreateUser()} disabled={isLoading}>
                            Invite user
                        </Button>
                    </Stack>
                </Stack>
            </ActionDrawer>

            <ActionDrawer
                open={editOpen}
                onClose={() => setEditOpen(false)}
                title="Edit User"
                subtitle="Update role, station assignment, and account activation without affecting the route structure."
            >
                <Stack spacing={2}>
                    <TextField fullWidth label="Name" value={editState.name} onChange={(event) => setEditState((previous) => ({ ...previous, name: event.target.value }))} />
                    <TextField fullWidth label="Email" value={editState.email} onChange={(event) => setEditState((previous) => ({ ...previous, email: event.target.value }))} />
                    <TextField fullWidth label="Phone" value={editState.phone} onChange={(event) => setEditState((previous) => ({ ...previous, phone: event.target.value }))} />
                    <Select fullWidth value={editState.role} onChange={(event) => setEditState((previous) => ({ ...previous, role: event.target.value }))}>
                        {USER_ROLE_OPTIONS.map((role) => (
                            <MenuItem key={role} value={role}>
                                {toTitle(role)}
                            </MenuItem>
                        ))}
                    </Select>
                    {(editState.role === 'test_operator' || editState.role === 'flash_operator') ? (
                        <TextField
                            fullWidth
                            label="Assigned Station"
                            value={editState.assigned_station}
                            onChange={(event) => setEditState((previous) => ({ ...previous, assigned_station: event.target.value }))}
                        />
                    ) : null}
                    <FormControlLabel
                        control={<Switch checked={editState.is_active} onChange={(event) => setEditState((previous) => ({ ...previous, is_active: event.target.checked }))} />}
                        label="User active"
                    />
                    <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
                        <Button variant="outlined" onClick={() => setEditOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="contained" onClick={() => void handleSaveUser()} disabled={isLoading}>
                            Save Changes
                        </Button>
                    </Stack>
                </Stack>
            </ActionDrawer>
        </Box>
    );
};

export default UsersPage;

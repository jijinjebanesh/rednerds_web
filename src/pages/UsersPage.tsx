import { useEffect, useMemo, useState } from 'react';
import {
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    MenuItem,
    Paper,
    Select,
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
import PageHeader from '@/components/PageHeader';
import PageFeedback from '@/components/PageFeedback';
import { userService } from '@/services';
import { AppUser } from '@/services/users';
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

    const openEditDialog = (user: AppUser) => {
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

    const openCreateDialog = () => {
        setCreateState(createInitialUserState());
        setCreateOpen(true);
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
            message: `Deactivate ${user.name}?`,
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
                subtitle="Admin-only controls for user profile, role assignment, station mapping, and activation state."
                countLabel={`${filteredUsers.length} users`}
                onRefresh={loadUsers}
                isRefreshing={isLoading}
                primaryAction={{
                    label: 'New User',
                    onClick: openCreateDialog,
                }}
            />

            <PageFeedback isLoading={isLoading} error={error} />

            <TextField
                fullWidth
                placeholder="Search by name, email, phone, or role"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                sx={{ mb: 2 }}
            />

            <TableContainer component={Paper}>
                <Table>
                    <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Email</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Role</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Assigned Station</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Phone</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredUsers.length === 0 && !isLoading && (
                            <TableRow>
                                <TableCell colSpan={7} sx={{ py: 3 }}>
                                    <Typography color="text.secondary">No users found.</Typography>
                                </TableCell>
                            </TableRow>
                        )}

                        {filteredUsers.map((user) => {
                            const active = (user.status ?? 'active') === 'active';
                            return (
                                <TableRow key={user.id} hover>
                                    <TableCell>{user.name}</TableCell>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell>{toTitle(user.role ?? 'user')}</TableCell>
                                    <TableCell>{user.assigned_station ?? '-'}</TableCell>
                                    <TableCell>{user.phone || '-'}</TableCell>
                                    <TableCell>
                                        <Chip label={active ? 'Active' : 'Inactive'} size="small" color={active ? 'success' : 'default'} />
                                    </TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            <Button size="small" onClick={() => openEditDialog(user)}>
                                                Edit
                                            </Button>
                                            <Button size="small" color="error" onClick={() => void handleDeactivate(user)} disabled={!active}>
                                                Deactivate
                                            </Button>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Create User</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        margin="normal"
                        label="Name"
                        value={createState.name}
                        onChange={(event) => setCreateState((prev) => ({ ...prev, name: event.target.value }))}
                    />

                    <TextField
                        fullWidth
                        margin="normal"
                        label="Email"
                        value={createState.email}
                        onChange={(event) => setCreateState((prev) => ({ ...prev, email: event.target.value }))}
                    />

                    <TextField
                        fullWidth
                        margin="normal"
                        label="Phone"
                        value={createState.phone}
                        onChange={(event) => setCreateState((prev) => ({ ...prev, phone: event.target.value }))}
                    />

                    <TextField
                        fullWidth
                        margin="normal"
                        label="Temporary Password"
                        value={createState.password}
                        onChange={(event) => setCreateState((prev) => ({ ...prev, password: event.target.value }))}
                        helperText="Shown once. Share securely with the user."
                    />

                    <Select
                        fullWidth
                        value={createState.role}
                        onChange={(event) => setCreateState((prev) => ({ ...prev, role: event.target.value }))}
                        sx={{ mt: 2 }}
                    >
                        {USER_ROLE_OPTIONS.map((role) => (
                            <MenuItem key={role} value={role}>
                                {toTitle(role)}
                            </MenuItem>
                        ))}
                    </Select>

                    {(createState.role === 'test_operator' || createState.role === 'flash_operator') && (
                        <TextField
                            fullWidth
                            margin="normal"
                            label="Assigned Station"
                            value={createState.assigned_station}
                            onChange={(event) => setCreateState((prev) => ({ ...prev, assigned_station: event.target.value }))}
                        />
                    )}

                    <FormControlLabel
                        sx={{ mt: 1 }}
                        control={<Switch checked={createState.is_active} onChange={(event) => setCreateState((prev) => ({ ...prev, is_active: event.target.checked }))} />}
                        label="User Active"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleCreateUser} disabled={isLoading}>
                        Create User
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Edit User</DialogTitle>
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
                        label="Email"
                        value={editState.email}
                        onChange={(event) => setEditState((prev) => ({ ...prev, email: event.target.value }))}
                    />

                    <TextField
                        fullWidth
                        margin="normal"
                        label="Phone"
                        value={editState.phone}
                        onChange={(event) => setEditState((prev) => ({ ...prev, phone: event.target.value }))}
                    />

                    <Select
                        fullWidth
                        value={editState.role}
                        onChange={(event) => setEditState((prev) => ({ ...prev, role: event.target.value }))}
                        sx={{ mt: 2 }}
                    >
                        {USER_ROLE_OPTIONS.map((role) => (
                            <MenuItem key={role} value={role}>
                                {toTitle(role)}
                            </MenuItem>
                        ))}
                    </Select>

                    {(editState.role === 'test_operator' || editState.role === 'flash_operator') && (
                        <TextField
                            fullWidth
                            margin="normal"
                            label="Assigned Station"
                            value={editState.assigned_station}
                            onChange={(event) => setEditState((prev) => ({ ...prev, assigned_station: event.target.value }))}
                        />
                    )}

                    <FormControlLabel
                        sx={{ mt: 1 }}
                        control={<Switch checked={editState.is_active} onChange={(event) => setEditState((prev) => ({ ...prev, is_active: event.target.checked }))} />}
                        label="User Active"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSaveUser} disabled={isLoading}>
                        Save Changes
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default UsersPage;

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Menu,
    MenuItem,
    Paper,
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
import { MoreVertical } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { setProjects, setLoading, setError, clearError } from '@/store/projectSlice';
import { batchService, projectService } from '@/services';
import { CreateProjectForm, Project } from '@/types';
import PageHeader from '@/components/PageHeader';
import PageFeedback from '@/components/PageFeedback';
import { useAppUI } from '@/context/AppUIContext';
import { PROJECT_STATUS_OPTIONS, toTitle } from '@/utils/workflowOptions';
import { hasPermission } from '@/utils/rbac';

interface ProjectFormState extends CreateProjectForm {
    _id: string;
}

const initialForm: ProjectFormState = {
    _id: '',
    name: '',
    slug: '',
    description: '',
    status: 'active',
    project_type: 'device',
};

const ProjectsPage = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const dispatch = useAppDispatch();
    const { notify, confirm } = useAppUI();

    const { projects, isLoading, error, total } = useAppSelector((state) => state.projects);
    const role = useAppSelector((state) => state.auth.user?.role);

    const [searchInput, setSearchInput] = useState(searchParams.get('q') ?? '');
    const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('q') ?? '');
    const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') ?? 'all');
    const [projectTypeFilter, setProjectTypeFilter] = useState<string>(searchParams.get('project_type') ?? 'all');
    const [page, setPage] = useState(Math.max(0, Number(searchParams.get('page') ?? '1') - 1));
    const [rowsPerPage, setRowsPerPage] = useState(Number(searchParams.get('limit') ?? '20'));

    const [dialogOpen, setDialogOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
    const [form, setForm] = useState<ProjectFormState>(initialForm);

    const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
    const [menuProject, setMenuProject] = useState<Project | null>(null);

    const [highlightedProjectId, setHighlightedProjectId] = useState<string | null>(null);

    const canCreate = hasPermission(role, 'projects.create');
    const canUpdate = hasPermission(role, 'projects.update');
    const canDelete = hasPermission(role, 'projects.delete');

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchInput);
        }, 400);

        return () => clearTimeout(timer);
    }, [searchInput]);

    useEffect(() => {
        const params: Record<string, string> = {
            page: String(page + 1),
            limit: String(rowsPerPage),
        };

        if (statusFilter !== 'all') params.status = statusFilter;
        if (searchInput.trim()) params.q = searchInput.trim();
        if (projectTypeFilter !== 'all') params.project_type = projectTypeFilter;

        setSearchParams(params, { replace: true });
    }, [page, rowsPerPage, statusFilter, searchInput, projectTypeFilter, setSearchParams]);

    useEffect(() => {
        loadProjects();
    }, [page, rowsPerPage, statusFilter, debouncedSearch, projectTypeFilter]);

    useEffect(() => {
        if (!highlightedProjectId) return;
        const timer = setTimeout(() => setHighlightedProjectId(null), 2200);
        return () => clearTimeout(timer);
    }, [highlightedProjectId]);

    const filteredProjects = useMemo(() => {
        const term = debouncedSearch.trim().toLowerCase();
        if (!term) return projects;

        return projects.filter((project) => {
            return (
                project.name.toLowerCase().includes(term) ||
                project.slug.toLowerCase().includes(term) ||
                project.status.toLowerCase().includes(term) ||
                project.project_type.toLowerCase().includes(term)
            );
        });
    }, [projects, debouncedSearch]);

    const loadProjects = async () => {
        try {
            dispatch(setLoading(true));
            const response = await projectService.getProjects(
                page + 1,
                rowsPerPage,
                statusFilter === 'all' ? undefined : statusFilter,
                projectTypeFilter === 'all' ? undefined : projectTypeFilter
            );
            dispatch(setProjects(response));
            dispatch(clearError());
        } catch (err: any) {
            const message = err?.response?.data?.message || err?.message || 'Failed to load projects';
            dispatch(setError(message));
        } finally {
            dispatch(setLoading(false));
        }
    };

    const slugify = (value: string) =>
        value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

    const handleNameChange = (value: string) => {
        const nextSlug = slugify(value);
        setForm((prev) => ({
            ...prev,
            name: value,
            slug: isEditing ? prev.slug : nextSlug,
            _id: isEditing ? prev._id : `PROJ-${nextSlug.toUpperCase()}`,
        }));
    };

    const openCreateDialog = () => {
        setIsEditing(false);
        setEditingProjectId(null);
        setForm(initialForm);
        setDialogOpen(true);
    };

    const openEditDialog = (project: Project) => {
        setIsEditing(true);
        setEditingProjectId(project._id);
        setForm({
            _id: project._id,
            name: project.name,
            slug: project.slug,
            description: project.description ?? '',
            status: project.status,
            project_type: project.project_type ?? 'device',
        });
        setDialogOpen(true);
    };

    const closeMenu = () => {
        setMenuAnchor(null);
        setMenuProject(null);
    };

    const handleSave = async () => {
        if (!form._id || !form.name || !form.slug) {
            notify({ message: 'Project ID, name, and slug are required.', severity: 'warning' });
            return;
        }

        try {
            dispatch(setLoading(true));
            if (isEditing && editingProjectId) {
                await projectService.updateProject(editingProjectId, {
                    name: form.name,
                    slug: form.slug,
                    description: form.description,
                    status: form.status,
                    project_type: form.project_type,
                });
                notify({ message: 'Project updated successfully.', severity: 'success' });
                setHighlightedProjectId(editingProjectId);
            } else {
                await projectService.createProject({
                    _id: form._id,
                    name: form.name,
                    slug: form.slug,
                    description: form.description,
                    status: form.status,
                    project_type: form.project_type,
                });
                notify({ message: 'Project created successfully.', severity: 'success' });
                setHighlightedProjectId(form._id);
            }

            setDialogOpen(false);
            await loadProjects();
        } catch (err: any) {
            notify({ message: err?.response?.data?.message || err?.message || 'Failed to save project', severity: 'error' });
        } finally {
            dispatch(setLoading(false));
        }
    };

    const handleDelete = async (project: Project) => {
        try {
            const linkedBatches = await batchService.getBatches(1, 1, { project_id: project._id });
            const approved = await confirm({
                title: 'Delete Project',
                message: `Delete ${project.name}? This project has ${linkedBatches.total} linked batch(es).`,
                confirmText: 'Delete',
                tone: 'error',
            });

            if (!approved) return;

            dispatch(setLoading(true));
            await projectService.deleteProject(project._id);
            notify({ message: 'Project marked as discontinued.', severity: 'success' });
            await loadProjects();
        } catch (err: any) {
            notify({ message: err?.response?.data?.message || err?.message || 'Failed to delete project', severity: 'error' });
        } finally {
            dispatch(setLoading(false));
        }
    };

    return (
        <Box>
            <PageHeader
                title="Projects"
                subtitle="Manage product lines and lifecycle states across manufacturing operations."
                countLabel={`${total} total`}
                onRefresh={loadProjects}
                isRefreshing={isLoading}
                primaryAction={
                    canCreate
                        ? {
                              label: 'New Project',
                              onClick: openCreateDialog,
                          }
                        : undefined
                }
            />

            <PageFeedback isLoading={isLoading} error={error || null} />

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr 1fr' }, gap: 1.5, mb: 2 }}>
                <TextField
                    fullWidth
                    placeholder="Search by name, slug, status, or project type"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                />

                <ToggleButtonGroup
                    fullWidth
                    value={statusFilter}
                    exclusive
                    onChange={(_, nextValue) => {
                        if (!nextValue) return;
                        setStatusFilter(nextValue);
                        setPage(0);
                    }}
                    size="small"
                >
                    <ToggleButton value="all">All</ToggleButton>
                        {PROJECT_STATUS_OPTIONS.map((status) => (
                            <ToggleButton key={status} value={status}>
                                {toTitle(status)}
                            </ToggleButton>
                        ))}
                    </ToggleButtonGroup>

                <ToggleButtonGroup
                    fullWidth
                    value={projectTypeFilter}
                    exclusive
                    onChange={(_, nextValue) => {
                        if (!nextValue) return;
                        setProjectTypeFilter(nextValue);
                        setPage(0);
                    }}
                    size="small"
                >
                    <ToggleButton value="all">All Types</ToggleButton>
                    <ToggleButton value="device">Device</ToggleButton>
                    <ToggleButton value="accessory">Accessory</ToggleButton>
                </ToggleButtonGroup>
            </Box>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Slug</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Description</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', width: 64 }} />
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredProjects.length === 0 && !isLoading && (
                            <TableRow>
                                <TableCell colSpan={6} sx={{ py: 3 }}>
                                    <Typography color="text.secondary">No projects found.</Typography>
                                </TableCell>
                            </TableRow>
                        )}

                        {filteredProjects.map((project) => (
                            <TableRow
                                key={project._id}
                                hover
                                onClick={() => navigate(`/manufacturing/projects/${project._id}`)}
                                sx={{
                                    cursor: 'pointer',
                                    bgcolor: highlightedProjectId === project._id ? 'rgba(46, 125, 50, 0.12)' : undefined,
                                    transition: 'background-color 400ms ease',
                                }}
                            >
                                <TableCell>{project.name}</TableCell>
                                <TableCell>{project.slug}</TableCell>
                                <TableCell>{toTitle(project.project_type || 'device')}</TableCell>
                                <TableCell>{toTitle(project.status)}</TableCell>
                                <TableCell>{project.description || '-'}</TableCell>
                                <TableCell onClick={(event) => event.stopPropagation()}>
                                    <IconButton
                                        size="small"
                                        onClick={(event) => {
                                            setMenuAnchor(event.currentTarget);
                                            setMenuProject(project);
                                        }}
                                    >
                                        <MoreVertical size={18} />
                                    </IconButton>
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
                    rowsPerPageOptions={[20, 50, 100]}
                />
            </TableContainer>

            <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
                <MenuItem
                    onClick={() => {
                        if (menuProject) navigate(`/manufacturing/projects/${menuProject._id}`);
                        closeMenu();
                    }}
                >
                    View
                </MenuItem>

                <MenuItem
                    disabled={!canUpdate || !menuProject}
                    onClick={() => {
                        if (menuProject) openEditDialog(menuProject);
                        closeMenu();
                    }}
                >
                    Edit
                </MenuItem>

                <MenuItem
                    disabled={!canDelete || !menuProject}
                    onClick={() => {
                        if (menuProject) void handleDelete(menuProject);
                        closeMenu();
                    }}
                >
                    Delete
                </MenuItem>
            </Menu>

            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{isEditing ? 'Edit Project' : 'Create Project'}</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        margin="normal"
                        label="Project Name"
                        value={form.name}
                        onChange={(event) => handleNameChange(event.target.value)}
                    />

                    <TextField
                        fullWidth
                        margin="normal"
                        label="Slug"
                        value={form.slug}
                        onChange={(event) => {
                            const slug = slugify(event.target.value);
                            setForm((prev) => ({ ...prev, slug, _id: isEditing ? prev._id : `PROJ-${slug.toUpperCase()}` }));
                        }}
                    />

                    <TextField
                        fullWidth
                        margin="normal"
                        label="Project ID"
                        value={form._id}
                        onChange={(event) => setForm((prev) => ({ ...prev, _id: event.target.value.toUpperCase().trim() }))}
                    />

                    <TextField
                        fullWidth
                        margin="normal"
                        label="Description"
                        multiline
                        rows={3}
                        value={form.description}
                        onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                    />

                    <ToggleButtonGroup
                        fullWidth
                        exclusive
                        value={form.project_type}
                        onChange={(_, nextValue) => {
                            if (!nextValue) return;
                            setForm((prev) => ({ ...prev, project_type: nextValue }));
                        }}
                        sx={{ mt: 1 }}
                    >
                        <ToggleButton value="device">Device Project</ToggleButton>
                        <ToggleButton value="accessory">Accessory Project</ToggleButton>
                    </ToggleButtonGroup>

                    <ToggleButtonGroup
                        fullWidth
                        exclusive
                        value={form.status}
                        onChange={(_, nextValue) => {
                            if (!nextValue) return;
                            setForm((prev) => ({ ...prev, status: nextValue }));
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
                    <Button
                        onClick={() => {
                            setDialogOpen(false);
                            setEditingProjectId(null);
                            setIsEditing(false);
                        }}
                    >
                        Cancel
                    </Button>
                    <Button variant="contained" onClick={handleSave} disabled={isLoading}>
                        {isEditing ? 'Save Changes' : 'Create Project'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default ProjectsPage;


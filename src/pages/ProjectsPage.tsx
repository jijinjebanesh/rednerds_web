import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Box,
    Button,
    Card,
    CardContent,
    Grid,
    IconButton,
    Menu,
    MenuItem,
    Stack,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material';
import { Boxes, FolderKanban, Layers, MoreVertical, Plus } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { setProjects, setLoading, setError, clearError } from '@/store/projectSlice';
import { accessoryWorkflowService, batchService, projectService } from '@/services';
import { CreateProjectForm, Project } from '@/types';
import PageHeader from '@/components/PageHeader';
import PageFeedback from '@/components/PageFeedback';
import ActionDrawer from '@/components/ui/ActionDrawer';
import EmptyState from '@/components/ui/EmptyState';
import StatusChip from '@/components/ui/StatusChip';
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
    const [page] = useState(0);
    const [rowsPerPage] = useState(48);

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
    const [form, setForm] = useState<ProjectFormState>(initialForm);

    const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
    const [menuProject, setMenuProject] = useState<Project | null>(null);
    const [batchCounts, setBatchCounts] = useState<Record<string, number>>({});
    const [workflowCounts, setWorkflowCounts] = useState<Record<string, number>>({});

    const canCreate = hasPermission(role, 'projects.create');
    const canUpdate = hasPermission(role, 'projects.update');
    const canDelete = hasPermission(role, 'projects.delete');

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchInput);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchInput]);

    useEffect(() => {
        const params: Record<string, string> = {};
        if (statusFilter !== 'all') params.status = statusFilter;
        if (projectTypeFilter !== 'all') params.project_type = projectTypeFilter;
        if (searchInput.trim()) params.q = searchInput.trim();
        setSearchParams(params, { replace: true });
    }, [projectTypeFilter, searchInput, setSearchParams, statusFilter]);

    useEffect(() => {
        void loadProjects();
    }, [page, rowsPerPage, statusFilter, projectTypeFilter]);

    useEffect(() => {
        void loadSupplementalCounts();
    }, [projects]);

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

    const slugify = (value: string) =>
        value
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

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
            dispatch(setError(err?.response?.data?.message || err?.message || 'Failed to load projects'));
        } finally {
            dispatch(setLoading(false));
        }
    };

    const loadSupplementalCounts = async () => {
        if (!projects.length) {
            setBatchCounts({});
            setWorkflowCounts({});
            return;
        }

        try {
            const [batchesRes, workflowsRes] = await Promise.all([
                batchService.getBatches(1, 1000),
                accessoryWorkflowService.getWorkflows(1, 1000),
            ]);

            const nextBatchCounts = batchesRes.data.reduce<Record<string, number>>((accumulator, batch) => {
                accumulator[batch.project_id] = (accumulator[batch.project_id] ?? 0) + 1;
                return accumulator;
            }, {});

            const nextWorkflowCounts = workflowsRes.data.reduce<Record<string, number>>((accumulator, workflow) => {
                accumulator[workflow.project_id] = (accumulator[workflow.project_id] ?? 0) + 1;
                return accumulator;
            }, {});

            setBatchCounts(nextBatchCounts);
            setWorkflowCounts(nextWorkflowCounts);
        } catch {
            setBatchCounts({});
            setWorkflowCounts({});
        }
    };

    const openCreateDrawer = () => {
        setIsEditing(false);
        setEditingProjectId(null);
        setForm(initialForm);
        setDrawerOpen(true);
    };

    const openEditDrawer = (project: Project) => {
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
        setDrawerOpen(true);
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
            } else {
                await projectService.createProject(form);
                notify({ message: 'Project created successfully.', severity: 'success' });
            }

            setDrawerOpen(false);
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
                confirmText: 'Delete Project',
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
                subtitle="Organize device and accessory programs, track their lifecycle state, and jump into the right workflow quickly."
                countLabel={`${total} total`}
                onRefresh={loadProjects}
                isRefreshing={isLoading}
                primaryAction={canCreate ? { label: 'Create Project', onClick: openCreateDrawer } : undefined}
            />

            <PageFeedback isLoading={isLoading} error={error || null} />

            <Stack direction={{ xs: 'column', xl: 'row' }} spacing={1.5} sx={{ mb: 3 }}>
                <TextField
                    fullWidth
                    placeholder="Search by project name, slug, type, or status"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                />

                <ToggleButtonGroup
                    value={statusFilter}
                    exclusive
                    onChange={(_, nextValue) => {
                        if (!nextValue) return;
                        setStatusFilter(nextValue);
                    }}
                    size="small"
                >
                    <ToggleButton value="all">All statuses</ToggleButton>
                    {PROJECT_STATUS_OPTIONS.map((status) => (
                        <ToggleButton key={status} value={status}>
                            {toTitle(status)}
                        </ToggleButton>
                    ))}
                </ToggleButtonGroup>

                <ToggleButtonGroup
                    value={projectTypeFilter}
                    exclusive
                    onChange={(_, nextValue) => {
                        if (!nextValue) return;
                        setProjectTypeFilter(nextValue);
                    }}
                    size="small"
                >
                    <ToggleButton value="all">All types</ToggleButton>
                    <ToggleButton value="device">Device</ToggleButton>
                    <ToggleButton value="accessory">Accessory</ToggleButton>
                </ToggleButtonGroup>
            </Stack>

            {filteredProjects.length === 0 && !isLoading ? (
                <EmptyState
                    icon={<FolderKanban size={24} />}
                    title="No projects found"
                    description="Start by creating your first device or accessory project. It will become the parent for batches or accessory quantity workflows."
                    action={canCreate ? { label: 'Create your first project', onClick: openCreateDrawer } : undefined}
                />
            ) : (
                <Grid container spacing={2}>
                    {filteredProjects.map((project) => {
                        const activityCount = project.project_type === 'device' ? batchCounts[project._id] ?? 0 : workflowCounts[project._id] ?? 0;
                        const activityLabel = project.project_type === 'device' ? 'Batches' : 'Workflows';

                        return (
                            <Grid item xs={12} md={6} xl={4} key={project._id}>
                                <Card
                                    sx={{
                                        height: '100%',
                                        cursor: 'pointer',
                                        transition: 'transform 160ms ease, border-color 160ms ease',
                                        '&:hover': {
                                            transform: 'translateY(-2px)',
                                            borderColor: 'primary.main',
                                        },
                                    }}
                                    onClick={() => navigate(`/manufacturing/projects/${project._id}`)}
                                >
                                    <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.25, height: '100%' }}>
                                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                                            <Box>
                                                <Typography variant="overline">{project.project_type === 'device' ? 'Device Project' : 'Accessory Project'}</Typography>
                                                <Typography variant="h6">{project.name}</Typography>
                                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                    {project.slug}
                                                </Typography>
                                            </Box>
                                            <IconButton
                                                size="small"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    setMenuAnchor(event.currentTarget);
                                                    setMenuProject(project);
                                                }}
                                            >
                                                <MoreVertical size={18} />
                                            </IconButton>
                                        </Stack>

                                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                            <StatusChip value={project.project_type} />
                                            <StatusChip value={project.status} />
                                        </Stack>

                                        <Typography variant="body2" color="text.secondary" sx={{ minHeight: 44 }}>
                                            {project.description || 'No description added yet. Use this project as the control point for all linked manufacturing work.'}
                                        </Typography>

                                        <Stack direction="row" spacing={1.25}>
                                            <Box
                                                sx={{
                                                    flex: 1,
                                                    p: 1.5,
                                                    borderRadius: 2.5,
                                                    border: '1px solid',
                                                    borderColor: 'divider',
                                                    backgroundColor: 'rgba(255,255,255,0.02)',
                                                }}
                                            >
                                                <Typography variant="body2" color="text.secondary">
                                                    {activityLabel}
                                                </Typography>
                                                <Typography variant="h6" sx={{ mt: 0.5 }}>
                                                    {activityCount}
                                                </Typography>
                                            </Box>

                                            <Box
                                                sx={{
                                                    flex: 1,
                                                    p: 1.5,
                                                    borderRadius: 2.5,
                                                    border: '1px solid',
                                                    borderColor: 'divider',
                                                    backgroundColor: 'rgba(255,255,255,0.02)',
                                                }}
                                            >
                                                <Typography variant="body2" color="text.secondary">
                                                    Updated
                                                </Typography>
                                                <Typography variant="subtitle2" sx={{ mt: 0.8 }}>
                                                    {new Date(project.updated_at ?? project.updatedAt ?? project.created_at ?? project.createdAt ?? Date.now()).toLocaleDateString()}
                                                </Typography>
                                            </Box>
                                        </Stack>

                                        <Button
                                            variant="outlined"
                                            startIcon={project.project_type === 'device' ? <Boxes size={16} /> : <Layers size={16} />}
                                            sx={{ mt: 'auto', alignSelf: 'flex-start' }}
                                        >
                                            Open Details
                                        </Button>
                                    </CardContent>
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>
            )}

            <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
                <MenuItem
                    onClick={() => {
                        if (menuProject) navigate(`/manufacturing/projects/${menuProject._id}`);
                        setMenuAnchor(null);
                    }}
                >
                    View project
                </MenuItem>
                <MenuItem
                    disabled={!canUpdate || !menuProject}
                    onClick={() => {
                        if (menuProject) openEditDrawer(menuProject);
                        setMenuAnchor(null);
                    }}
                >
                    Edit project
                </MenuItem>
                <MenuItem
                    disabled={!canDelete || !menuProject}
                    onClick={() => {
                        if (menuProject) void handleDelete(menuProject);
                        setMenuAnchor(null);
                    }}
                >
                    Delete project
                </MenuItem>
            </Menu>

            <ActionDrawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                title={isEditing ? 'Edit Project' : 'Create Project'}
                subtitle="Project creation stays fully compatible with existing routes, APIs, and role permissions."
            >
                <Stack spacing={2}>
                    <TextField
                        fullWidth
                        label="Project Name"
                        value={form.name}
                        onChange={(event) => {
                            const value = event.target.value;
                            const slug = slugify(value);
                            setForm((previous) => ({
                                ...previous,
                                name: value,
                                slug: isEditing ? previous.slug : slug,
                                _id: isEditing ? previous._id : `PROJ-${slug.toUpperCase()}`,
                            }));
                        }}
                    />

                    <TextField
                        fullWidth
                        label="Slug"
                        value={form.slug}
                        onChange={(event) => {
                            const slug = slugify(event.target.value);
                            setForm((previous) => ({
                                ...previous,
                                slug,
                                _id: isEditing ? previous._id : `PROJ-${slug.toUpperCase()}`,
                            }));
                        }}
                    />

                    <TextField
                        fullWidth
                        label="Project ID"
                        value={form._id}
                        onChange={(event) => setForm((previous) => ({ ...previous, _id: event.target.value.toUpperCase().trim() }))}
                    />

                    <TextField
                        fullWidth
                        label="Description"
                        multiline
                        rows={4}
                        value={form.description}
                        onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))}
                    />

                    <ToggleButtonGroup
                        fullWidth
                        exclusive
                        value={form.project_type}
                        onChange={(_, nextValue) => {
                            if (!nextValue) return;
                            setForm((previous) => ({ ...previous, project_type: nextValue }));
                        }}
                    >
                        <ToggleButton value="device">Device project</ToggleButton>
                        <ToggleButton value="accessory">Accessory project</ToggleButton>
                    </ToggleButtonGroup>

                    <ToggleButtonGroup
                        fullWidth
                        exclusive
                        value={form.status}
                        onChange={(_, nextValue) => {
                            if (!nextValue) return;
                            setForm((previous) => ({ ...previous, status: nextValue }));
                        }}
                    >
                        {PROJECT_STATUS_OPTIONS.map((status) => (
                            <ToggleButton key={status} value={status}>
                                {toTitle(status)}
                            </ToggleButton>
                        ))}
                    </ToggleButtonGroup>

                    <Stack direction="row" justifyContent="flex-end" spacing={1.5} sx={{ pt: 1 }}>
                        <Button variant="outlined" onClick={() => setDrawerOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => void handleSave()} disabled={isLoading}>
                            {isEditing ? 'Save Changes' : 'Create Project'}
                        </Button>
                    </Stack>
                </Stack>
            </ActionDrawer>
        </Box>
    );
};

export default ProjectsPage;

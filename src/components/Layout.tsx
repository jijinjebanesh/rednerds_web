import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    AppBar,
    Avatar,
    Badge,
    Box,
    Breadcrumbs,
    Chip,
    Divider,
    Drawer,
    IconButton,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Paper,
    Stack,
    TextField,
    Toolbar,
    Tooltip,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import {
    AlertTriangle,
    Bell,
    Boxes,
    Bug,
    ChevronLeft,
    ChevronRight,
    FolderKanban,
    Layers,
    LayoutDashboard,
    LogOut,
    Menu as MenuIcon,
    MoonStar,
    Package,
    Search,
    ShieldCheck,
    SunMedium,
    Wrench,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { logout } from '@/store/authSlice';
import { authService, customerRepairService, debugSessionService, testLogService } from '@/services';
import { AppRouteKey, hasRouteAccess } from '@/utils/rbac';
import { DebugSession, TestLog } from '@/types';
import { toTitle } from '@/utils/workflowOptions';
import { useThemeMode } from '@/context/ThemeModeContext';
import StatusChip from '@/components/ui/StatusChip';

interface LayoutProps {
    children: React.ReactNode;
}

interface MenuConfigItem {
    section: string;
    label: string;
    path: string;
    icon: React.ReactNode;
    routeKey: AppRouteKey;
}

const SIDEBAR_EXPANDED = 240;
const SIDEBAR_COLLAPSED = 64;
const APPBAR_HEIGHT = 76;

const MENU_ITEMS: MenuConfigItem[] = [
    { section: 'Overview', label: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/', routeKey: 'dashboard' },
    { section: 'Manufacturing', label: 'Projects', icon: <FolderKanban size={20} />, path: '/manufacturing/projects', routeKey: 'projects' },
    { section: 'Manufacturing', label: 'Batches', icon: <Boxes size={20} />, path: '/manufacturing/batches', routeKey: 'batches' },
    { section: 'Manufacturing', label: 'Products', icon: <Package size={20} />, path: '/manufacturing/products', routeKey: 'products' },
    { section: 'Quality', label: 'Testing', icon: <Bug size={20} />, path: '/quality/testing', routeKey: 'testing' },
    { section: 'Quality', label: 'Debugging', icon: <AlertTriangle size={20} />, path: '/quality/debugging', routeKey: 'debugging' },
    { section: 'Quality', label: 'Grading', icon: <ShieldCheck size={20} />, path: '/quality/grading', routeKey: 'quality_grading' },
    { section: 'Quality', label: 'Repairs', icon: <Wrench size={20} />, path: '/quality/repairs', routeKey: 'repairs' },
    { section: 'Accessories', label: 'Workflows', icon: <Layers size={20} />, path: '/accessories/workflows', routeKey: 'accessory_workflows' },
    { section: 'Admin', label: 'Users', icon: <ShieldCheck size={20} />, path: '/admin/users', routeKey: 'users' },
];

const Layout = ({ children }: LayoutProps) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useAppDispatch();
    const { user } = useAppSelector((state) => state.auth);
    const { mode, toggleMode } = useThemeMode();
    const searchAnchorRef = useRef<HTMLDivElement | null>(null);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [badgeCounts, setBadgeCounts] = useState<Record<string, number>>({
        testing: 0,
        debugging: 0,
        repairs: 0,
    });

    const accessibleMenuItems = useMemo(() => {
        return MENU_ITEMS.filter((item) => hasRouteAccess(user?.role, item.routeKey));
    }, [user?.role]);

    const navigationSections = useMemo(() => {
        return accessibleMenuItems.reduce<Record<string, MenuConfigItem[]>>((accumulator, item) => {
            accumulator[item.section] = [...(accumulator[item.section] ?? []), item];
            return accumulator;
        }, {});
    }, [accessibleMenuItems]);

    const filteredSearchResults = useMemo(() => {
        const term = searchQuery.trim().toLowerCase();
        if (!term) return accessibleMenuItems.slice(0, 6);
        return accessibleMenuItems.filter((item) => item.label.toLowerCase().includes(term) || item.section.toLowerCase().includes(term));
    }, [accessibleMenuItems, searchQuery]);

    const notificationCount = badgeCounts.testing + badgeCounts.debugging + badgeCounts.repairs;
    const activeDrawerWidth = isMobile ? SIDEBAR_EXPANDED : collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;

    const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleProfileMenuClose = () => {
        setAnchorEl(null);
    };

    const handleLogout = async () => {
        try {
            await authService.logout();
            dispatch(logout());
            navigate('/login');
        } catch (error) {
            console.error('Logout failed:', error);
            dispatch(logout());
            navigate('/login');
        }
    };

    const breadcrumbItems = useMemo(() => {
        const matchedMenu = accessibleMenuItems.find((item) => {
            return item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path);
        });

        if (!matchedMenu) {
            return location.pathname
                .split('/')
                .filter(Boolean)
                .map((segment, index, segments) => ({
                    label: toTitle(segment),
                    path: `/${segments.slice(0, index + 1).join('/')}`,
                }));
        }

        const crumbs = [
            {
                label: matchedMenu.section,
                path: matchedMenu.path === '/' ? '/' : `/${matchedMenu.path.split('/').filter(Boolean)[0]}`,
            },
            { label: matchedMenu.label, path: matchedMenu.path },
        ];

        const segments = location.pathname.split('/').filter(Boolean);
        if (segments.length > 2) {
            crumbs.push({ label: segments[segments.length - 1], path: location.pathname });
        }

        return crumbs;
    }, [accessibleMenuItems, location.pathname]);

    const fetchBadgeCounts = useCallback(async () => {
        try {
            const [testLogsRes, debugSessionsRes, repairsRes] = await Promise.all([
                testLogService.getTestLogs(1, 1000),
                debugSessionService.getDebugSessions(1, 1000),
                customerRepairService.getRepairs(1, 1000),
            ]);

            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);

            const testingToday = testLogsRes.data.filter((log: TestLog) => new Date(log.tested_at) >= startOfToday).length;

            const sessionsByTestLog = new Map<string, DebugSession[]>();
            for (const session of debugSessionsRes.data) {
                const current = sessionsByTestLog.get(session.test_log_id) ?? [];
                current.push(session);
                sessionsByTestLog.set(session.test_log_id, current);
            }

            const failedOrPartial = testLogsRes.data.filter((log: TestLog) => log.result !== 'pass');
            const debugQueue = failedOrPartial.filter((log: TestLog) => {
                const sessions = sessionsByTestLog.get(log._id) ?? [];
                if (sessions.length === 0) return true;
                const latest = sessions.sort((a, b) => new Date(b.debugged_at).getTime() - new Date(a.debugged_at).getTime())[0];
                if (latest.re_test_required) return false;
                return latest.resolution_status !== 'resolved' && latest.resolution_status !== 'scrapped';
            }).length;

            const openRepairs = repairsRes.data.filter((repair) => ['received', 'in_progress'].includes(repair.status)).length;

            setBadgeCounts({
                testing: testingToday,
                debugging: debugQueue,
                repairs: openRepairs,
            });
        } catch {
            setBadgeCounts((previous) => previous);
        }
    }, []);

    useEffect(() => {
        void fetchBadgeCounts();

        const interval = setInterval(() => {
            void fetchBadgeCounts();
        }, 60000);

        return () => clearInterval(interval);
    }, [fetchBadgeCounts]);

    useEffect(() => {
        if (!isMobile) {
            setMobileOpen(false);
        }
    }, [isMobile]);

    const drawerContent = (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ px: collapsed && !isMobile ? 1.5 : 2.5, py: 2.5 }}>
                <Typography variant="overline" sx={{ opacity: collapsed && !isMobile ? 0 : 1, transition: 'opacity 150ms ease' }}>
                    REDNERDS
                </Typography>
                <Typography variant={collapsed && !isMobile ? 'subtitle1' : 'h6'} noWrap sx={{ mt: 0.5, letterSpacing: '-0.02em' }}>
                    {collapsed && !isMobile ? 'RN' : 'Quality Command'}
                </Typography>
                {!collapsed || isMobile ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                        Device and accessory operations in one manufacturing console.
                    </Typography>
                ) : null}
            </Box>
            <Divider />

            <Box sx={{ flex: 1, overflowY: 'auto', px: 1.25, py: 1.5 }}>
                {Object.entries(navigationSections).map(([section, items]) => (
                    <List
                        key={section}
                        disablePadding
                        subheader={
                            !collapsed || isMobile ? (
                                <Typography variant="overline" sx={{ px: 1.5, py: 1.25, display: 'block' }}>
                                    {section}
                                </Typography>
                            ) : undefined
                        }
                    >
                        {items.map((item) => {
                            const selected = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
                            const badgeKey = item.routeKey as keyof typeof badgeCounts;

                            const navAction = (
                                <ListItemButton
                                    selected={selected}
                                    onClick={() => {
                                        navigate(item.path);
                                        setMobileOpen(false);
                                    }}
                                    sx={{
                                        minHeight: 46,
                                        mb: 0.5,
                                        borderRadius: 2.5,
                                        px: collapsed && !isMobile ? 1.2 : 1.4,
                                        justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
                                        borderLeft: selected ? `3px solid ${theme.palette.primary.main}` : '3px solid transparent',
                                        backgroundColor: selected ? 'rgba(79,142,247,0.12)' : 'transparent',
                                    }}
                                >
                                    <ListItemIcon sx={{ minWidth: collapsed && !isMobile ? 0 : 38, color: 'inherit' }}>{item.icon}</ListItemIcon>
                                    {!collapsed || isMobile ? (
                                        <ListItemText
                                            primary={item.label}
                                            secondary={badgeKey in badgeCounts && badgeCounts[badgeKey] > 0 ? `${badgeCounts[badgeKey]} pending` : undefined}
                                            primaryTypographyProps={{ fontWeight: selected ? 700 : 600 }}
                                            secondaryTypographyProps={{ fontSize: '0.75rem' }}
                                        />
                                    ) : null}
                                </ListItemButton>
                            );

                            return collapsed && !isMobile ? (
                                <Tooltip key={item.path} title={item.label} placement="right">
                                    <ListItem disablePadding sx={{ display: 'block' }}>
                                        {navAction}
                                    </ListItem>
                                </Tooltip>
                            ) : (
                                <ListItem key={item.path} disablePadding sx={{ display: 'block' }}>
                                    {navAction}
                                </ListItem>
                            );
                        })}
                    </List>
                ))}
            </Box>
        </Box>
    );

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh' }}>
            <AppBar
                position="fixed"
                sx={{
                    zIndex: (currentTheme) => currentTheme.zIndex.drawer + 1,
                    ml: isMobile ? 0 : `${activeDrawerWidth}px`,
                    width: isMobile ? '100%' : `calc(100% - ${activeDrawerWidth}px)`,
                }}
            >
                <Toolbar sx={{ minHeight: `${APPBAR_HEIGHT}px !important`, px: { xs: 2, md: 3 } }}>
                    <IconButton
                        color="inherit"
                        onClick={() => {
                            if (isMobile) {
                                setMobileOpen((previous) => !previous);
                            } else {
                                setCollapsed((previous) => !previous);
                            }
                        }}
                        sx={{ mr: 2 }}
                    >
                        {isMobile ? <MenuIcon size={22} /> : collapsed ? <ChevronRight size={22} /> : <ChevronLeft size={22} />}
                    </IconButton>

                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Breadcrumbs separator="›" sx={{ mb: 0.4 }}>
                            {breadcrumbItems.map((item, index) => (
                                <Typography
                                    key={`${item.path}-${index}`}
                                    variant="caption"
                                    sx={{
                                        color: index === breadcrumbItems.length - 1 ? 'text.primary' : 'text.secondary',
                                        fontWeight: index === breadcrumbItems.length - 1 ? 700 : 600,
                                    }}
                                >
                                    {toTitle(item.label)}
                                </Typography>
                            ))}
                        </Breadcrumbs>
                        <Typography variant="h6" noWrap>
                            REDNERDS Manufacturing Platform
                        </Typography>
                    </Box>

                    <Paper
                        ref={searchAnchorRef}
                        sx={{
                            display: { xs: 'none', lg: 'flex' },
                            alignItems: 'center',
                            gap: 1.25,
                            px: 1.5,
                            py: 0.5,
                            width: 320,
                            mr: 2,
                            borderRadius: 999,
                            bgcolor: 'rgba(255,255,255,0.04)',
                        }}
                    >
                        <Search size={16} />
                        <TextField
                            variant="standard"
                            fullWidth
                            placeholder="Search navigation, workflows, admin"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            InputProps={{ disableUnderline: true }}
                        />
                    </Paper>

                    <Menu
                        anchorEl={searchAnchorRef.current}
                        open={Boolean(searchAnchorRef.current) && filteredSearchResults.length > 0 && searchQuery.length > 0}
                        onClose={() => setSearchQuery('')}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                    >
                        {filteredSearchResults.map((item) => (
                            <MenuItem
                                key={`search-${item.path}`}
                                onClick={() => {
                                    navigate(item.path);
                                    setSearchQuery('');
                                }}
                            >
                                {item.label}
                            </MenuItem>
                        ))}
                    </Menu>

                    <Stack direction="row" alignItems="center" spacing={1.25}>
                        <Tooltip title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}>
                            <IconButton color="inherit" onClick={toggleMode}>
                                {mode === 'dark' ? <SunMedium size={18} /> : <MoonStar size={18} />}
                            </IconButton>
                        </Tooltip>

                        <Tooltip title="Notifications">
                            <IconButton color="inherit">
                                <Badge badgeContent={notificationCount} color="error">
                                    <Bell size={18} />
                                </Badge>
                            </IconButton>
                        </Tooltip>

                        <Stack spacing={0.5} sx={{ display: { xs: 'none', md: 'flex' }, minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
                                {user?.username ?? 'User'}
                            </Typography>
                            <StatusChip value={user?.role ?? 'operator'} />
                        </Stack>

                        <IconButton onClick={handleProfileMenuOpen} sx={{ p: 0 }}>
                            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                                {(user?.username ?? 'U').charAt(0).toUpperCase()}
                            </Avatar>
                        </IconButton>
                    </Stack>
                </Toolbar>
            </AppBar>

            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleProfileMenuClose}>
                <MenuItem disabled sx={{ display: 'block' }}>
                    <Typography variant="body2">{user?.email ?? '-'}</Typography>
                    <Chip size="small" label={user?.role ?? 'operator'} sx={{ mt: 0.5, textTransform: 'capitalize' }} />
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleLogout}>
                    <ListItemIcon>
                        <LogOut size={18} />
                    </ListItemIcon>
                    Logout
                </MenuItem>
            </Menu>

            {isMobile ? (
                <Drawer
                    variant="temporary"
                    open={mobileOpen}
                    onClose={() => setMobileOpen(false)}
                    ModalProps={{ keepMounted: true }}
                    sx={{
                        '& .MuiDrawer-paper': {
                            width: SIDEBAR_EXPANDED,
                            boxSizing: 'border-box',
                        },
                    }}
                >
                    {drawerContent}
                </Drawer>
            ) : (
                <Drawer
                    variant="permanent"
                    open
                    sx={{
                        width: activeDrawerWidth,
                        flexShrink: 0,
                        '& .MuiDrawer-paper': {
                            width: activeDrawerWidth,
                            boxSizing: 'border-box',
                            transition: theme.transitions.create('width', {
                                easing: theme.transitions.easing.easeInOut,
                                duration: theme.transitions.duration.shorter,
                            }),
                        },
                    }}
                >
                    {drawerContent}
                </Drawer>
            )}

            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    pt: `calc(${APPBAR_HEIGHT}px + 24px)`,
                    pb: 4,
                    px: { xs: 2, md: 3 },
                    minHeight: '100vh',
                }}
            >
                <Box sx={{ maxWidth: 1440, mx: 'auto', width: '100%' }}>{children}</Box>
            </Box>
        </Box>
    );
};

export default Layout;

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    AppBar,
    Avatar,
    Badge,
    Box,
    Chip,
    Divider,
    Drawer,
    IconButton,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Toolbar,
    Typography,
} from '@mui/material';
import {
    Menu as MenuIcon,
    ChevronLeft,
    LayoutDashboard,
    Boxes,
    Layers,
    Home,
    Wrench,
    Bug,
    AlertTriangle,
    ShieldCheck,
    LogOut,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { logout } from '@/store/authSlice';
import { authService, customerRepairService, debugSessionService, testLogService } from '@/services';
import { AppRouteKey, hasRouteAccess } from '@/utils/rbac';
import { DebugSession, TestLog } from '@/types';

interface LayoutProps {
    children: React.ReactNode;
}

interface MenuConfigItem {
    label: string;
    path: string;
    icon: React.ReactNode;
    routeKey: AppRouteKey;
}

const MENU_ITEMS: MenuConfigItem[] = [
    { label: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/', routeKey: 'dashboard' },
    { label: 'Projects', icon: <Home size={20} />, path: '/manufacturing/projects', routeKey: 'projects' },
    { label: 'Batches', icon: <Boxes size={20} />, path: '/manufacturing/batches', routeKey: 'batches' },
    { label: 'Products', icon: <Boxes size={20} />, path: '/manufacturing/products', routeKey: 'products' },
    { label: 'Testing', icon: <Bug size={20} />, path: '/quality/testing', routeKey: 'testing' },
    { label: 'Debugging', icon: <AlertTriangle size={20} />, path: '/quality/debugging', routeKey: 'debugging' },
    { label: 'Repairs', icon: <Wrench size={20} />, path: '/quality/repairs', routeKey: 'repairs' },
    { label: 'QC Grading', icon: <ShieldCheck size={20} />, path: '/quality/grading', routeKey: 'quality_grading' },
    { label: 'Accessory Flow', icon: <Layers size={20} />, path: '/accessories/workflows', routeKey: 'accessory_workflows' },
    { label: 'Users', icon: <ShieldCheck size={20} />, path: '/admin/users', routeKey: 'users' },
];

const Layout = ({ children }: LayoutProps) => {
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useAppDispatch();
    const { user } = useAppSelector((state) => state.auth);
    const [openDrawer, setOpenDrawer] = useState(true);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [badgeCounts, setBadgeCounts] = useState<Record<string, number>>({
        testing: 0,
        debugging: 0,
        repairs: 0,
    });

    const accessibleMenuItems = useMemo(() => {
        return MENU_ITEMS.filter((item) => hasRouteAccess(user?.role, item.routeKey));
    }, [user?.role]);

    const handleDrawerToggle = () => {
        setOpenDrawer((previous) => !previous);
    };

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
            setBadgeCounts((prev) => prev);
        }
    }, []);

    useEffect(() => {
        void fetchBadgeCounts();

        const interval = setInterval(() => {
            void fetchBadgeCounts();
        }, 60000);

        return () => clearInterval(interval);
    }, [fetchBadgeCounts]);

    return (
        <Box sx={{ display: 'flex' }}>
            <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
                <Toolbar>
                    <IconButton color="inherit" onClick={handleDrawerToggle} sx={{ marginRight: 2 }}>
                        {openDrawer ? <ChevronLeft size={24} /> : <MenuIcon size={24} />}
                    </IconButton>

                    <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
                        REDNERDS Manufacturing System
                    </Typography>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                            <Typography variant="body2" sx={{ lineHeight: 1.1 }}>
                                {user?.username ?? 'User'}
                            </Typography>
                            <Typography variant="caption" sx={{ opacity: 0.8, textTransform: 'capitalize' }}>
                                {user?.role ?? 'operator'}
                            </Typography>
                        </Box>

                        <IconButton onClick={handleProfileMenuOpen} sx={{ p: 0 }}>
                            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                                {(user?.username ?? 'U').charAt(0).toUpperCase()}
                            </Avatar>
                        </IconButton>
                    </Box>
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

            <Drawer
                variant="temporary"
                open={openDrawer}
                onClose={handleDrawerToggle}
                sx={{
                    width: 280,
                    flexShrink: 0,
                    '& .MuiDrawer-paper': {
                        width: 280,
                        boxSizing: 'border-box',
                        marginTop: '64px',
                    },
                }}
            >
                <Box sx={{ p: 2 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                        Navigation
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        Role-aware menu
                    </Typography>
                </Box>
                <Divider />

                <List>
                    {accessibleMenuItems.map((item) => {
                        const selected = item.path === '/'
                            ? location.pathname === '/'
                            : location.pathname.startsWith(item.path);

                        return (
                            <ListItemButton
                                key={item.path}
                                selected={selected}
                                onClick={() => navigate(item.path)}
                            >
                                <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                                <ListItemText
                                    primary={
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                            <span>{item.label}</span>
                                            {(item.routeKey === 'testing' || item.routeKey === 'debugging' || item.routeKey === 'repairs') && (
                                                <Badge
                                                    color={item.routeKey === 'debugging' ? 'warning' : 'primary'}
                                                    badgeContent={badgeCounts[item.routeKey]}
                                                    max={999}
                                                />
                                            )}
                                        </Box>
                                    }
                                />
                            </ListItemButton>
                        );
                    })}
                </List>
            </Drawer>

            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: 3,
                    marginTop: '64px',
                    backgroundColor: '#f5f5f5',
                    minHeight: 'calc(100vh - 64px)',
                }}
            >
                {children}
            </Box>
        </Box>
    );
};

export default Layout;

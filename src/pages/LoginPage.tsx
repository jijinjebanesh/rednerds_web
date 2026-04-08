import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Container,
    Grid,
    Link,
    Paper,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { Activity, ShieldCheck, Workflow } from 'lucide-react';
import { useAppDispatch } from '@/hooks/redux';
import { setUser, setToken, setError } from '@/store/authSlice';
import { authService } from '@/services';
import { useAppUI } from '@/context/AppUIContext';

const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const featureCards = [
    {
        title: 'Unit-level traceability',
        description: 'Track every motherboard-class device by product ID, MAC address, stage, and final grade.',
        icon: <Activity size={18} />,
    },
    {
        title: 'Role-driven operations',
        description: 'Testing, debugging, repairs, QC, and admin workflows stay separated without slowing the floor down.',
        icon: <ShieldCheck size={18} />,
    },
    {
        title: 'Accessory quantity flow',
        description: 'Manage target, tested, debug, and graded counts for non-serialized modules from one console.',
        icon: <Workflow size={18} />,
    },
];

const LoginPage = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { notify } = useAppUI();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setErrorMsg] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        setValue,
        formState: { errors, isValid },
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
        mode: 'onBlur',
    });

    const onSubmit = async (data: LoginFormData) => {
        setIsLoading(true);
        setErrorMsg(null);

        try {
            const response = await authService.login(data);
            dispatch(setToken(response.token));
            dispatch(setUser(response.user));
            navigate('/');
        } catch (err: any) {
            const errorMessage = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Login failed. Please try again.';
            setErrorMsg(errorMessage);
            dispatch(setError(errorMessage));
            setValue('password', '', { shouldValidate: true });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                py: { xs: 4, md: 8 },
            }}
        >
            <Container maxWidth="lg">
                <Grid container spacing={3} alignItems="stretch">
                    <Grid item xs={12} md={6}>
                        <Paper
                            sx={{
                                height: '100%',
                                p: { xs: 3, md: 4 },
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                background:
                                    'linear-gradient(155deg, rgba(79,142,247,0.18) 0%, rgba(26,29,46,0.92) 48%, rgba(0,201,177,0.10) 100%)',
                            }}
                        >
                            <Box>
                                <Typography variant="overline">REDNERDS</Typography>
                                <Typography variant="h4" sx={{ mt: 1, maxWidth: 420 }}>
                                    Manufacturing visibility built for real floor operations.
                                </Typography>
                                <Typography variant="body1" color="text.secondary" sx={{ mt: 2, maxWidth: 520 }}>
                                    One workspace for device production, accessory quantity tracking, debugging queues, customer repairs, and QC quality grading.
                                </Typography>
                            </Box>

                            <Stack spacing={1.5} sx={{ mt: 4 }}>
                                {featureCards.map((item) => (
                                    <Paper
                                        key={item.title}
                                        sx={{
                                            p: 2,
                                            display: 'flex',
                                            gap: 1.5,
                                            alignItems: 'flex-start',
                                            backgroundColor: 'rgba(255,255,255,0.04)',
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                width: 40,
                                                height: 40,
                                                borderRadius: 2.5,
                                                display: 'grid',
                                                placeItems: 'center',
                                                color: 'primary.main',
                                                backgroundColor: 'rgba(79,142,247,0.14)',
                                            }}
                                        >
                                            {item.icon}
                                        </Box>
                                        <Box>
                                            <Typography variant="subtitle2">{item.title}</Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                                {item.description}
                                            </Typography>
                                        </Box>
                                    </Paper>
                                ))}
                            </Stack>
                        </Paper>
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <Paper
                            sx={{
                                p: { xs: 3, md: 4 },
                                maxWidth: 520,
                                mx: 'auto',
                            }}
                        >
                            <Typography variant="overline">Secure Access</Typography>
                            <Typography variant="h5" sx={{ mt: 0.75 }}>
                                Sign in to continue
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                Use your assigned manufacturing account to open the role-specific workspace.
                            </Typography>

                            {error ? (
                                <Alert severity="error" variant="filled" sx={{ mt: 2.5 }}>
                                    {error}
                                </Alert>
                            ) : null}

                            <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ mt: 2.5 }}>
                                <TextField
                                    fullWidth
                                    label="Work Email"
                                    type="email"
                                    margin="normal"
                                    {...register('email')}
                                    error={!!errors.email}
                                    helperText={errors.email?.message}
                                    disabled={isLoading}
                                />

                                <TextField
                                    fullWidth
                                    label="Password"
                                    type="password"
                                    margin="normal"
                                    {...register('password')}
                                    error={!!errors.password}
                                    helperText={errors.password?.message}
                                    disabled={isLoading}
                                />

                                <Button
                                    fullWidth
                                    variant="contained"
                                    size="large"
                                    sx={{ mt: 3 }}
                                    type="submit"
                                    disabled={isLoading || !isValid}
                                    startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
                                >
                                    {isLoading ? 'Signing in...' : 'Open Workspace'}
                                </Button>
                            </Box>

                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2.5 }}>
                                <Link
                                    component={RouterLink}
                                    to="#"
                                    onClick={(event) => {
                                        event.preventDefault();
                                        notify({ message: 'Contact your admin to reset password.', severity: 'info' });
                                    }}
                                    underline="hover"
                                    variant="body2"
                                >
                                    Forgot password?
                                </Link>
                                <Typography variant="caption" color="text.secondary">
                                    Role-aware access enforced
                                </Typography>
                            </Stack>

                            <Typography variant="caption" color="text.secondary" sx={{ mt: 3, display: 'block' }}>
                                {/* Demo credentials are managed by your backend environment and user setup. */}
                            </Typography>
                        </Paper>
                    </Grid>
                </Grid>
            </Container>
        </Box>
    );
};

export default LoginPage;

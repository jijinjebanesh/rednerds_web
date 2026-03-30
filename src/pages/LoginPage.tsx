import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Alert,
    Box,
    Button,
    Card,
    CircularProgress,
    Container,
    Link,
    TextField,
    Typography,
} from '@mui/material';
import { useAppDispatch } from '@/hooks/redux';
import { setUser, setToken, setError } from '@/store/authSlice';
import { authService } from '@/services';
import { useAppUI } from '@/context/AppUIContext';

const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

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
        <Container component="main" maxWidth="xs">
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100vh',
                }}
            >
                <Card sx={{ p: 4, width: '100%' }}>
                    <Box sx={{ textAlign: 'center', mb: 3 }}>
                        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                            REDNERDS Manufacturing System
                        </Typography>
                        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                            Sign in to your account
                        </Typography>
                    </Box>

                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit(onSubmit)}>
                        <TextField
                            fullWidth
                            label="Email"
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
                            color="primary"
                            size="large"
                            sx={{ mt: 3 }}
                            type="submit"
                            disabled={isLoading || !isValid}
                            startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
                        >
                            {isLoading ? 'Signing in...' : 'Sign In'}
                        </Button>
                    </form>

                    <Box sx={{ mt: 2, textAlign: 'right' }}>
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
                    </Box>

                    <Box sx={{ mt: 3, textAlign: 'center' }}>
                        <Typography variant="caption" color="textSecondary">
                            Demo credentials available | Check backend documentation
                        </Typography>
                    </Box>
                </Card>
            </Box>
        </Container>
    );
};

export default LoginPage;


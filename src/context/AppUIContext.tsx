import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Snackbar,
} from '@mui/material';

interface NotifyPayload {
    message: string;
    severity?: 'success' | 'info' | 'warning' | 'error';
}

interface ConfirmPayload {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    tone?: 'error' | 'primary';
}

interface AppUIContextValue {
    notify: (payload: NotifyPayload) => void;
    confirm: (payload: ConfirmPayload) => Promise<boolean>;
}

interface ConfirmState extends ConfirmPayload {
    open: boolean;
    resolve?: (result: boolean) => void;
}

const AppUIContext = createContext<AppUIContextValue | null>(null);

export const AppUIProvider = ({ children }: { children: React.ReactNode }) => {
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'info' | 'warning' | 'error'>('info');

    const [confirmState, setConfirmState] = useState<ConfirmState>({
        open: false,
        title: '',
        message: '',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        tone: 'primary',
    });

    const notify = useCallback((payload: NotifyPayload) => {
        setSnackbarMessage(payload.message);
        setSnackbarSeverity(payload.severity ?? 'info');
        setSnackbarOpen(true);
    }, []);

    const confirm = useCallback((payload: ConfirmPayload) => {
        return new Promise<boolean>((resolve) => {
            setConfirmState({
                open: true,
                resolve,
                title: payload.title,
                message: payload.message,
                confirmText: payload.confirmText ?? 'Confirm',
                cancelText: payload.cancelText ?? 'Cancel',
                tone: payload.tone ?? 'primary',
            });
        });
    }, []);

    const closeConfirm = (result: boolean) => {
        confirmState.resolve?.(result);
        setConfirmState((previous) => ({ ...previous, open: false, resolve: undefined }));
    };

    const value = useMemo(() => ({ notify, confirm }), [notify, confirm]);

    return (
        <AppUIContext.Provider value={value}>
            {children}

            <Snackbar
                open={snackbarOpen}
                autoHideDuration={3500}
                onClose={() => setSnackbarOpen(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} variant="filled" sx={{ width: '100%' }}>
                    {snackbarMessage}
                </Alert>
            </Snackbar>

            <Dialog open={confirmState.open} onClose={() => closeConfirm(false)}>
                <DialogTitle>{confirmState.title}</DialogTitle>
                <DialogContent>
                    <DialogContentText>{confirmState.message}</DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => closeConfirm(false)}>{confirmState.cancelText}</Button>
                    <Button
                        variant="contained"
                        color={confirmState.tone === 'error' ? 'error' : 'primary'}
                        onClick={() => closeConfirm(true)}
                    >
                        {confirmState.confirmText}
                    </Button>
                </DialogActions>
            </Dialog>
        </AppUIContext.Provider>
    );
};

export const useAppUI = () => {
    const context = useContext(AppUIContext);
    if (!context) {
        throw new Error('useAppUI must be used within AppUIProvider');
    }

    return context;
};

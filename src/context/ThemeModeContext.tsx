import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { AppColorMode, createAppTheme } from '@/theme';

interface ThemeModeContextValue {
    mode: AppColorMode;
    setMode: (mode: AppColorMode) => void;
    toggleMode: () => void;
}

const STORAGE_KEY = 'rednerds-color-mode';

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

export const ThemeModeProvider = ({ children }: { children: React.ReactNode }) => {
    const [mode, setModeState] = useState<AppColorMode>(() => {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        return stored === 'light' || stored === 'dark' ? stored : 'dark';
    });

    useEffect(() => {
        window.localStorage.setItem(STORAGE_KEY, mode);
    }, [mode]);

    const theme = useMemo(() => createAppTheme(mode), [mode]);

    const value = useMemo<ThemeModeContextValue>(
        () => ({
            mode,
            setMode: setModeState,
            toggleMode: () => {
                setModeState((previous) => (previous === 'dark' ? 'light' : 'dark'));
            },
        }),
        [mode]
    );

    return (
        <ThemeModeContext.Provider value={value}>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                {children}
            </ThemeProvider>
        </ThemeModeContext.Provider>
    );
};

export const useThemeMode = () => {
    const context = useContext(ThemeModeContext);
    if (!context) {
        throw new Error('useThemeMode must be used inside ThemeModeProvider');
    }

    return context;
};

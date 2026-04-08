import { alpha, createTheme, responsiveFontSizes } from '@mui/material/styles';

export type AppColorMode = 'light' | 'dark';

const TOKENS = {
    dark: {
        background: '#0F1117',
        surface: '#1A1D2E',
        elevated: '#21263D',
        card: alpha('#FFFFFF', 0.03),
        border: 'rgba(255,255,255,0.07)',
        primary: '#4F8EF7',
        secondary: '#00C9B1',
        success: '#4FD18B',
        warning: '#F7A84F',
        error: '#F75F5F',
        purple: '#A78BFA',
        orange: '#FB923C',
        textPrimary: '#F5F7FF',
        textSecondary: 'rgba(230,236,255,0.68)',
    },
    light: {
        background: '#F4F7FB',
        surface: '#FFFFFF',
        elevated: '#F7F9FF',
        card: alpha('#FFFFFF', 0.82),
        border: 'rgba(15,17,23,0.09)',
        primary: '#4F8EF7',
        secondary: '#00A999',
        success: '#1F9D62',
        warning: '#D9862E',
        error: '#DE4E4E',
        purple: '#8B5CF6',
        orange: '#F97316',
        textPrimary: '#121826',
        textSecondary: 'rgba(18,24,38,0.66)',
    },
} as const;

export const createAppTheme = (mode: AppColorMode) => {
    const token = TOKENS[mode];

    let theme = createTheme({
        palette: {
            mode,
            primary: { main: token.primary },
            secondary: { main: token.secondary },
            success: { main: token.success },
            warning: { main: token.warning },
            error: { main: token.error },
            background: {
                default: token.background,
                paper: token.surface,
            },
            text: {
                primary: token.textPrimary,
                secondary: token.textSecondary,
            },
            divider: token.border,
        },
        shape: {
            borderRadius: 10,
        },
        spacing: 8,
        typography: {
            fontFamily: '"Inter", "Segoe UI", sans-serif',
            fontSize: 14,
            h4: {
                fontWeight: 800,
                letterSpacing: '-0.03em',
            },
            h5: {
                fontWeight: 800,
                letterSpacing: '-0.02em',
            },
            h6: {
                fontWeight: 700,
            },
            subtitle1: {
                fontWeight: 700,
            },
            subtitle2: {
                fontWeight: 700,
                letterSpacing: '0.01em',
            },
            button: {
                fontWeight: 600,
                textTransform: 'none',
            },
            overline: {
                fontWeight: 700,
                letterSpacing: '0.16em',
                color: token.textSecondary,
            },
        },
    });

    theme = createTheme(theme, {
        components: {
            MuiCssBaseline: {
                styleOverrides: {
                    body: {
                        backgroundColor: token.background,
                        backgroundImage:
                            mode === 'dark'
                                ? 'radial-gradient(circle at top left, rgba(79,142,247,0.18), transparent 28%), radial-gradient(circle at top right, rgba(0,201,177,0.12), transparent 24%), linear-gradient(180deg, #0F1117 0%, #111524 44%, #0F1117 100%)'
                                : 'radial-gradient(circle at top left, rgba(79,142,247,0.16), transparent 24%), radial-gradient(circle at top right, rgba(0,201,177,0.10), transparent 20%), linear-gradient(180deg, #F6F9FF 0%, #EEF3FB 100%)',
                        minHeight: '100vh',
                    },
                    '#root': {
                        minHeight: '100vh',
                    },
                    '::selection': {
                        backgroundColor: alpha(token.primary, 0.32),
                    },
                },
            },
            MuiPaper: {
                styleOverrides: {
                    root: {
                        backgroundImage: 'none',
                        backgroundColor: token.surface,
                        border: `1px solid ${token.border}`,
                        backdropFilter: 'blur(10px)',
                    },
                },
            },
            MuiCard: {
                styleOverrides: {
                    root: {
                        backgroundColor: token.card,
                        border: `1px solid ${token.border}`,
                        backdropFilter: 'blur(10px)',
                        boxShadow: 'none',
                    },
                },
            },
            MuiAppBar: {
                styleOverrides: {
                    root: {
                        backgroundColor: alpha(token.surface, mode === 'dark' ? 0.82 : 0.9),
                        color: token.textPrimary,
                        borderBottom: `1px solid ${token.border}`,
                        backdropFilter: 'blur(16px)',
                        boxShadow: 'none',
                    },
                },
            },
            MuiDrawer: {
                styleOverrides: {
                    paper: {
                        backgroundColor: alpha(token.surface, mode === 'dark' ? 0.96 : 0.98),
                        borderRight: `1px solid ${token.border}`,
                        boxShadow: 'none',
                    },
                },
            },
            MuiButton: {
                defaultProps: {
                    disableElevation: true,
                },
                styleOverrides: {
                    root: {
                        borderRadius: 8,
                        paddingInline: 16,
                    },
                    containedPrimary: {
                        background: `linear-gradient(135deg, ${token.primary} 0%, ${alpha(token.primary, 0.78)} 100%)`,
                        color: '#F8FAFF',
                        '&:hover': {
                            background: `linear-gradient(135deg, ${alpha(token.primary, 0.92)} 0%, ${alpha(token.primary, 0.72)} 100%)`,
                        },
                    },
                    outlined: {
                        borderColor: alpha(token.primary, 0.38),
                    },
                },
            },
            MuiIconButton: {
                styleOverrides: {
                    root: {
                        borderRadius: 10,
                    },
                },
            },
            MuiChip: {
                styleOverrides: {
                    root: {
                        borderRadius: 20,
                        fontWeight: 600,
                    },
                },
            },
            MuiTextField: {
                defaultProps: {
                    variant: 'outlined',
                },
            },
            MuiOutlinedInput: {
                styleOverrides: {
                    root: {
                        borderRadius: 8,
                        backgroundColor: alpha(mode === 'dark' ? '#FFFFFF' : '#0F1117', mode === 'dark' ? 0.02 : 0.02),
                        '& fieldset': {
                            borderColor: token.border,
                        },
                        '&:hover fieldset': {
                            borderColor: alpha(token.primary, 0.54),
                        },
                        '&.Mui-focused fieldset': {
                            borderColor: token.primary,
                            boxShadow: `0 0 0 3px ${alpha(token.primary, 0.16)}`,
                        },
                    },
                    input: {
                        paddingBlock: 12,
                    },
                },
            },
            MuiSelect: {
                styleOverrides: {
                    select: {
                        minHeight: 'unset',
                    },
                },
            },
            MuiTableContainer: {
                styleOverrides: {
                    root: {
                        borderRadius: 16,
                        border: `1px solid ${token.border}`,
                    },
                },
            },
            MuiTableCell: {
                styleOverrides: {
                    root: {
                        borderBottom: `1px solid ${token.border}`,
                    },
                    head: {
                        backgroundColor: alpha(token.elevated, mode === 'dark' ? 0.92 : 0.88),
                        color: token.textSecondary,
                        fontSize: '0.78rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        fontWeight: 700,
                    },
                },
            },
            MuiTableHead: {
                styleOverrides: {
                    root: {
                        backgroundColor: alpha(token.elevated, mode === 'dark' ? 0.92 : 0.88),
                    },
                },
            },
            MuiTableRow: {
                styleOverrides: {
                    root: {
                        transition: 'background-color 160ms ease',
                        '&:hover': {
                            backgroundColor: alpha(token.primary, 0.06),
                        },
                    },
                },
            },
            MuiTabs: {
                styleOverrides: {
                    indicator: {
                        height: 3,
                        borderRadius: 999,
                        backgroundColor: token.primary,
                    },
                },
            },
            MuiTab: {
                styleOverrides: {
                    root: {
                        minHeight: 52,
                        textTransform: 'none',
                        fontWeight: 600,
                    },
                },
            },
            MuiDialog: {
                styleOverrides: {
                    paper: {
                        borderRadius: 18,
                        backgroundColor: alpha(token.elevated, mode === 'dark' ? 0.94 : 0.97),
                        border: `1px solid ${token.border}`,
                    },
                },
            },
            MuiAlert: {
                styleOverrides: {
                    root: {
                        borderRadius: 12,
                    },
                },
            },
            MuiTooltip: {
                styleOverrides: {
                    tooltip: {
                        borderRadius: 10,
                        border: `1px solid ${token.border}`,
                        backgroundColor: alpha(token.elevated, 0.96),
                    },
                },
            },
            MuiSkeleton: {
                styleOverrides: {
                    root: {
                        backgroundColor: alpha(mode === 'dark' ? '#FFFFFF' : '#0F1117', 0.08),
                    },
                },
            },
        },
    });

    return responsiveFontSizes(theme);
};

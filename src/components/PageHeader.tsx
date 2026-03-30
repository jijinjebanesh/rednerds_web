import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

interface PrimaryAction {
    label: string;
    onClick: () => void;
    disabled?: boolean;
}

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    countLabel?: string;
    onRefresh?: () => void;
    isRefreshing?: boolean;
    primaryAction?: PrimaryAction;
}

const PageHeader = ({
    title,
    subtitle,
    countLabel,
    onRefresh,
    isRefreshing = false,
    primaryAction,
}: PageHeaderProps) => {
    return (
        <Stack
            direction={{ xs: 'column', md: 'row' }}
            alignItems={{ xs: 'flex-start', md: 'center' }}
            justifyContent="space-between"
            gap={2}
            sx={{ mb: 2.5 }}
        >
            <Box>
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {title}
                </Typography>
                {subtitle && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {subtitle}
                    </Typography>
                )}
            </Box>

            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                {countLabel && <Chip size="small" label={countLabel} color="default" />}

                {onRefresh && (
                    <Button
                        variant="outlined"
                        startIcon={<RefreshIcon fontSize="small" />}
                        onClick={onRefresh}
                        disabled={isRefreshing}
                    >
                        {isRefreshing ? 'Refreshing...' : 'Refresh'}
                    </Button>
                )}

                {primaryAction && (
                    <Button variant="contained" onClick={primaryAction.onClick} disabled={primaryAction.disabled}>
                        {primaryAction.label}
                    </Button>
                )}
            </Stack>
        </Stack>
    );
};

export default PageHeader;


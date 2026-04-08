import { Box, Button, Stack, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import StatusChip from '@/components/ui/StatusChip';

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
            sx={{
                mb: 3,
                p: { xs: 2, md: 2.5 },
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider',
                background: 'linear-gradient(135deg, rgba(79,142,247,0.10) 0%, rgba(0,201,177,0.06) 100%)',
                backdropFilter: 'blur(10px)',
            }}
        >
            <Box>
                <Typography variant="overline">Operations Workspace</Typography>
                <Typography variant="h5" sx={{ mt: 0.25 }}>
                    {title}
                </Typography>
                {subtitle ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 720 }}>
                        {subtitle}
                    </Typography>
                ) : null}
            </Box>

            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                {countLabel ? <StatusChip label={countLabel} /> : null}

                {onRefresh ? (
                    <Button
                        variant="outlined"
                        startIcon={<RefreshIcon fontSize="small" />}
                        onClick={onRefresh}
                        disabled={isRefreshing}
                    >
                        {isRefreshing ? 'Refreshing...' : 'Refresh'}
                    </Button>
                ) : null}

                {primaryAction ? (
                    <Button variant="contained" onClick={primaryAction.onClick} disabled={primaryAction.disabled}>
                        {primaryAction.label}
                    </Button>
                ) : null}
            </Stack>
        </Stack>
    );
};

export default PageHeader;

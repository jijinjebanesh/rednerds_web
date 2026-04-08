import { Box, Card, CardContent, LinearProgress, Stack, Tooltip, Typography, alpha, useTheme } from '@mui/material';

interface MetricCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon?: React.ReactNode;
    accent?: string;
    trend?: string;
    tooltip?: string;
    progress?: number;
}

const MetricCard = ({ title, value, subtitle, icon, accent, trend, tooltip, progress }: MetricCardProps) => {
    const theme = useTheme();
    const highlight = accent ?? theme.palette.primary.main;

    const content = (
        <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2.25 } }}>
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
                    <Box>
                        <Typography variant="overline">{title}</Typography>
                        <Typography variant="h5" sx={{ mt: 0.5 }}>
                            {value}
                        </Typography>
                    </Box>
                    {icon ? (
                        <Box
                            sx={{
                                width: 42,
                                height: 42,
                                borderRadius: 2.5,
                                display: 'grid',
                                placeItems: 'center',
                                color: highlight,
                                backgroundColor: alpha(highlight, 0.15),
                                border: `1px solid ${alpha(highlight, 0.28)}`,
                            }}
                        >
                            {icon}
                        </Box>
                    ) : null}
                </Stack>

                {(subtitle || trend) && (
                    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5} sx={{ mt: 1.5 }}>
                        <Typography variant="body2" color="text.secondary">
                            {subtitle}
                        </Typography>
                        {trend ? (
                            <Typography variant="caption" sx={{ fontWeight: 700, color: highlight }}>
                                {trend}
                            </Typography>
                        ) : null}
                    </Stack>
                )}

                {typeof progress === 'number' ? (
                    <LinearProgress
                        variant="determinate"
                        value={Math.max(0, Math.min(100, progress))}
                        sx={{
                            mt: 1.5,
                            height: 7,
                            borderRadius: 999,
                            backgroundColor: alpha(highlight, 0.12),
                            '& .MuiLinearProgress-bar': {
                                borderRadius: 999,
                                backgroundColor: highlight,
                            },
                        }}
                    />
                ) : null}
            </CardContent>
        </Card>
    );

    return tooltip ? <Tooltip title={tooltip}>{content}</Tooltip> : content;
};

export default MetricCard;

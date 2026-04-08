import { Box, Button, Stack, Typography } from '@mui/material';

interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description: string;
    action?: {
        label: string;
        onClick: () => void;
    };
}

const EmptyState = ({ icon, title, description, action }: EmptyStateProps) => {
    return (
        <Stack
            spacing={1.5}
            alignItems="center"
            justifyContent="center"
            sx={{
                py: 7,
                px: 3,
                textAlign: 'center',
                borderRadius: 3,
                border: '1px dashed',
                borderColor: 'divider',
                backgroundColor: 'rgba(255,255,255,0.02)',
            }}
        >
            {icon ? (
                <Box
                    sx={{
                        width: 58,
                        height: 58,
                        borderRadius: '50%',
                        display: 'grid',
                        placeItems: 'center',
                        color: 'primary.main',
                        backgroundColor: 'rgba(79,142,247,0.12)',
                    }}
                >
                    {icon}
                </Box>
            ) : null}
            <Typography variant="h6">{title}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
                {description}
            </Typography>
            {action ? (
                <Button variant="contained" onClick={action.onClick}>
                    {action.label}
                </Button>
            ) : null}
        </Stack>
    );
};

export default EmptyState;

import { Box, Drawer, IconButton, Stack, Typography } from '@mui/material';
import { X } from 'lucide-react';

interface ActionDrawerProps {
    open: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    children: React.ReactNode;
}

const ActionDrawer = ({ open, onClose, title, subtitle, children }: ActionDrawerProps) => {
    return (
        <Drawer anchor="right" open={open} onClose={onClose}>
            <Box
                sx={{
                    width: { xs: '100vw', md: 480 },
                    maxWidth: '100vw',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                }}
                role="dialog"
                aria-label={title}
            >
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2} sx={{ px: 3, py: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Box>
                        <Typography variant="h6">{title}</Typography>
                        {subtitle ? (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                {subtitle}
                            </Typography>
                        ) : null}
                    </Box>
                    <IconButton onClick={onClose} aria-label="Close drawer">
                        <X size={18} />
                    </IconButton>
                </Stack>
                <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2.5 }}>{children}</Box>
            </Box>
        </Drawer>
    );
};

export default ActionDrawer;

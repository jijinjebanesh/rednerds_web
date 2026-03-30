import { Box, Button, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const ForbiddenPage = () => {
    const navigate = useNavigate();

    return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                403
            </Typography>
            <Typography variant="h5" sx={{ mb: 1 }}>
                Access Denied
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Your role does not have permission to open this page.
            </Typography>
            <Button variant="contained" onClick={() => navigate('/')}>Go to Dashboard</Button>
        </Box>
    );
};

export default ForbiddenPage;

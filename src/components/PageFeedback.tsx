import { Alert, Box, LinearProgress } from '@mui/material';

interface PageFeedbackProps {
    isLoading?: boolean;
    error?: string | null;
}

const PageFeedback = ({ isLoading = false, error }: PageFeedbackProps) => {
    if (!isLoading && !error) {
        return null;
    }

    return (
        <Box sx={{ mb: 2 }}>
            {isLoading && <LinearProgress sx={{ mb: error ? 1.5 : 0 }} />}
            {error && <Alert severity="error">{error}</Alert>}
        </Box>
    );
};

export default PageFeedback;

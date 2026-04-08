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
            {isLoading ? (
                <LinearProgress
                    sx={{
                        mb: error ? 1.5 : 0,
                        borderRadius: 999,
                        height: 6,
                        backgroundColor: 'rgba(79,142,247,0.12)',
                    }}
                />
            ) : null}
            {error ? (
                <Alert severity="error" variant="filled">
                    {error}
                </Alert>
            ) : null}
        </Box>
    );
};

export default PageFeedback;

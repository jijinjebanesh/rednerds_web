import { Stack, Typography } from '@mui/material';

const SectionLabel = ({ eyebrow, title, caption }: { eyebrow: string; title: string; caption?: string }) => {
    return (
        <Stack spacing={0.5} sx={{ mb: 2 }}>
            <Typography variant="overline">{eyebrow}</Typography>
            <Typography variant="h6">{title}</Typography>
            {caption ? (
                <Typography variant="body2" color="text.secondary">
                    {caption}
                </Typography>
            ) : null}
        </Stack>
    );
};

export default SectionLabel;

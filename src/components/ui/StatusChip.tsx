import { Chip, ChipProps, alpha, useTheme } from '@mui/material';
import { toTitle } from '@/utils/workflowOptions';

interface StatusChipProps extends Omit<ChipProps, 'label' | 'color'> {
    value?: string | null;
    label?: string;
}

const getSemanticColor = (value: string, themeMode: 'light' | 'dark') => {
    const normalized = value.trim().toLowerCase();

    if (['active', 'pass', 'passed', 'resolved', 'completed', 'grade a', 'a'].includes(normalized)) {
        return { bg: alpha('#4FD18B', themeMode === 'dark' ? 0.18 : 0.14), color: '#4FD18B', border: alpha('#4FD18B', 0.34) };
    }

    if (['b', 'grade b'].includes(normalized)) {
        return { bg: alpha('#00C9B1', themeMode === 'dark' ? 0.18 : 0.14), color: '#00C9B1', border: alpha('#00C9B1', 0.34) };
    }

    if (['in_progress', 'partial', 'partially_resolved', 'awaiting_parts', 'received', 'c', 'grade c'].includes(normalized)) {
        return { bg: alpha('#F7A84F', themeMode === 'dark' ? 0.18 : 0.14), color: '#F7A84F', border: alpha('#F7A84F', 0.34) };
    }

    if (['repair', 'returned_to_customer', 'd', 'grade d'].includes(normalized)) {
        return { bg: alpha('#FB923C', themeMode === 'dark' ? 0.18 : 0.14), color: '#FB923C', border: alpha('#FB923C', 0.34) };
    }

    if (['qc', 'quality', 'quality grading'].includes(normalized)) {
        return { bg: alpha('#A78BFA', themeMode === 'dark' ? 0.18 : 0.14), color: '#A78BFA', border: alpha('#A78BFA', 0.34) };
    }

    if (['fail', 'failed', 'scrapped', 'scrap', 'unrepairable', 'returned', 'unresolved'].includes(normalized)) {
        return { bg: alpha('#F75F5F', themeMode === 'dark' ? 0.18 : 0.14), color: '#F75F5F', border: alpha('#F75F5F', 0.34) };
    }

    return {
        bg: alpha(themeMode === 'dark' ? '#FFFFFF' : '#0F1117', themeMode === 'dark' ? 0.08 : 0.06),
        color: themeMode === 'dark' ? '#DCE4FF' : '#1A2236',
        border: alpha(themeMode === 'dark' ? '#FFFFFF' : '#0F1117', 0.12),
    };
};

const StatusChip = ({ value, label, sx, ...props }: StatusChipProps) => {
    const theme = useTheme();
    const text = label ?? (value ? toTitle(value) : '-');
    const colors = getSemanticColor(value ?? label ?? '', theme.palette.mode);

    return (
        <Chip
            label={text}
            size="small"
            sx={{
                backgroundColor: colors.bg,
                color: colors.color,
                border: `1px solid ${colors.border}`,
                fontWeight: 700,
                '& .MuiChip-label': {
                    px: 1.4,
                },
                ...sx,
            }}
            {...props}
        />
    );
};

export default StatusChip;

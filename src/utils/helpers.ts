export const formatDate = (date: string | Date): string => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};

export const formatDateTime = (date: string | Date): string => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

export const formatMacAddress = (mac: string): string => {
    return mac.toUpperCase();
};

export const validateMacAddress = (mac: string): boolean => {
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    return macRegex.test(mac);
};

export const getStatusColor = (status: string): string => {
    const statusColors: Record<string, string> = {
        active: 'success',
        shipped: 'success',
        resolved: 'success',
        development: 'info',
        planned: 'info',
        in_progress: 'warning',
        discontinued: 'error',
        failed: 'error',
        partial: 'warning',
        repair: 'error',
        returned: 'error',
        testing: 'info',
        qc: 'warning',
        stock: 'success',
        flashing: 'info',
        customer: 'success',
        debugging: 'warning',
    };

    return statusColors[status] || 'default';
};

export const getStageColor = (stage: string): string => {
    const stageColors: Record<string, string> = {
        flashing: 'info',
        testing: 'warning',
        qc: 'warning',
        stock: 'success',
        shipped: 'success',
        repair: 'error',
        customer: 'success',
        debugging: 'warning',
    };

    return stageColors[stage] || 'default';
};

export const pagination = {
    calculateSkip: (page: number, limit: number) => (page - 1) * limit,
    calculateTotalPages: (total: number, limit: number) => Math.ceil(total / limit),
};

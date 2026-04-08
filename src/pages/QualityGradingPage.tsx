import { useEffect, useMemo, useState } from 'react';
import {
    Box,
    Button,
    Card,
    CardContent,
    Grid,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { CheckCircle2, Search, ShieldCheck, Trash2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import PageFeedback from '@/components/PageFeedback';
import StatusChip from '@/components/ui/StatusChip';
import MetricCard from '@/components/ui/MetricCard';
import EmptyState from '@/components/ui/EmptyState';
import ActionDrawer from '@/components/ui/ActionDrawer';
import { productService } from '@/services';
import { Product, ProductQualityGrade } from '@/types';
import { useAppUI } from '@/context/AppUIContext';

const QUALITY_GRADE_OPTIONS: ProductQualityGrade[] = ['A', 'B', 'C', 'D', 'SCRAP'];

const normalizeQualityGrade = (grade?: string | null): ProductQualityGrade | null => {
    if (!grade) return null;
    const normalized = String(grade).trim().toUpperCase();
    return QUALITY_GRADE_OPTIONS.includes(normalized as ProductQualityGrade) ? (normalized as ProductQualityGrade) : null;
};

const getGradeAccent = (grade: ProductQualityGrade) => {
    switch (grade) {
        case 'A':
            return '#4FD18B';
        case 'B':
            return '#00C9B1';
        case 'C':
            return '#F7A84F';
        case 'D':
            return '#FB923C';
        case 'SCRAP':
            return '#F75F5F';
        default:
            return '#4F8EF7';
    }
};

const QualityGradingPage = () => {
    const { notify, confirm } = useAppUI();
    const [products, setProducts] = useState<Product[]>([]);
    const [search, setSearch] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [pendingGrade, setPendingGrade] = useState<ProductQualityGrade | ''>('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [savingProductId, setSavingProductId] = useState<string | null>(null);

    const loadProducts = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await productService.getProducts(1, 2000, { current_stage: 'qc' });
            setProducts(response.data);
        } catch (err: any) {
            setError(err?.response?.data?.message || err?.message || 'Failed to load products');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadProducts();
    }, []);

    const filteredProducts = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return products;

        return products.filter((product) => {
            return (
                product.product_id.toLowerCase().includes(term) ||
                product.mac_address.toLowerCase().includes(term) ||
                product.model_variant.toLowerCase().includes(term) ||
                product.batch_id.toLowerCase().includes(term)
            );
        });
    }, [products, search]);

    const summary = useMemo(() => {
        const current = filteredProducts.reduce(
            (accumulator, product) => {
                const grade = normalizeQualityGrade(product.quality_grade);
                if (grade) accumulator.graded += 1;
                if (grade === 'SCRAP') accumulator.scrap += 1;
                return accumulator;
            },
            { graded: 0, scrap: 0 }
        );

        return {
            total: filteredProducts.length,
            waiting: filteredProducts.length - current.graded,
            graded: current.graded,
            scrap: current.scrap,
        };
    }, [filteredProducts]);

    const openDrawer = (product: Product) => {
        setSelectedProduct(product);
        setPendingGrade(normalizeQualityGrade(product.quality_grade) ?? '');
    };

    const handleSaveQuality = async () => {
        if (!selectedProduct || !pendingGrade) {
            notify({ message: 'Select a grade before saving.', severity: 'warning' });
            return;
        }

        if (pendingGrade === 'SCRAP') {
            const approved = await confirm({
                title: 'Confirm Scrap Grading',
                message: `Mark ${selectedProduct.product_id} as SCRAP? The product will move into the scrapped outcome.`,
                confirmText: 'Confirm Scrap',
                tone: 'error',
            });

            if (!approved) return;
        }

        try {
            setSavingProductId(selectedProduct.product_id);
            const updated = await productService.updateProductQuality(selectedProduct.product_id, pendingGrade);
            setProducts((previous) => previous.filter((item) => item.product_id !== selectedProduct.product_id).concat(updated));
            notify({ message: `Grade ${pendingGrade} saved for ${selectedProduct.product_id}.`, severity: 'success' });
            setSelectedProduct(null);
            setPendingGrade('');
            await loadProducts();
        } catch (err: any) {
            notify({ message: err?.response?.data?.message || err?.message || 'Failed to save quality grade', severity: 'error' });
        } finally {
            setSavingProductId(null);
        }
    };

    return (
        <Box>
            <PageHeader
                title="QC Quality Grading"
                subtitle="Review only the products currently in QC stage, then assign a final quality outcome."
                countLabel={`${summary.total} in QC`}
                onRefresh={loadProducts}
                isRefreshing={isLoading}
            />

            <PageFeedback isLoading={isLoading} error={error} />

            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={3}>
                    <MetricCard title="Waiting For Grade" value={summary.waiting} subtitle="Still in QC queue" icon={<ShieldCheck size={18} />} progress={summary.total ? (summary.waiting / summary.total) * 100 : 0} />
                </Grid>
                <Grid item xs={12} md={3}>
                    <MetricCard title="Graded" value={summary.graded} subtitle="Products already finalized" icon={<CheckCircle2 size={18} />} accent="#00C9B1" />
                </Grid>
                <Grid item xs={12} md={3}>
                    <MetricCard title="Scrap Count" value={summary.scrap} subtitle="Critical QC rejects" icon={<Trash2 size={18} />} accent="#F75F5F" />
                </Grid>
                <Grid item xs={12} md={3}>
                    <MetricCard title="Search Scope" value={summary.total} subtitle="Filtered live from QC stage only" icon={<Search size={18} />} accent="#A78BFA" />
                </Grid>
            </Grid>

            <TextField
                fullWidth
                placeholder="Search by product ID, MAC address, model variant, or batch"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                sx={{ mb: 3 }}
            />

            {filteredProducts.length === 0 && !isLoading ? (
                <EmptyState
                    icon={<ShieldCheck size={24} />}
                    title="No QC products available"
                    description="When products reach the QC stage they will appear here for grading."
                />
            ) : (
                <Grid container spacing={2}>
                    {filteredProducts.map((product) => (
                        <Grid item xs={12} md={6} xl={4} key={product._id}>
                            <Card
                                sx={{
                                    height: '100%',
                                    cursor: 'pointer',
                                    transition: 'transform 160ms ease, border-color 160ms ease',
                                    '&:hover': {
                                        transform: 'translateY(-2px)',
                                        borderColor: 'primary.main',
                                    },
                                }}
                                onClick={() => openDrawer(product)}
                            >
                                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                                        <Box>
                                            <Typography variant="overline">Product</Typography>
                                            <Typography variant="h6">{product.product_id}</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {product.model_variant}
                                            </Typography>
                                        </Box>
                                        <StatusChip value={product.quality_grade ?? 'qc'} label={product.quality_grade ? `Grade ${product.quality_grade}` : 'QC Stage'} />
                                    </Stack>

                                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                        <StatusChip value={product.current_stage} />
                                        <StatusChip value={product.status} />
                                        <StatusChip label={product.batch_id} />
                                    </Stack>

                                    <Box>
                                        <Typography variant="body2" color="text.secondary">
                                            MAC Address
                                        </Typography>
                                        <Typography variant="subtitle2" sx={{ mt: 0.5 }}>
                                            {product.mac_address}
                                        </Typography>
                                    </Box>

                                    <Box sx={{ mt: 'auto' }}>
                                        <Typography variant="body2" color="text.secondary">
                                            Entered QC
                                        </Typography>
                                        <Typography variant="subtitle2" sx={{ mt: 0.5 }}>
                                            {new Date(product.updated_at ?? product.updatedAt ?? product.manufactured_at).toLocaleString()}
                                        </Typography>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            <ActionDrawer
                open={Boolean(selectedProduct)}
                onClose={() => setSelectedProduct(null)}
                title={selectedProduct ? `Grade ${selectedProduct.product_id}` : 'Assign Grade'}
                subtitle={selectedProduct ? `${selectedProduct.model_variant} • ${selectedProduct.batch_id}` : undefined}
            >
                {selectedProduct ? (
                    <Stack spacing={3}>
                        <Box>
                            <Typography variant="body2" color="text.secondary">
                                MAC Address
                            </Typography>
                            <Typography variant="subtitle1" sx={{ mt: 0.5 }}>
                                {selectedProduct.mac_address}
                            </Typography>
                        </Box>

                        <Grid container spacing={1.5}>
                            {QUALITY_GRADE_OPTIONS.map((grade) => (
                                <Grid item xs={12} sm={6} key={grade}>
                                    <Button
                                        fullWidth
                                        variant={pendingGrade === grade ? 'contained' : 'outlined'}
                                        onClick={() => setPendingGrade(grade)}
                                        sx={{
                                            py: 1.4,
                                            borderColor: getGradeAccent(grade),
                                            color: pendingGrade === grade ? '#FFFFFF' : getGradeAccent(grade),
                                            backgroundColor: pendingGrade === grade ? getGradeAccent(grade) : 'transparent',
                                            '&:hover': {
                                                borderColor: getGradeAccent(grade),
                                                backgroundColor: pendingGrade === grade ? getGradeAccent(grade) : `${getGradeAccent(grade)}18`,
                                            },
                                        }}
                                    >
                                        {grade === 'SCRAP' ? 'SCRAP' : `Grade ${grade}`}
                                    </Button>
                                </Grid>
                            ))}
                        </Grid>

                        <Box
                            sx={{
                                p: 2,
                                borderRadius: 2.5,
                                border: '1px solid',
                                borderColor: 'divider',
                                backgroundColor: 'rgba(255,255,255,0.02)',
                            }}
                        >
                            <Typography variant="subtitle2">Current Audit Snapshot</Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
                                <StatusChip value={selectedProduct.current_stage} />
                                <StatusChip value={selectedProduct.status} />
                                <StatusChip value={selectedProduct.quality_grade ?? 'not graded'} label={selectedProduct.quality_grade ? `Grade ${selectedProduct.quality_grade}` : 'Not graded yet'} />
                            </Stack>
                            {selectedProduct.quality_graded_by_name || selectedProduct.quality_graded_at ? (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                                    Last graded by {selectedProduct.quality_graded_by_name || selectedProduct.quality_graded_by_email || selectedProduct.quality_graded_by}{' '}
                                    {selectedProduct.quality_graded_at ? `on ${new Date(selectedProduct.quality_graded_at).toLocaleString()}` : ''}
                                </Typography>
                            ) : null}
                        </Box>

                        <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
                            <Button variant="outlined" onClick={() => setSelectedProduct(null)}>
                                Cancel
                            </Button>
                            <Button variant="contained" onClick={() => void handleSaveQuality()} disabled={!pendingGrade || savingProductId === selectedProduct.product_id}>
                                {savingProductId === selectedProduct.product_id ? 'Saving...' : 'Save Grade'}
                            </Button>
                        </Stack>
                    </Stack>
                ) : null}
            </ActionDrawer>
        </Box>
    );
};

export default QualityGradingPage;

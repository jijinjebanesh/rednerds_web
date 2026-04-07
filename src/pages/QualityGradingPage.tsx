import { useEffect, useMemo, useState } from 'react';
import {
    Box,
    Button,
    MenuItem,
    Paper,
    Select,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from '@mui/material';
import PageHeader from '@/components/PageHeader';
import PageFeedback from '@/components/PageFeedback';
import { productService } from '@/services';
import { Product, ProductQualityGrade } from '@/types';
import { useAppUI } from '@/context/AppUIContext';

const QUALITY_GRADE_OPTIONS: ProductQualityGrade[] = ['A', 'B', 'C', 'D', 'SCRAP'];

const normalizeQualityGrade = (grade?: string | null): ProductQualityGrade | null => {
    if (!grade) return null;
    const normalized = String(grade).trim().toUpperCase();
    if (QUALITY_GRADE_OPTIONS.includes(normalized as ProductQualityGrade)) {
        return normalized as ProductQualityGrade;
    }
    return null;
};

const QualityGradingPage = () => {
    const { notify } = useAppUI();

    const [products, setProducts] = useState<Product[]>([]);
    const [search, setSearch] = useState('');
    const [pendingGrades, setPendingGrades] = useState<Record<string, ProductQualityGrade | ''>>({});

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [savingProductId, setSavingProductId] = useState<string | null>(null);

    const loadProducts = async () => {
        try {
            setIsLoading(true);
            setError(null);

            const response = await productService.getProducts(1, 2000, { current_stage: 'qc' });
            setProducts(response.data);

            const initialPending: Record<string, ProductQualityGrade | ''> = {};
            for (const product of response.data) {
                initialPending[product.product_id] = normalizeQualityGrade(product.quality_grade) ?? '';
            }
            setPendingGrades(initialPending);
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

        return products.filter((product) => (
            product.product_id.toLowerCase().includes(term) ||
            product.mac_address.toLowerCase().includes(term) ||
            product.batch_id.toLowerCase().includes(term) ||
            product.project_id.toLowerCase().includes(term)
        ));
    }, [products, search]);

    const handleGradeChange = (productId: string, grade: ProductQualityGrade | '') => {
        setPendingGrades((prev) => ({
            ...prev,
            [productId]: grade,
        }));
    };

    const handleSaveQuality = async (product: Product) => {
        const selectedGrade = pendingGrades[product.product_id];
        if (!selectedGrade) {
            notify({ message: 'Select a quality grade before saving.', severity: 'warning' });
            return;
        }

        try {
            setSavingProductId(product.product_id);
            const updated = await productService.updateProductQuality(product.product_id, selectedGrade);

            setProducts((prev) => prev.map((item) => (
                item.product_id === product.product_id ? updated : item
            )));
            setPendingGrades((prev) => ({
                ...prev,
                [product.product_id]: normalizeQualityGrade(updated.quality_grade) ?? selectedGrade,
            }));

            notify({ message: `Quality saved for ${product.product_id}.`, severity: 'success' });
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
                subtitle="QC Engineer can assign product quality grades: A, B, C, D, or SCRAP."
                countLabel={`${filteredProducts.length} products`}
                onRefresh={loadProducts}
                isRefreshing={isLoading}
            />

            <PageFeedback isLoading={isLoading} error={error} />

            <Box sx={{ mb: 2 }}>
                <TextField
                    fullWidth
                    placeholder="Search by product ID, MAC, batch, or project"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                />
            </Box>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>Product ID</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>MAC Address</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Current Stage</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Current Grade</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Update Grade</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Action</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredProducts.length === 0 && !isLoading && (
                            <TableRow>
                                <TableCell colSpan={7} sx={{ py: 3 }}>
                                    <Typography color="text.secondary">No products found.</Typography>
                                </TableCell>
                            </TableRow>
                        )}

                        {filteredProducts.map((product) => {
                            const selectedGrade = pendingGrades[product.product_id] ?? '';
                            const currentGrade = normalizeQualityGrade(product.quality_grade) ?? '';
                            const hasGradeChanged = selectedGrade !== currentGrade;

                            return (
                                <TableRow key={product._id} hover>
                                    <TableCell>{product.product_id}</TableCell>
                                    <TableCell>{product.mac_address}</TableCell>
                                    <TableCell>{product.current_stage}</TableCell>
                                    <TableCell>{product.status}</TableCell>
                                    <TableCell>{currentGrade || '-'}</TableCell>
                                    <TableCell>
                                        <Select
                                            size="small"
                                            value={selectedGrade}
                                            displayEmpty
                                            onChange={(event) => handleGradeChange(product.product_id, event.target.value as ProductQualityGrade | '')}
                                        >
                                            <MenuItem value="">Select Grade</MenuItem>
                                            {QUALITY_GRADE_OPTIONS.map((grade) => (
                                                <MenuItem key={grade} value={grade}>
                                                    {grade}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant="contained"
                                            size="small"
                                            onClick={() => handleSaveQuality(product)}
                                            disabled={!selectedGrade || !hasGradeChanged || savingProductId === product.product_id}
                                        >
                                            Save
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default QualityGradingPage;

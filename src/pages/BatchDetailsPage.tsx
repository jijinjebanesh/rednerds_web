import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Box,
    Button,
    Card,
    CardContent,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';
import { batchService, productService } from '@/services';
import { Batch, Product } from '@/types';
import PageHeader from '@/components/PageHeader';
import PageFeedback from '@/components/PageFeedback';
import { toTitle } from '@/utils/workflowOptions';

const BatchDetailsPage = () => {
    const navigate = useNavigate();
    const { batchId } = useParams<{ batchId: string }>();

    const [batch, setBatch] = useState<Batch | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (batchId) {
            void loadBatchDetails();
        }
    }, [batchId]);

    const loadBatchDetails = async () => {
        if (!batchId) return;

        try {
            setIsLoading(true);
            setError(null);

            const [batchData, productsRes] = await Promise.all([
                batchService.getBatchById(batchId),
                productService.getProductsByBatch(batchId, 1, 500),
            ]);

            setBatch(batchData);
            setProducts(productsRes.data);
        } catch (err: any) {
            setError(err?.response?.data?.message || err?.message || 'Failed to load batch details');
            setBatch(null);
            setProducts([]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Box>
            <PageHeader
                title={batch ? `Batch ${batch._id}` : 'Batch Details'}
                subtitle={batch ? `${batch.model_variant} • ${toTitle(batch.status)}` : 'Inspect batch metadata and product units.'}
                onRefresh={loadBatchDetails}
                isRefreshing={isLoading}
            />

            <PageFeedback isLoading={isLoading} error={error} />

            {batch && (
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2 }}>
                            <Box>
                                <Typography color="text.secondary">Project ID</Typography>
                                <Typography sx={{ fontWeight: 700 }}>{batch.project_id}</Typography>
                            </Box>
                            <Box>
                                <Typography color="text.secondary">Planned Qty</Typography>
                                <Typography sx={{ fontWeight: 700 }}>{batch.planned_qty}</Typography>
                            </Box>
                            <Box>
                                <Typography color="text.secondary">Produced Qty</Typography>
                                <Typography sx={{ fontWeight: 700 }}>{batch.produced_qty}</Typography>
                            </Box>
                        </Box>

                        {batch.notes && (
                            <Box sx={{ mt: 2 }}>
                                <Typography color="text.secondary">Notes</Typography>
                                <Typography>{batch.notes}</Typography>
                            </Box>
                        )}
                    </CardContent>
                </Card>
            )}

            <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
                Products in This Batch ({products.length})
            </Typography>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>Product ID</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>MAC Address</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Stage</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Action</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {products.length === 0 && !isLoading && (
                            <TableRow>
                                <TableCell colSpan={5} sx={{ py: 3 }}>
                                    <Typography color="text.secondary">No products in this batch yet.</Typography>
                                </TableCell>
                            </TableRow>
                        )}

                        {products.map((product) => (
                            <TableRow key={product._id} hover>
                                <TableCell>{product.product_id}</TableCell>
                                <TableCell>{product.mac_address}</TableCell>
                                <TableCell>{toTitle(product.current_stage)}</TableCell>
                                <TableCell>{toTitle(product.status)}</TableCell>
                                <TableCell>
                                    <Button size="small" onClick={() => navigate(`/manufacturing/products/${product.product_id}`)}>
                                        View Product
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default BatchDetailsPage;


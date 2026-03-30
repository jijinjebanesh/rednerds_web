import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from '@/store';
import ProtectedRoute from '@/components/ProtectedRoute';
import { AppUIProvider } from '@/context/AppUIContext';
import LoginPage from '@/pages/LoginPage';
import ForbiddenPage from '@/pages/ForbiddenPage';
import DashboardPage from '@/pages/DashboardPage';
import ProjectsPage from '@/pages/ProjectsPage';
import ProjectDetailsPage from '@/pages/ProjectDetailsPage';
import BatchesPage from '@/pages/BatchesPage';
import BatchDetailsPage from '@/pages/BatchDetailsPage';
import ProductsPage from '@/pages/ProductsPage';
import ProductDetailsPage from '@/pages/ProductDetailsPage';
import TestingPage from '@/pages/TestingPage';
import DebuggingPage from '@/pages/DebuggingPage';
import RepairsPage from '@/pages/RepairsPage';
import RepairDetailsPage from '@/pages/RepairDetailsPage';
import UsersPage from '@/pages/UsersPage';

function App() {
    return (
        <Provider store={store}>
            <AppUIProvider>
                <Router>
                    <Routes>
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/forbidden" element={<ForbiddenPage />} />

                        <Route
                            path="/"
                            element={
                                <ProtectedRoute>
                                    <DashboardPage />
                                </ProtectedRoute>
                            }
                        />

                        <Route
                            path="/manufacturing/projects"
                            element={
                                <ProtectedRoute>
                                    <ProjectsPage />
                                </ProtectedRoute>
                            }
                        />

                        <Route
                            path="/manufacturing/projects/:projectId"
                            element={
                                <ProtectedRoute>
                                    <ProjectDetailsPage />
                                </ProtectedRoute>
                            }
                        />

                        <Route
                            path="/manufacturing/batches"
                            element={
                                <ProtectedRoute>
                                    <BatchesPage />
                                </ProtectedRoute>
                            }
                        />

                        <Route
                            path="/manufacturing/batches/:batchId"
                            element={
                                <ProtectedRoute>
                                    <BatchDetailsPage />
                                </ProtectedRoute>
                            }
                        />

                        <Route
                            path="/manufacturing/products"
                            element={
                                <ProtectedRoute>
                                    <ProductsPage />
                                </ProtectedRoute>
                            }
                        />

                        <Route
                            path="/manufacturing/products/:productId"
                            element={
                                <ProtectedRoute>
                                    <ProductDetailsPage />
                                </ProtectedRoute>
                            }
                        />

                        <Route
                            path="/quality/testing"
                            element={
                                <ProtectedRoute>
                                    <TestingPage />
                                </ProtectedRoute>
                            }
                        />

                        <Route
                            path="/quality/debugging"
                            element={
                                <ProtectedRoute>
                                    <DebuggingPage />
                                </ProtectedRoute>
                            }
                        />

                        <Route
                            path="/quality/repairs"
                            element={
                                <ProtectedRoute>
                                    <RepairsPage />
                                </ProtectedRoute>
                            }
                        />

                        <Route
                            path="/quality/repairs/:repairId"
                            element={
                                <ProtectedRoute>
                                    <RepairDetailsPage />
                                </ProtectedRoute>
                            }
                        />

                        <Route
                            path="/admin/users"
                            element={
                                <ProtectedRoute allowedRoles={['admin']}>
                                    <UsersPage />
                                </ProtectedRoute>
                            }
                        />

                        <Route
                            path="/users"
                            element={
                                <ProtectedRoute allowedRoles={['admin']}>
                                    <UsersPage />
                                </ProtectedRoute>
                            }
                        />

                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </Router>
            </AppUIProvider>
        </Provider>
    );
}

export default App;

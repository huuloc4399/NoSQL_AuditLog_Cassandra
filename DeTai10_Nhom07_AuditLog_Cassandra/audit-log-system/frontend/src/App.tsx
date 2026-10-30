import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SidebarProvider } from './context/SidebarContext';
import { ThemeProvider } from './context/ThemeContext';
import { MainLayout } from './layouts/MainLayout';
import { LogExplorerPage } from './pages/LogExplorerPage';
import { CatalogPage, AccountsPage } from './pages/ManagementPages';
import { OperationsPage } from './pages/OperationsPage';
import { RetentionPage } from './pages/RetentionPage';
import { InfrastructurePage } from './pages/InfrastructurePage';

import { ProfilePage } from './pages/ProfilePage';
import { AccessDeniedPage } from './pages/AccessDeniedPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { UserRole } from './types';
import { StorefrontPage, CartPage, CheckoutPage, OrdersPage, OrderPage } from './pages/ShopPages';

const OverviewPage = lazy(() => import('./pages/OverviewPage').then(module => ({ default: module.OverviewPage })));
const HomePage = () => useAuth().isAdmin ? <OverviewPage/> : <StorefrontPage/>;
const DemoPage = () => useAuth().isAdmin ? <OperationsPage/> : <Navigate to="/" replace/>;

// Route guard with Role-Based Access Control (RBAC)
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}> = ({ children, allowedRoles }) => {
  const { isAuthenticated, role } = useAuth();
  const { loading } = useAuth();
  if (loading) return <div className="table-empty" role="status">Đang kiểm tra phiên đăng nhập…</div>;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <AccessDeniedPage requiredRoles={allowedRoles} />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SidebarProvider>
          <BrowserRouter>
          <Suspense fallback={<div className="table-empty" role="status">Đang tải giao diện…</div>}><Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected Core Layout Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              {/* Accessible by both roles: ADMIN, USER */}
              <Route index element={<HomePage />} />
              <Route path="cart" element={<ProtectedRoute allowedRoles={['USER']}><CartPage/></ProtectedRoute>} />
              <Route path="checkout" element={<ProtectedRoute allowedRoles={['USER']}><CheckoutPage/></ProtectedRoute>} />
              <Route path="orders" element={<ProtectedRoute allowedRoles={['USER']}><OrdersPage/></ProtectedRoute>} />
              <Route path="orders/:id" element={<ProtectedRoute allowedRoles={['USER']}><OrderPage/></ProtectedRoute>} />
              <Route path="logs" element={<ProtectedRoute allowedRoles={['ADMIN']}><LogExplorerPage /></ProtectedRoute>} />
              <Route path="profile" element={<ProfilePage />} />

              {/* Accessible by ADMIN */}
              <Route
                path="services"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <CatalogPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="demo"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'USER']}>
                    <DemoPage />
                  </ProtectedRoute>
                }
              />

              {/* Accessible by ADMIN ONLY */}
              <Route
                path="ttl-demo"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <RetentionPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="system"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <InfrastructurePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="users"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <AccountsPage />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Fallback 404 Route */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes></Suspense>
        </BrowserRouter>
      </SidebarProvider>
    </AuthProvider>
    </ThemeProvider>
  );
};

export default App;

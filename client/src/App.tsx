import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { RoleProtectedRoute } from './components/auth/RoleProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { EquipmentListPage } from './pages/EquipmentListPage';
import { EquipmentDetailPage } from './pages/EquipmentDetailPage';
import { UsersPage } from './pages/UsersPage';
import { AlertsPage } from './pages/AlertsPage';
import { MaintenancePage } from './pages/MaintenancePage';
import { InspectionsPage } from './pages/InspectionsPage';
import { InspectionDetailPage } from './pages/InspectionDetailPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import {
  Package,
  BarChart3,
} from 'lucide-react';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Routes inside AppLayout */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/equipment" element={<EquipmentListPage />} />
              <Route path="/equipment/:id" element={<EquipmentDetailPage />} />
              <Route path="/alerts" element={<AlertsPage />} />
              <Route path="/maintenance" element={<MaintenancePage />} />
              <Route path="/inspections" element={<InspectionsPage />} />
              <Route path="/inspections/:id" element={<InspectionDetailPage />} />
              <Route
                path="/inventory"
                element={
                  <PlaceholderPage
                    title="Inventory"
                    subtitle="Cryogenic liquids volume inventory, spare parts, and restock requests"
                    phase="Phase 6"
                    icon={Package}
                  />
                }
              />
              <Route
                path="/reports"
                element={
                  <PlaceholderPage
                    title="Compliance & Telemetry Reports"
                    subtitle="Historical trends, consumption logs, and CSV data export"
                    phase="Phase 7"
                    icon={BarChart3}
                  />
                }
              />

              {/* Admin Only Route */}
              <Route element={<RoleProtectedRoute allowedRole="ADMIN" />}>
                <Route path="/users" element={<UsersPage />} />
              </Route>
            </Route>
          </Route>

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

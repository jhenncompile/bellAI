import { Routes, Route, Navigate } from 'react-router';

import { AdminLayout } from '@/layouts/AdminLayout';
import { AdminRoute, LoginPage, ProtectedRoute } from '@/features/auth';
import { DashboardPage } from '@/features/dashboard';
import { UsersPage } from '@/features/users';
import { ProfilePage, PreferencesPage } from '@/features/profile';
import { PrivacyPage } from '@/features/privacy';
import { MediaPage } from '@/features/media';
import { SettingsPage } from '@/features/settings';
import { AuditLogsPage } from '@/features/audit';
import { AiModelsPage } from '@/features/ai-models';
import { IncidentsPage } from '@/features/incidents';
import { PaymentsPage } from '@/features/payments';
import { NotFoundPage } from './NotFoundPage';

/** Tabla de rutas de la aplicación. */
export function AppRoutes() {
  return (
    <Routes>
      {/* Ruta Pública */}
      <Route path="/login" element={<LoginPage />} />

      {/* Rutas Protegidas del Panel de Administración */}
      <Route
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/dashboard"
          element={
            <AdminRoute>
              <DashboardPage />
            </AdminRoute>
          }
        />
        <Route
          path="/users"
          element={
            <AdminRoute>
              <UsersPage />
            </AdminRoute>
          }
        />
        <Route path="/media" element={<MediaPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/preferences" element={<PreferencesPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route
          path="/settings"
          element={
            <AdminRoute>
              <SettingsPage />
            </AdminRoute>
          }
        />
        <Route
          path="/audit-logs"
          element={
            <AdminRoute>
              <AuditLogsPage />
            </AdminRoute>
          }
        />
        <Route path="/ai-models" element={<AiModelsPage />} />
        <Route path="/incidents" element={<IncidentsPage />} />
        <Route path="/payments" element={<PaymentsPage />} />
      </Route>

      {/* Ruta 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './lib/auth';
import { AppShell } from './components/layout/AppShell';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { OwnerMobileHomePage } from './pages/owner/MobileHome';
import { VehiclesPage, CustomersPage } from './pages/customers/VehiclesAndCustomers';
import { WorkOrderListPage, WorkOrderNewPage, WorkOrderDetailPage } from './pages/workorders/WorkOrders';
import { AssignmentBoardPage, TechnicianJobsPage } from './pages/technician/AssignmentAndClock';
import { WaitingRoomDisplayPage } from './pages/waiting-room/WaitingRoomDisplay';
import { PartsListPage, StockOpnamePage } from './pages/parts/PartsAndOpname';
import { InvoicesListPage, InvoiceDetailPage, ComplaintsPage } from './pages/invoices/InvoicesAndWarranty';
import { RemindersPage, TechnicianPerformancePage, MonthlyReportPage } from './pages/reports/PerformanceAndReports';
import { ExpensesPage, ToolsPage, MasterAdminPage, AuditLogsPage } from './pages/admin/ToolsExpensesMasterAudit';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedLayout() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] text-[var(--text-primary)] text-sm font-medium">
        Memuat sesi Brit Auto WMS...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/waiting-room" element={<WaitingRoomDisplayPage />} />

            <Route element={<ProtectedLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/owner/mobile" element={<OwnerMobileHomePage />} />

              <Route path="/work-orders" element={<WorkOrderListPage />} />
              <Route path="/work-orders/new" element={<WorkOrderNewPage />} />
              <Route path="/work-orders/:id" element={<WorkOrderDetailPage />} />

              <Route path="/assignments" element={<AssignmentBoardPage />} />
              <Route path="/my-jobs" element={<TechnicianJobsPage />} />

              <Route path="/vehicles" element={<VehiclesPage />} />
              <Route path="/customers" element={<CustomersPage />} />

              <Route path="/parts" element={<PartsListPage />} />
              <Route path="/opnames" element={<StockOpnamePage />} />

              <Route path="/invoices" element={<InvoicesListPage />} />
              <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
              <Route path="/complaints" element={<ComplaintsPage />} />
              <Route path="/reminders" element={<RemindersPage />} />

              <Route path="/performance" element={<TechnicianPerformancePage />} />
              <Route path="/reports" element={<MonthlyReportPage />} />

              <Route path="/expenses" element={<ExpensesPage />} />
              <Route path="/tools" element={<ToolsPage />} />
              <Route path="/master" element={<MasterAdminPage />} />
              <Route path="/audit-logs" element={<AuditLogsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}



/**
 * routes.jsx — central router wiring all feature modules.
 */
import { createBrowserRouter, Navigate } from 'react-router-dom';

import AppLayout         from './components/common/AppLayout';
import ProtectedRoute    from './components/common/ProtectedRoute';

import authRoutes          from './features/auth/routes/auth.routes';
import dashboardRoutes     from './features/dashboard/routes/dashboard.routes';
import employeesRoutes     from './features/employees/routes/employees.routes';
import attendanceRoutes    from './features/attendance/routes/attendance.routes';
import leavesRoutes        from './features/leaves/routes/leaves.routes';
import payrollRoutes       from './features/payroll/routes/payroll.routes';
import expensesRoutes      from './features/expenses/routes/expenses.routes';
import projectsRoutes      from './features/projects/routes/projects.routes';
import settingsRoutes      from './features/settings/routes/settings.routes';
import reportsRoutes       from './features/reports/routes/reports.routes';
import notificationsRoutes from './features/notifications/routes/notifications.routes';

const router = createBrowserRouter([
  ...authRoutes,
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      ...dashboardRoutes,
      ...employeesRoutes,
      ...attendanceRoutes,
      ...leavesRoutes,
      ...payrollRoutes,
      ...expensesRoutes,
      ...projectsRoutes,
      ...settingsRoutes,
      ...reportsRoutes,
      ...notificationsRoutes,
    ],
  },
  // 404 fallback
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);

export default router;

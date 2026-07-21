/**
 * routes.jsx — central router wiring all feature modules.
 */
import { createBrowserRouter, Navigate } from 'react-router-dom';

import AppLayout         from './components/common/AppLayout';
import ProtectedRoute    from './components/common/ProtectedRoute';
import RoleRoute         from './components/common/RoleRoute';

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
import profileRoutes       from './features/profile/routes/profile.routes';

const withRoles = (routes, roles) => routes.map((route) => ({
  ...route,
  element: <RoleRoute allowedRoles={roles}>{route.element}</RoleRoute>,
}));

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
      ...withRoles(employeesRoutes, ['team_lead', 'manager', 'hr', 'super_admin']),
      ...attendanceRoutes,
      ...leavesRoutes,
      ...payrollRoutes,
      ...withRoles(expensesRoutes, ['employee', 'manager', 'admin', 'super_admin']),
      ...withRoles(projectsRoutes, ['employee', 'team_lead', 'manager', 'admin', 'super_admin']),
      ...withRoles(settingsRoutes, ['hr', 'super_admin']),
      ...withRoles(reportsRoutes, ['hr', 'admin', 'super_admin']),
      ...notificationsRoutes,
      ...profileRoutes,
    ],
  },
  // 404 fallback
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);

export default router;

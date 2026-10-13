/**
 * features/dashboard/routes/dashboard.routes.js
 * Route definitions for the dashboard feature, merged into the app router
 * in routes.jsx. Kept feature-local so each module owns its own routing.
 */
import { lazy } from 'react';
import RoleRoute from '../../../components/common/RoleRoute';

const DashboardListPage = lazy(() => import('../pages/DashboardListPage'));
const DashboardAlertsPage = lazy(() => import('../pages/DashboardAlertsPage'));

const dashboardRoutes = [
  {
    path: 'dashboard',
    element: <DashboardListPage />,
  },
  {
    path: 'dashboard/alerts/:kind',
    element: <RoleRoute allowedRoles={['hr', 'super_admin', 'manager', 'team_lead', 'floor_head']}><DashboardAlertsPage /></RoleRoute>,
  },
];

export default dashboardRoutes;

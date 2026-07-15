/**
 * features/dashboard/routes/dashboard.routes.js
 * Route definitions for the dashboard feature, merged into the app router
 * in routes.jsx. Kept feature-local so each module owns its own routing.
 */
import { lazy } from 'react';

const DashboardListPage = lazy(() => import('../pages/DashboardListPage'));

const dashboardRoutes = [
  {
    path: 'dashboard',
    element: <DashboardListPage />,
  },
];

export default dashboardRoutes;

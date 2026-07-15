import { lazy } from 'react';
const ReportsPage = lazy(() => import('../pages/ReportsPage'));
const reportsRoutes = [{ path: 'reports', element: <ReportsPage /> }];
export default reportsRoutes;

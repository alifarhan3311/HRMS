import { lazy } from 'react';
const ExitManagementPage = lazy(() => import('../pages/ExitManagementPage'));
export default [{ path: 'exits', element: <ExitManagementPage /> }];

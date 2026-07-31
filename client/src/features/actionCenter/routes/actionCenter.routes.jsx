import { lazy } from 'react';
const ActionCenterPage = lazy(() => import('../pages/ActionCenterPage'));
export default [{ path: 'action-center', element: <ActionCenterPage /> }];

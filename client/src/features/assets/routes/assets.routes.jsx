import { lazy } from 'react';
const AssetsPage = lazy(() => import('../pages/AssetsPage'));
export default [{ path: 'assets', element: <AssetsPage /> }];

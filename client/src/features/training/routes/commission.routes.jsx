import { lazy } from 'react';

const CommissionPage = lazy(() => import('../pages/CommissionPage'));

export default [
  { path: 'commissions', element: <CommissionPage /> },
];

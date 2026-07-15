/**
 * features/payroll/routes/payroll.routes.js
 * Route definitions for the payroll feature, merged into the app router
 * in routes.jsx. Kept feature-local so each module owns its own routing.
 */
import { lazy } from 'react';

const PayrollListPage = lazy(() => import('../pages/PayrollListPage'));

const payrollRoutes = [
  {
    path: 'payroll',
    element: <PayrollListPage />,
  },
];

export default payrollRoutes;

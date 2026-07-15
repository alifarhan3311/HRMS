/**
 * features/leaves/routes/leaves.routes.js
 * Route definitions for the leaves feature, merged into the app router
 * in routes.jsx. Kept feature-local so each module owns its own routing.
 */
import { lazy } from 'react';

const LeavesListPage = lazy(() => import('../pages/LeavesListPage'));

const leavesRoutes = [
  {
    path: 'leaves',
    element: <LeavesListPage />,
  },
];

export default leavesRoutes;

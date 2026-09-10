/**
 * features/fines/routes/fines.routes.jsx
 * Route definitions for the fines feature, merged into the app router in routes.jsx.
 */
import { lazy } from 'react';

const FinesPage = lazy(() => import('../pages/FinesPage'));

const finesRoutes = [
  {
    path: 'fines',
    element: <FinesPage />,
  },
];

export default finesRoutes;

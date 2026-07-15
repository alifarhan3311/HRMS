/**
 * features/auth/routes/auth.routes.js
 * Login renders outside the main AppLayout shell (no sidebar/header).
 */
import { lazy } from 'react';

const LoginPage = lazy(() => import('../pages/LoginPage'));

const authRoutes = [
  {
    path: '/login',
    element: <LoginPage />,
  },
];

export default authRoutes;

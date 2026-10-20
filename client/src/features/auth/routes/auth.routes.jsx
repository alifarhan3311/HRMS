/**
 * features/auth/routes/auth.routes.js
 * Login renders outside the main AppLayout shell (no sidebar/header).
 */
import { lazy } from 'react';
import GuestRoute from '../../../components/common/GuestRoute';

const LoginPage = lazy(() => import('../pages/LoginPage'));

const authRoutes = [
  {
    path: '/login',
    element: (
      <GuestRoute>
        <LoginPage />
      </GuestRoute>
    ),
  },
];

export default authRoutes;

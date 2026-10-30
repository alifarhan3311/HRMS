import { lazy } from 'react';

const SessionsPage = lazy(() => import('../pages/SessionsPage'));

const sessionsRoutes = [{ path: 'sessions', element: <SessionsPage /> }];

export default sessionsRoutes;

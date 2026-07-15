import { lazy } from 'react';
const NotificationsPage = lazy(() => import('../pages/NotificationsPage'));
const notificationsRoutes = [{ path: 'notifications', element: <NotificationsPage /> }];
export default notificationsRoutes;

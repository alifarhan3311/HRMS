import { lazy } from 'react';
const SettingsPage = lazy(() => import('../pages/SettingsPage'));
const settingsRoutes = [{ path: 'settings', element: <SettingsPage /> }];
export default settingsRoutes;

import { lazy } from 'react';

const ProfilePage = lazy(() => import('../pages/ProfilePage'));

export default [{ path: 'profile', element: <ProfilePage /> }];

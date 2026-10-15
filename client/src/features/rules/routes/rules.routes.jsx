import { lazy } from 'react';
const RulesPage = lazy(() => import('../pages/RulesPage'));
export default [{ path: 'rules', element: <RulesPage /> }];

import { lazy } from 'react';

const AuditLogsPage = lazy(() => import('../pages/AuditLogsPage'));

const auditLogsRoutes = [
  {
    path: 'audit-logs',
    element: <AuditLogsPage />,
    allowedRoles: ['super_admin', 'hr', 'manager'],
  },
];

export default auditLogsRoutes;

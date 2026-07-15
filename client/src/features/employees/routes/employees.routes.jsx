/**
 * features/employees/routes/employees.routes.js
 * Route definitions for the employees feature.
 */
import { lazy } from 'react';

const EmployeesListPage = lazy(() => import('../pages/EmployeesListPage'));

const employeesRoutes = [
  {
    path: 'employees',
    element: <EmployeesListPage />,
  },
];

export default employeesRoutes;

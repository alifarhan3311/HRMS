/**
 * features/expenses/routes/expenses.routes.js
 * Route definitions for the expenses feature, merged into the app router
 * in routes.jsx. Kept feature-local so each module owns its own routing.
 */
import { lazy } from 'react';

const ExpensesListPage = lazy(() => import('../pages/ExpensesListPage'));

const expensesRoutes = [
  {
    path: 'expenses',
    element: <ExpensesListPage />,
  },
];

export default expensesRoutes;

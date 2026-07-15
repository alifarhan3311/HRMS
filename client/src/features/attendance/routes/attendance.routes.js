/**
 * features/attendance/routes/attendance.routes.js
 * Route definitions for the attendance feature, merged into the app router
 * in routes.jsx. Kept feature-local so each module owns its own routing.
 */
import { lazy } from 'react';

const AttendanceListPage = lazy(() => import('../pages/AttendanceListPage'));

const attendanceRoutes = [
  {
    path: 'attendance',
    element: <AttendanceListPage />,
  },
];

export default attendanceRoutes;

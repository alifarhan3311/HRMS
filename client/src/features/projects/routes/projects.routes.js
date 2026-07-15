/**
 * features/projects/routes/projects.routes.js
 * Route definitions for the projects feature, merged into the app router
 * in routes.jsx. Kept feature-local so each module owns its own routing.
 */
import { lazy } from 'react';

const ProjectsListPage = lazy(() => import('../pages/ProjectsListPage'));

const projectsRoutes = [
  {
    path: 'projects',
    element: <ProjectsListPage />,
  },
];

export default projectsRoutes;

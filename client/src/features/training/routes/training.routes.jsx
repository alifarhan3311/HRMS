import { lazy } from 'react';

const TrainingPage = lazy(() => import('../pages/TrainingPage'));

export default [
  { path: 'training', element: <TrainingPage /> },
  { path: 'training/:categoryId', element: <TrainingPage /> },
];

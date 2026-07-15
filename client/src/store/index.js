/**
 * store/index.js — Root Redux store.
 */
import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';

import { api }           from '../services/apiSlice';
import uiReducer         from './slices/ui.slice';
import authReducer       from '../features/auth/store/auth.slice';
import dashboardReducer  from '../features/dashboard/store/dashboard.slice';
import employeesReducer  from '../features/employees/store/employees.slice';

export const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
    ui:        uiReducer,
    auth:      authReducer,
    dashboard: dashboardReducer,
    employees: employeesReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['api/executeMutation/pending', 'api/executeQuery/pending'],
      },
    }).concat(api.middleware),
  devTools: import.meta.env.MODE !== 'production',
});

setupListeners(store.dispatch);
export default store;

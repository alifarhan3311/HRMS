/**
 * store/index.js
 * -----------------------------------------------------------------------
 * Root Redux store. Combines:
 *   - RTK Query API slice(s) for server state (each feature module injects
 *     its own endpoints into this single `api` slice via `injectEndpoints`
 *     so we get one shared cache / one middleware, not one per feature).
 *   - Local UI-only slices (theme, sidebar state, active modal, etc.) that
 *     don't belong on the server.
 *
 * Feature modules should NOT create their own separate RTK Query
 * `createApi` instances — that fragments the cache and breaks tag-based
 * invalidation across features (e.g. approving a leave should invalidate
 * both `Leaves` and `DashboardStats` tags). Instead they import `api` from
 * services/apiSlice.js and call `api.injectEndpoints({...})`.
 * -----------------------------------------------------------------------
 */

import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';

import { api } from '../services/apiSlice';
import uiReducer from './slices/ui.slice';
import authReducer from '../features/auth/store/auth.slice';

export const store = configureStore({
  reducer: {
    // RTK Query's generated reducer — handles all server-state caching.
    [api.reducerPath]: api.reducer,

    // Local UI state (sidebar collapsed, active theme, global toasts, etc.)
    ui: uiReducer,

    // Client-side session state derived from auth responses (current user,
    // role, permission flags) — NOT the tokens themselves, those stay in
    // HttpOnly cookies and are never touched by JS.
    auth: authReducer,
  },

  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // RTK Query relies on non-serializable values (e.g. AbortController)
      // internally; its own middleware handles this safely, so we only
      // need to make sure the api middleware is appended.
      serializableCheck: {
        ignoredActions: ['api/executeMutation/pending', 'api/executeQuery/pending'],
      },
    }).concat(api.middleware),

  devTools: import.meta.env.MODE !== 'production',
});

// Enables RTK Query features like refetchOnFocus / refetchOnReconnect —
// without this, tab-refocus and network-reconnect revalidation is inert.
setupListeners(store.dispatch);

export default store;

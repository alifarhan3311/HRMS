/**
 * services/apiSlice.js
 * The single shared RTK Query API instance. Every feature injects its own
 * endpoints into this via api.injectEndpoints({...}) rather than creating
 * a separate createApi() — this keeps the cache and tag invalidation
 * unified across the whole app (e.g. approving a leave can invalidate
 * both 'Leaves' and 'Dashboard' tags in one place).
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import axiosInstance from '../utils/axios';

// Custom base query that routes through our existing axios instance so we
// keep a single source of truth for auth/refresh/error-handling logic
// instead of duplicating it in a separate fetchBaseQuery config.
const axiosBaseQuery =
  () =>
  async ({ url, method = 'GET', body, params }) => {
    try {
      const result = await axiosInstance({ url, method, data: body, params });
      return { data: result.data };
    } catch (axiosError) {
      return { error: { status: axiosError.status, data: axiosError.message } };
    }
  };

export const api = createApi({
  reducerPath: 'api',
  baseQuery: axiosBaseQuery(),
  tagTypes: [
    'Auth',
    'Dashboard',
    'Employees',
    'Attendance',
    'Leaves',
    'Payroll',
    'Expenses',
    'Projects',
    'Holidays',
    'Notifications',
    'Settings',
    'Reports',
  ],
  endpoints: () => ({}), // each feature injects its own endpoints
});

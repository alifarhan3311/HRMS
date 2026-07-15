/**
 * features/dashboard/api/dashboard.api.js
 * RTK Query endpoints for the dashboard feature, injected into the single
 * shared `api` slice (see services/apiSlice.js) so cache tags stay unified
 * across the whole app instead of fragmenting per feature.
 */
import { api } from '../../../services/apiSlice';

export const dashboardApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getDashboardSummary: builder.query({
      query: () => '/dashboard/summary',
      providesTags: ['Dashboard'],
    }),
  }),
  overrideExisting: false,
});

export const { useGetDashboardSummaryQuery } = dashboardApi;

/**
 * features/payroll/api/payroll.api.js
 */
import { api } from '../../../services/apiSlice';

export const payrollApi = api.injectEndpoints({
  endpoints: (builder) => ({
    listPayroll: builder.query({
      query: (params) => ({ url: '/payroll', params }),
      providesTags: ['Payroll'],
    }),
    getLivePayroll: builder.query({
      query: (params) => ({ url: '/payroll/live', params }),
      providesTags: ['Payroll', 'Attendance', 'Leaves'],
    }),
    getPayrollById: builder.query({
      query: (id) => `/payroll/${id}`,
      providesTags: (result, error, id) => [{ type: 'Payroll', id }],
    }),
    generatePayroll: builder.mutation({
      query: (body) => ({ url: '/payroll', method: 'POST', body }),
      invalidatesTags: ['Payroll', 'Dashboard'],
    }),
    updatePayroll: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/payroll/${id}`, method: 'PUT', body }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Payroll', id }, 'Payroll'],
    }),
    submitPayroll: builder.mutation({
      query: (id) => ({ url: `/payroll/${id}/submit`, method: 'PATCH' }),
      invalidatesTags: ['Payroll'],
    }),
    approvePayroll: builder.mutation({
      query: (id) => ({ url: `/payroll/${id}/approve`, method: 'PATCH' }),
      invalidatesTags: ['Payroll'],
    }),
    markPayrollPaid: builder.mutation({
      query: (id) => ({ url: `/payroll/${id}/paid`, method: 'PATCH' }),
      invalidatesTags: ['Payroll'],
    }),
    lockPayroll: builder.mutation({
      query: (id) => ({ url: `/payroll/${id}/lock`, method: 'PATCH' }),
      invalidatesTags: ['Payroll'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListPayrollQuery,
  useGetLivePayrollQuery,
  useGetPayrollByIdQuery,
  useGeneratePayrollMutation,
  useUpdatePayrollMutation,
  useSubmitPayrollMutation,
  useApprovePayrollMutation,
  useMarkPayrollPaidMutation,
  useLockPayrollMutation,
} = payrollApi;

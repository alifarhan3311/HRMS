/**
 * features/leaves/api/leaves.api.js
 */
import { api } from '../../../services/apiSlice';

export const leavesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    listLeaves: builder.query({
      query: (params) => ({ url: '/leaves', params }),
      providesTags: ['Leaves'],
    }),
    getLeaveById: builder.query({
      query: (id) => `/leaves/${id}`,
      providesTags: (result, error, id) => [{ type: 'Leaves', id }],
    }),
    applyLeave: builder.mutation({
      query: (body) => ({ url: '/leaves', method: 'POST', body }),
      invalidatesTags: ['Leaves', 'Attendance', 'Payroll', 'Dashboard'],
    }),
    approveLeave: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/leaves/${id}/approve`, method: 'PATCH', body }),
      invalidatesTags: ['Leaves', 'Employees', 'Dashboard'],
    }),
    rejectLeave: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/leaves/${id}/reject`, method: 'PATCH', body }),
      invalidatesTags: ['Leaves', 'Dashboard'],
    }),
    cancelLeave: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/leaves/${id}/cancel`, method: 'PATCH', body }),
      invalidatesTags: ['Leaves', 'Employees', 'Dashboard'],
    }),
    getPendingApprovals: builder.query({
      query: () => '/leaves/pending-approvals',
      providesTags: ['Leaves'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListLeavesQuery,
  useGetLeaveByIdQuery,
  useApplyLeaveMutation,
  useApproveLeaveMutation,
  useRejectLeaveMutation,
  useCancelLeaveMutation,
  useGetPendingApprovalsQuery,
} = leavesApi;

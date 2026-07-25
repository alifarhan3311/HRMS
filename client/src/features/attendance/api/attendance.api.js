/**
 * features/attendance/api/attendance.api.js
 * RTK Query endpoints for attendance feature.
 */
import { api } from '../../../services/apiSlice';

export const attendanceApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Employee self-service
    signIn: builder.mutation({
      query: (body) => ({ url: '/attendance/sign-in', method: 'POST', body }),
      invalidatesTags: ['Attendance', 'Payroll', 'Dashboard', 'Reports'],
    }),
    signOut: builder.mutation({
      query: (body) => ({ url: '/attendance/sign-out', method: 'POST', body }),
      invalidatesTags: ['Attendance', 'Payroll', 'Dashboard', 'Reports'],
    }),
    getTodayAttendance: builder.query({
      query: () => '/attendance/today',
      providesTags: ['Attendance'],
    }),
    getMonthlySummary: builder.query({
      query: (params) => ({ url: '/attendance/monthly-summary', params }),
      providesTags: ['Attendance'],
    }),
    getAttendanceRangeSummary: builder.query({
      query: (params) => ({ url: '/attendance/range-summary', params }),
      providesTags: ['Attendance'],
    }),
    // List with filters
    listAttendance: builder.query({
      query: (params) => ({ url: '/attendance', params }),
      providesTags: ['Attendance'],
    }),
    // Pending regularizations
    getPendingRegularizations: builder.query({
      query: () => '/attendance/pending-regularizations',
      providesTags: ['Attendance'],
    }),
    // Manual correction (HR/Admin)
    manualCorrection: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/attendance/${id}/correct`, method: 'PUT', body }),
      invalidatesTags: ['Attendance', 'Payroll', 'Dashboard', 'Reports'],
    }),
    // Regularization request (employee)
    requestRegularization: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/attendance/${id}/regularize`, method: 'POST', body }),
      invalidatesTags: ['Attendance', 'Dashboard', 'Reports'],
    }),
    // Review regularization (HR/Admin)
    reviewRegularization: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/attendance/${id}/regularize/review`, method: 'PATCH', body }),
      invalidatesTags: ['Attendance', 'Payroll', 'Dashboard', 'Reports'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useSignInMutation,
  useSignOutMutation,
  useGetTodayAttendanceQuery,
  useGetMonthlySummaryQuery,
  useGetAttendanceRangeSummaryQuery,
  useListAttendanceQuery,
  useGetPendingRegularizationsQuery,
  useManualCorrectionMutation,
  useRequestRegularizationMutation,
  useReviewRegularizationMutation,
} = attendanceApi;

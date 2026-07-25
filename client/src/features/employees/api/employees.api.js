/**
 * features/employees/api/employees.api.js
 * RTK Query endpoints for the employees feature.
 */
import { api } from '../../../services/apiSlice';

export const employeesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    listEmployees: builder.query({
      query: (params) => ({ url: '/employees', params }),
      providesTags: ['Employees'],
    }),
    getEmployeeById: builder.query({
      query: (id) => `/employees/${id}`,
      providesTags: (result, error, id) => [{ type: 'Employees', id }],
    }),
    createEmployee: builder.mutation({
      query: (body) => ({ url: '/employees', method: 'POST', body }),
      invalidatesTags: ['Employees', 'Attendance', 'Leaves', 'Payroll', 'Dashboard', 'Projects', 'Reports'],
    }),
    updateEmployee: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/employees/${id}`, method: 'PUT', body }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Employees', id }, 'Employees', 'Auth', 'Attendance', 'Leaves',
        'Payroll', 'Dashboard', 'Projects', 'Reports',
      ],
    }),
    initializeEmployeeLeaveBalance: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/employees/${id}/leave-balance`, method: 'PUT', body }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Employees', id }, 'Employees', 'Leaves', 'Attendance', 'Payroll', 'Dashboard',
      ],
    }),
    resetEmployeePassword: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/employees/${id}/reset-password`, method: 'PATCH', body }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Employees', id }, 'Employees'],
    }),
    deleteEmployee: builder.mutation({
      query: (id) => ({ url: `/employees/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Employees', 'Auth', 'Attendance', 'Leaves', 'Payroll', 'Dashboard', 'Projects', 'Reports'],
    }),
    changeEmployeeStatus: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/employees/${id}/status`, method: 'PATCH', body }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Employees', id }, 'Employees', 'Auth', 'Attendance',
        'Payroll', 'Dashboard', 'Projects', 'Reports',
      ],
    }),
    promoteEmployee: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/employees/${id}/promote`, method: 'POST', body }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Employees', id }, 'Employees', 'Auth', 'Payroll', 'Dashboard', 'Reports',
      ],
    }),
    getEmployeeDepartments: builder.query({
      query: () => '/employees/departments',
      providesTags: ['Employees'],
    }),
    createEmployeeDepartment: builder.mutation({
      query: (body) => ({ url: '/employees/departments', method: 'POST', body }),
      invalidatesTags: ['Employees'],
    }),
    getEmployeeStats: builder.query({
      query: () => '/employees/stats',
      providesTags: ['Employees'],
    }),
    getEmployeeHierarchy: builder.query({
      query: () => '/employees/hierarchy',
      providesTags: ['Employees'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListEmployeesQuery,
  useGetEmployeeByIdQuery,
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
  useInitializeEmployeeLeaveBalanceMutation,
  useResetEmployeePasswordMutation,
  useDeleteEmployeeMutation,
  useChangeEmployeeStatusMutation,
  usePromoteEmployeeMutation,
  useGetEmployeeDepartmentsQuery,
  useCreateEmployeeDepartmentMutation,
  useGetEmployeeStatsQuery,
  useGetEmployeeHierarchyQuery,
} = employeesApi;

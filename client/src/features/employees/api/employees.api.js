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
      invalidatesTags: ['Employees', 'Dashboard'],
    }),
    updateEmployee: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/employees/${id}`, method: 'PUT', body }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Employees', id }, 'Employees', 'Auth'],
    }),
    deleteEmployee: builder.mutation({
      query: (id) => ({ url: `/employees/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Employees'],
    }),
    changeEmployeeStatus: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/employees/${id}/status`, method: 'PATCH', body }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Employees', id }, 'Employees'],
    }),
    promoteEmployee: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/employees/${id}/promote`, method: 'POST', body }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Employees', id }, 'Employees'],
    }),
    getEmployeeDepartments: builder.query({
      query: () => '/employees/departments',
      providesTags: ['Employees'],
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
  useDeleteEmployeeMutation,
  useChangeEmployeeStatusMutation,
  usePromoteEmployeeMutation,
  useGetEmployeeDepartmentsQuery,
  useGetEmployeeStatsQuery,
  useGetEmployeeHierarchyQuery,
} = employeesApi;

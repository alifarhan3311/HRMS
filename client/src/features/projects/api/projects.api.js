/**
 * features/projects/api/projects.api.js
 */
import { api } from '../../../services/apiSlice';

export const projectsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    listProjects: builder.query({
      query: (params) => ({ url: '/projects', params }),
      providesTags: ['Projects'],
    }),
    getEligibleProjectEmployees: builder.query({
      query: () => '/projects/eligible-employees',
      providesTags: ['Employees'],
    }),
    getProjectById: builder.query({
      query: (id) => `/projects/${id}`,
      providesTags: (result, error, id) => [{ type: 'Projects', id }],
    }),
    createProject: builder.mutation({
      query: (body) => ({ url: '/projects', method: 'POST', body }),
      invalidatesTags: ['Projects'],
    }),
    updateProject: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/projects/${id}`, method: 'PUT', body }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Projects', id }, 'Projects'],
    }),
    deleteProject: builder.mutation({
      query: (id) => ({ url: `/projects/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Projects'],
    }),
    getCallTransferContext: builder.query({
      query: () => '/projects/call-transfers/context',
      providesTags: ['CallTransfers'],
    }),
    listCallTransfers: builder.query({
      query: (params) => ({ url: '/projects/call-transfers', params }),
      providesTags: ['CallTransfers'],
    }),
    createCallTransfer: builder.mutation({
      query: (body) => ({ url: '/projects/call-transfers', method: 'POST', body }),
      invalidatesTags: ['CallTransfers', 'Notifications'],
    }),
    decideCallTransfer: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/projects/call-transfers/${id}/decision`, method: 'PATCH', body }),
      invalidatesTags: ['CallTransfers', 'Notifications'],
    }),
    getCallSaleContext: builder.query({
      query: () => '/projects/call-sales/context',
      providesTags: ['CallSales'],
    }),
    listCallSales: builder.query({
      query: (params) => ({ url: '/projects/call-sales', params }),
      providesTags: ['CallSales'],
    }),
    createCallSale: builder.mutation({
      query: (body) => ({ url: '/projects/call-sales', method: 'POST', body }),
      invalidatesTags: ['CallSales', 'Notifications'],
    }),
    decideCallSale: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/projects/call-sales/${id}/decision`, method: 'PATCH', body }),
      invalidatesTags: ['CallSales', 'Notifications'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListProjectsQuery,
  useGetProjectByIdQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
  useGetEligibleProjectEmployeesQuery,
  useGetCallTransferContextQuery,
  useListCallTransfersQuery,
  useCreateCallTransferMutation,
  useDecideCallTransferMutation,
  useGetCallSaleContextQuery,
  useListCallSalesQuery,
  useCreateCallSaleMutation,
  useDecideCallSaleMutation,
} = projectsApi;

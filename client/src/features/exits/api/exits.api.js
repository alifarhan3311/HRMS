import { api } from '../../../services/apiSlice';

export const exitsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    listExits: builder.query({ query: (params) => ({ url: '/exits', params }), providesTags: ['Exits'] }),
    submitResignation: builder.mutation({ query: (body) => ({ url: '/exits', method: 'POST', body }), invalidatesTags: ['Exits'] }),
    reviewExit: builder.mutation({ query: ({ id, ...body }) => ({ url: `/exits/${id}/review`, method: 'PATCH', body }), invalidatesTags: ['Exits', 'Notifications'] }),
    decideExit: builder.mutation({ query: ({ id, ...body }) => ({ url: `/exits/${id}/decision`, method: 'PATCH', body }), invalidatesTags: ['Exits', 'Notifications'] }),
    updateClearance: builder.mutation({ query: ({ id, ...body }) => ({ url: `/exits/${id}/clearance`, method: 'PATCH', body }), invalidatesTags: ['Exits'] }),
    completeExit: builder.mutation({ query: (id) => ({ url: `/exits/${id}/complete`, method: 'PATCH' }), invalidatesTags: ['Exits', 'Employees', 'Payroll'] }),
    withdrawExit: builder.mutation({ query: (id) => ({ url: `/exits/${id}/withdraw`, method: 'PATCH' }), invalidatesTags: ['Exits'] }),
  }),
});

export const { useListExitsQuery, useSubmitResignationMutation, useReviewExitMutation,
  useDecideExitMutation, useUpdateClearanceMutation, useCompleteExitMutation, useWithdrawExitMutation } = exitsApi;

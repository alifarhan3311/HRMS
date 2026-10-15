import { api } from '../../../services/apiSlice';

export const rulesApi = api.injectEndpoints({
  endpoints: builder => ({
    listRules: builder.query({ query: () => '/rules', providesTags: ['Rules'] }),
    createRule: builder.mutation({
      query: body => ({ url: '/rules', method: 'POST', body }), invalidatesTags: ['Rules'],
    }),
    updateRule: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/rules/${id}`, method: 'PUT', body }), invalidatesTags: ['Rules'],
    }),
    deleteRule: builder.mutation({
      query: ({ id, revision }) => ({ url: `/rules/${id}`, method: 'DELETE', body: { revision } }), invalidatesTags: ['Rules'],
    }),
  }),
});
export const { useListRulesQuery, useCreateRuleMutation, useUpdateRuleMutation, useDeleteRuleMutation } = rulesApi;

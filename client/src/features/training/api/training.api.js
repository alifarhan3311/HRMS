import { api } from '../../../services/apiSlice';

export const trainingApi = api.injectEndpoints({
  endpoints: (builder) => ({
    listTrainingCategories: builder.query({ query: () => '/training', providesTags: ['Training'] }),
    createTrainingCategory: builder.mutation({
      query: (body) => ({ url: '/training', method: 'POST', body }),
      invalidatesTags: ['Training'],
    }),
    updateTrainingCategory: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/training/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Training'],
    }),
    deleteTrainingCategory: builder.mutation({
      query: ({ id, revision }) => ({ url: `/training/${id}`, method: 'DELETE', body: { revision } }),
      invalidatesTags: ['Training'],
    }),
  }),
});

export const {
  useListTrainingCategoriesQuery,
  useCreateTrainingCategoryMutation,
  useUpdateTrainingCategoryMutation,
  useDeleteTrainingCategoryMutation,
} = trainingApi;

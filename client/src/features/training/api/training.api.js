import { api } from '../../../services/apiSlice';

export const trainingApi = api.injectEndpoints({
  endpoints: (builder) => ({
    listTrainingCategories: builder.query({ query: () => '/training', providesTags: ['Training'] }),
    listTrainingCommissions: builder.query({ query: () => '/training/commissions', providesTags: ['TrainingCommission'] }),
    createTrainingCommission: builder.mutation({
      query: (body) => ({ url: '/training/commissions', method: 'POST', body }),
      invalidatesTags: ['TrainingCommission'],
    }),
    updateTrainingCommissionRecord: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/training/commissions/${id}`, method: 'PUT', body }),
      invalidatesTags: ['TrainingCommission'],
    }),
    deleteTrainingCommission: builder.mutation({
      query: ({ id, revision }) => ({ url: `/training/commissions/${id}`, method: 'DELETE', body: { revision } }),
      invalidatesTags: ['TrainingCommission'],
    }),
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
  useListTrainingCommissionsQuery,
  useCreateTrainingCommissionMutation,
  useUpdateTrainingCommissionRecordMutation,
  useDeleteTrainingCommissionMutation,
  useCreateTrainingCategoryMutation,
  useUpdateTrainingCategoryMutation,
  useDeleteTrainingCategoryMutation,
} = trainingApi;

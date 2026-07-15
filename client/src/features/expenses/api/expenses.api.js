/**
 * features/expenses/api/expenses.api.js
 */
import { api } from '../../../services/apiSlice';

export const expensesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    listExpenses: builder.query({
      query: (params) => ({ url: '/expenses', params }),
      providesTags: ['Expenses'],
    }),
    getExpenseById: builder.query({
      query: (id) => `/expenses/${id}`,
      providesTags: (result, error, id) => [{ type: 'Expenses', id }],
    }),
    submitExpense: builder.mutation({
      query: (body) => ({ url: '/expenses', method: 'POST', body }),
      invalidatesTags: ['Expenses', 'Dashboard'],
    }),
    approveExpense: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/expenses/${id}/approve`, method: 'PATCH', body }),
      invalidatesTags: ['Expenses', 'Dashboard'],
    }),
    rejectExpense: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/expenses/${id}/reject`, method: 'PATCH', body }),
      invalidatesTags: ['Expenses', 'Dashboard'],
    }),
    markExpensePaid: builder.mutation({
      query: (id) => ({ url: `/expenses/${id}/paid`, method: 'PATCH' }),
      invalidatesTags: ['Expenses', 'Dashboard'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListExpensesQuery,
  useGetExpenseByIdQuery,
  useSubmitExpenseMutation,
  useApproveExpenseMutation,
  useRejectExpenseMutation,
  useMarkExpensePaidMutation,
} = expensesApi;

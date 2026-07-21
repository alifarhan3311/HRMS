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
    listExpenseCategories: builder.query({
      query: () => '/expenses/categories',
      providesTags: ['ExpenseCategories'],
    }),
    createExpenseCategory: builder.mutation({
      query: (body) => ({ url: '/expenses/categories', method: 'POST', body }),
      invalidatesTags: ['ExpenseCategories'],
    }),
    updateExpenseCategory: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/expenses/categories/${id}`, method: 'PUT', body }),
      invalidatesTags: ['ExpenseCategories', 'Expenses'],
    }),
    deleteExpenseCategory: builder.mutation({
      query: (id) => ({ url: `/expenses/categories/${id}`, method: 'DELETE' }),
      invalidatesTags: ['ExpenseCategories'],
    }),
    getExpenseById: builder.query({
      query: (id) => `/expenses/${id}`,
      providesTags: (result, error, id) => [{ type: 'Expenses', id }],
    }),
    submitExpense: builder.mutation({
      query: (body) => ({ url: '/expenses', method: 'POST', body }),
      invalidatesTags: ['Expenses', 'Dashboard'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListExpensesQuery,
  useListExpenseCategoriesQuery,
  useCreateExpenseCategoryMutation,
  useUpdateExpenseCategoryMutation,
  useDeleteExpenseCategoryMutation,
  useGetExpenseByIdQuery,
  useSubmitExpenseMutation,
} = expensesApi;

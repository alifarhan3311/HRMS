import { api } from '../../../services/apiSlice';

export const shiftsApi = api.injectEndpoints({
  endpoints: builder => ({
    listShifts: builder.query({
      query: params => ({ url: '/shifts', params }),
      providesTags: ['Shifts'],
    }),
    createShift: builder.mutation({
      query: body => ({ url: '/shifts', method: 'POST', body }),
      invalidatesTags: ['Shifts'],
    }),
    updateShift: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/shifts/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Shifts', 'Employees', 'Auth'],
    }),
    deleteShift: builder.mutation({
      query: id => ({ url: `/shifts/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Shifts'],
    }),
  }),
});

export const { useListShiftsQuery, useCreateShiftMutation, useUpdateShiftMutation, useDeleteShiftMutation } = shiftsApi;

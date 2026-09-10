/**
 * features/fines/api/fines.api.js
 * RTK Query endpoints for the fines feature.
 */
import { api } from '../../../services/apiSlice';

export const finesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    listFines: builder.query({
      query: (params) => ({ url: '/fines', params }),
      providesTags: ['Fines'],
    }),
    getMyFines: builder.query({
      query: (params) => ({ url: '/fines/my-fines', params }),
      providesTags: ['Fines'],
    }),
    getFineById: builder.query({
      query: (id) => `/fines/${id}`,
      providesTags: (result, error, id) => [{ type: 'Fines', id }],
    }),
    issueFine: builder.mutation({
      query: (body) => ({ url: '/fines', method: 'POST', body }),
      invalidatesTags: ['Fines', 'Notifications'],
    }),
    voidFine: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/fines/${id}/void`, method: 'PATCH', body }),
      invalidatesTags: ['Fines'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListFinesQuery,
  useGetMyFinesQuery,
  useGetFineByIdQuery,
  useIssueFineMutation,
  useVoidFineMutation,
} = finesApi;

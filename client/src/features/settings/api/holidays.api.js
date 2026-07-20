import { api } from '../../../services/apiSlice';

export const holidaysApi = api.injectEndpoints({
  endpoints: builder => ({
    listHolidays: builder.query({
      query: ({ year, status } = {}) => ({ url: '/holidays', params: { year, status } }),
      providesTags: ['Holidays'],
    }),
    syncCanadaHolidays: builder.mutation({
      query: year => ({ url: '/holidays/sync-canada', method: 'POST', body: { year } }),
      invalidatesTags: ['Holidays', 'Notifications'],
    }),
    addManualCompanyOff: builder.mutation({
      query: body => ({ url: '/holidays/manual-off', method: 'POST', body }),
      invalidatesTags: ['Holidays', 'Dashboard', 'Notifications'],
    }),
    decideHoliday: builder.mutation({
      query: ({ id, isCompanyOff, note = '' }) => ({
        url: `/holidays/${id}/decision`, method: 'PATCH', body: { isCompanyOff, note },
      }),
      invalidatesTags: ['Holidays', 'Dashboard', 'Notifications'],
    }),
  }),
});

export const { useListHolidaysQuery, useSyncCanadaHolidaysMutation, useAddManualCompanyOffMutation, useDecideHolidayMutation } = holidaysApi;

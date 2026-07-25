import { api } from '../../../services/apiSlice';

export const settingsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getCompanySettings: builder.query({
      query: () => '/company-settings',
      providesTags: ['Settings'],
    }),
    updateCompanySettings: builder.mutation({
      query: (body) => ({ url: '/company-settings', method: 'PUT', body }),
      invalidatesTags: [
        'Settings', 'Employees', 'Auth', 'Attendance', 'Leaves',
        'Payroll', 'Dashboard', 'Reports',
      ],
    }),
  }),
  overrideExisting: false,
});

export const { useGetCompanySettingsQuery, useUpdateCompanySettingsMutation } = settingsApi;

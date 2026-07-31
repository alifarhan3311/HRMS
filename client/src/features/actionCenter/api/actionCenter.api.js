import { api } from '../../../services/apiSlice';

export const actionCenterApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getActionCenter: builder.query({
      query: () => '/action-center',
      providesTags: ['ActionCenter'],
    }),
  }),
});

export const { useGetActionCenterQuery } = actionCenterApi;

/**
 * features/auth/api/auth.api.js
 * Auth endpoints: login/logout/refresh/me. Unlike other features, these
 * map to session actions rather than CRUD on a resource.
 */
import { api } from '../../../services/apiSlice';

export const authApi = api.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation({
      query: (credentials) => ({ url: '/auth/login', method: 'POST', body: credentials }),
      invalidatesTags: ['Auth'],
    }),
    logout: builder.mutation({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
      invalidatesTags: ['Auth'],
    }),
    getCurrentUser: builder.query({
      query: () => '/auth/me',
      providesTags: ['Auth'],
    }),
    getMe: builder.query({
      query: () => '/auth/me',
      providesTags: ['Auth'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useLoginMutation,
  useLogoutMutation,
  useGetCurrentUserQuery,
  useGetMeQuery,
} = authApi;

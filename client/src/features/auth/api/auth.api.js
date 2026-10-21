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
      // A rejected login must not invalidate/refetch cached /auth/me queries.
      // Doing so can kick off a noisy refresh cycle while the user is just
      // trying credentials. Successful login still refreshes auth consumers.
      invalidatesTags: (result) => (result ? ['Auth'] : []),
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
      query: (options = {}) => ({
        url: '/auth/me',
        // GuestRoute only needs to learn whether a session exists; do not
        // attempt refresh when the login page is opened without credentials.
        skipAuthRefresh: options.skipAuthRefresh === true,
      }),
      providesTags: ['Auth'],
    }),
    updateProfile: builder.mutation({
      query: (body) => ({ url: '/auth/profile', method: 'PATCH', body }),
      invalidatesTags: ['Auth', 'Employees'],
    }),
    changePassword: builder.mutation({
      query: (body) => ({ url: '/auth/change-password', method: 'PATCH', body }),
      invalidatesTags: ['Auth'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useLoginMutation,
  useLogoutMutation,
  useGetCurrentUserQuery,
  useGetMeQuery,
  useUpdateProfileMutation,
  useChangePasswordMutation,
} = authApi;

/**
 * features/projects/api/projects.api.js
 */
import { api } from '../../../services/apiSlice';

export const projectsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    listProjects: builder.query({
      query: (params) => ({ url: '/projects', params }),
      providesTags: ['Projects'],
    }),
    getProjectById: builder.query({
      query: (id) => `/projects/${id}`,
      providesTags: (result, error, id) => [{ type: 'Projects', id }],
    }),
    createProject: builder.mutation({
      query: (body) => ({ url: '/projects', method: 'POST', body }),
      invalidatesTags: ['Projects'],
    }),
    updateProject: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/projects/${id}`, method: 'PUT', body }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Projects', id }, 'Projects'],
    }),
    deleteProject: builder.mutation({
      query: (id) => ({ url: `/projects/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Projects'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListProjectsQuery,
  useGetProjectByIdQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
} = projectsApi;

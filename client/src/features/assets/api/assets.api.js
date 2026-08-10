import { api } from '../../../services/apiSlice';

export const assetsApi = api.injectEndpoints({
  endpoints: builder => ({
    getAssetsDashboard: builder.query({ query: () => '/assets/dashboard', providesTags: ['Assets'] }),
    listAssets: builder.query({ query: params => ({ url: '/assets', params }), providesTags: ['Assets'] }),
    getAsset: builder.query({ query: id => `/assets/${id}`, providesTags: (r,e,id) => [{ type: 'Assets', id }] }),
    getEmployeeAssets: builder.query({ query: id => `/assets/employee/${id}`, providesTags: ['Assets'] }),
    createAsset: builder.mutation({ query: body => ({ url: '/assets', method: 'POST', body }), invalidatesTags: ['Assets', 'Exits'] }),
    updateAsset: builder.mutation({ query: ({ id, ...body }) => ({ url: `/assets/${id}`, method: 'PATCH', body }), invalidatesTags: ['Assets'] }),
    assignAsset: builder.mutation({ query: ({ id, ...body }) => ({ url: `/assets/${id}/assign`, method: 'POST', body }), invalidatesTags: ['Assets', 'Exits', 'Notifications'] }),
    returnAsset: builder.mutation({ query: ({ id, ...body }) => ({ url: `/assets/${id}/return`, method: 'POST', body }), invalidatesTags: ['Assets', 'Exits'] }),
    changeAssetStatus: builder.mutation({ query: ({ id, ...body }) => ({ url: `/assets/${id}/status`, method: 'POST', body }), invalidatesTags: ['Assets', 'Exits'] }),
    addAssetMaintenance: builder.mutation({ query: ({ id, ...body }) => ({ url: `/assets/${id}/maintenance`, method: 'POST', body }), invalidatesTags: ['Assets'] }),
    updateAssetMaintenance: builder.mutation({ query: ({ id, maintenanceId, ...body }) => ({ url: `/assets/${id}/maintenance/${maintenanceId}`, method: 'PATCH', body }), invalidatesTags: ['Assets'] }),
  }),
});

export const {
  useGetAssetsDashboardQuery, useListAssetsQuery, useGetAssetQuery, useGetEmployeeAssetsQuery,
  useCreateAssetMutation, useUpdateAssetMutation, useAssignAssetMutation, useReturnAssetMutation,
  useChangeAssetStatusMutation, useAddAssetMaintenanceMutation, useUpdateAssetMaintenanceMutation,
} = assetsApi;

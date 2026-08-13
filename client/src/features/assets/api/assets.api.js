import { api } from '../../../services/apiSlice';

export const assetsApi = api.injectEndpoints({
  endpoints: builder => ({
    getAssetTypes: builder.query({ query: () => '/assets/types', providesTags: ['Assets'] }),
    createAssetType: builder.mutation({ query: body => ({ url: '/assets/types', method: 'POST', body }), invalidatesTags: ['Assets'] }),
    getAssetsDashboard: builder.query({ query: () => '/assets/dashboard', providesTags: ['Assets'] }),
    listAssets: builder.query({ query: params => ({ url: '/assets', params }), providesTags: ['Assets'] }),
    getAsset: builder.query({ query: id => `/assets/${id}`, providesTags: (r,e,id) => [{ type: 'Assets', id }] }),
    getEmployeeAssets: builder.query({ query: id => `/assets/employee/${id}`, providesTags: ['Assets'] }),
    getEmployeeAssetAllocations: builder.query({ query: () => '/assets/employee-allocations', providesTags: ['Assets'] }),
    getEmployeeAllocationOptions: builder.query({ query: id => `/assets/employee-allocations/${id}`, providesTags: ['Assets'] }),
    syncEmployeeAssets: builder.mutation({ query: ({ employeeId, ...body }) => ({ url: `/assets/employee-allocations/${employeeId}`, method: 'PUT', body }), invalidatesTags: ['Assets', 'Exits', 'Notifications'] }),
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
  useGetAssetTypesQuery, useCreateAssetTypeMutation,
  useGetAssetsDashboardQuery, useListAssetsQuery, useGetAssetQuery, useGetEmployeeAssetsQuery,
  useGetEmployeeAssetAllocationsQuery, useGetEmployeeAllocationOptionsQuery, useSyncEmployeeAssetsMutation,
  useCreateAssetMutation, useUpdateAssetMutation, useAssignAssetMutation, useReturnAssetMutation,
  useChangeAssetStatusMutation, useAddAssetMaintenanceMutation, useUpdateAssetMaintenanceMutation,
} = assetsApi;

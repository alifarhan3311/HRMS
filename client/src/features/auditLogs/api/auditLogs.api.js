import { api } from '../../../services/apiSlice';

export const auditLogsApi = api.injectEndpoints({
  endpoints: builder => ({
    listAuditLogs: builder.query({
      query: params => ({ url: '/audit-logs', params }),
      providesTags: ['AuditLogs'],
    }),
  }),
});

export const { useListAuditLogsQuery } = auditLogsApi;

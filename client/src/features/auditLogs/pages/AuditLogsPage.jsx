import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { useListAuditLogsQuery } from '../api/auditLogs.api';

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch, isFetching } = useListAuditLogsQuery({ page, limit: 20 });
  const logs = data?.items || [];
  
  const fmtDate = (iso) => new Date(iso).toLocaleString('en-PK', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <FileText className="text-primary" /> Audit Logs
          </h1>
          <p className="text-sm text-muted-foreground">Track system activities and changes.</p>
        </div>
        <Button variant="outline" loading={isFetching} onClick={refetch}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Action</th>
                <th className="px-4 py-3 font-semibold">Method</th>
                <th className="px-4 py-3 font-semibold">Path</th>
                <th className="px-4 py-3 font-semibold">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-muted-foreground">Loading audit logs...</td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-destructive">Failed to load audit logs.</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-muted-foreground">No audit logs found.</td>
                </tr>
              ) : (
                logs.map((log, i) => (
                  <motion.tr 
                    key={log._id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDate(log.createdAt)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {log.userId ? (
                        <div className="flex flex-col">
                          <span className="font-medium">{log.userId.fullName}</span>
                          <span className="text-xs text-muted-foreground">{log.userId.employeeCode}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">System</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-primary">{log.action}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        log.method === 'POST' ? 'bg-emerald-500/10 text-emerald-600' :
                        log.method === 'PUT' || log.method === 'PATCH' ? 'bg-amber-500/10 text-amber-600' :
                        log.method === 'DELETE' ? 'bg-destructive/10 text-destructive' :
                        'bg-blue-500/10 text-blue-600'
                      }`}>
                        {log.method}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs max-w-[200px] truncate" title={log.path}>
                      {log.path}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{log.ipAddress || '-'}</td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data?.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border p-4">
            <p className="text-sm text-muted-foreground">
              Showing <span className="font-medium">{(page - 1) * 20 + 1}</span> to <span className="font-medium">{Math.min(page * 20, data.total)}</span> of <span className="font-medium">{data.total}</span> results
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                disabled={page === data.totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

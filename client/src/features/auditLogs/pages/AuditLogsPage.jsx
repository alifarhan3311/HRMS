import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, RefreshCw, ChevronLeft, ChevronRight, Eye, X } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { useListAuditLogsQuery } from '../api/auditLogs.api';

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState(null);
  const { data, isLoading, isError, refetch, isFetching } = useListAuditLogsQuery({ page, limit: 20 });
  const logs = data?.items || [];
  
  const fmtDate = (iso) => new Date(iso).toLocaleString('en-PK', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const formatAction = (action, path) => {
    if (action === 'post.auth' && path.includes('login')) return 'User Login';
    if (action === 'post.auth' && path.includes('socket-token')) return 'Socket Authentication';
    if (action === 'post.leaves') return 'Applied for Leave';
    if (action === 'patch.leaves') return 'Actioned Leave Request';
    if (action === 'patch.notifications') return 'Marked Notification Read';
    if (action === 'post.attendance') return 'Marked Attendance';
    if (action === 'patch.attendance') return 'Actioned Attendance Request';
    if (action === 'delete.payroll') return 'Deleted Payroll';
    if (action === 'post.payroll') return 'Generated Payroll';
    
    // Generic fallback for standard resource mutations
    const parts = action.split('.');
    if (parts.length === 2) {
      const verbMap = { post: 'Created', patch: 'Updated', put: 'Updated', delete: 'Deleted' };
      const verb = verbMap[parts[0]] || parts[0];
      const resource = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
      return `${verb} ${resource}`;
    }
    return action;
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto relative">
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
                <th className="px-4 py-3 font-semibold text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan="7" className="p-12 text-center text-muted-foreground">Loading audit logs...</td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan="7" className="p-12 text-center text-destructive">Failed to load audit logs.</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-12 text-center text-muted-foreground">No audit logs found.</td>
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
                    <td className="px-4 py-3 font-medium text-primary">
                      <div className="flex flex-col">
                        <span>{formatAction(log.action, log.path)}</span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{log.action}</span>
                      </div>
                    </td>
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
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
                        <Eye className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                      </Button>
                    </td>
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

      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card w-full max-w-3xl max-h-[85vh] rounded-2xl border border-border shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-border bg-muted/20">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Log Details
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    {fmtDate(selectedLog.createdAt)} • {formatAction(selectedLog.action, selectedLog.path)}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSelectedLog(null)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="p-5 overflow-y-auto space-y-4 text-sm custom-scrollbar">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1 col-span-2 sm:col-span-1 border border-primary/20 bg-primary/5 p-3 rounded-xl">
                    <span className="text-xs text-primary font-semibold uppercase tracking-wider">Action Performed</span>
                    <p className="font-bold text-primary text-base">{formatAction(selectedLog.action, selectedLog.path)}</p>
                  </div>
                  <div className="space-y-1 col-span-2 sm:col-span-1 border border-border bg-muted/10 p-3 rounded-xl">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">User</span>
                    <p className="font-medium">{selectedLog.userId?.fullName || 'System'} {selectedLog.userId?.employeeCode ? `(${selectedLog.userId.employeeCode})` : ''}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Endpoint</span>
                    <p className="font-mono text-xs break-all bg-muted/50 p-1.5 rounded">{selectedLog.method} {selectedLog.path}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Status Code</span>
                    <p className="font-medium">{selectedLog.statusCode || 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">IP Address</span>
                    <p className="font-medium">{selectedLog.ipAddress || 'N/A'}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">User Agent</span>
                  <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded border border-border/50 break-words">
                    {selectedLog.userAgent || 'Unknown'}
                  </p>
                </div>

                {selectedLog.resourceType && (
                  <div className="grid grid-cols-2 gap-4 bg-muted/30 p-3 rounded-lg border border-border">
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Resource Type</span>
                      <p className="font-medium">{selectedLog.resourceType}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Resource ID</span>
                      <p className="font-mono text-xs truncate" title={selectedLog.resourceId}>{selectedLog.resourceId || 'N/A'}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-2 pt-2">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Payload / Changes</span>
                  {selectedLog.changes && typeof selectedLog.changes === 'object' && Object.keys(selectedLog.changes).length > 0 ? (
                    <div className="bg-[#1e1e1e] text-[#d4d4d4] p-4 rounded-lg overflow-x-auto text-xs font-mono border border-border shadow-inner">
                      <pre>{JSON.stringify(selectedLog.changes, null, 2)}</pre>
                    </div>
                  ) : (
                    <div className="bg-muted/30 text-muted-foreground p-4 rounded-lg text-sm text-center border border-dashed border-border">
                      No payload or changes recorded for this action.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

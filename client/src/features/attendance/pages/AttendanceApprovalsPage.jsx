import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { CheckCircle2, Clock3, FileCheck2, Search, XCircle } from 'lucide-react';
import { toast } from '../../../utils/toast';
import { Badge } from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import { Modal, ModalFooter } from '../../../components/ui/Modal';
import {
  useGetRegularizationApprovalsQuery,
  useReviewRegularizationMutation,
} from '../api/attendance.api';

const statusVariant = { pending: 'yellow', approved: 'green', rejected: 'red' };
const requestLabels = { time_correction: 'Time Correction', late_waiver: 'Late Waiver' };

function formatDate(value, withTime = false) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-PK', {
    day: '2-digit', month: 'short', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(value));
}

function SummaryCard({ label, value, icon: Icon, tone }) {
  return (
    <div className="glass-card flex items-center justify-between p-5">
      <div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>
      <div className={`rounded-xl p-3 ${tone}`}><Icon className="h-5 w-5" /></div>
    </div>
  );
}

export default function AttendanceApprovalsPage() {
  const user = useSelector((state) => state.auth.user);
  const [filters, setFilters] = useState({ status: '', employeeId: '', requestType: '', department: '', dateFrom: '', dateTo: '' });
  const [review, setReview] = useState(null);
  const [remarks, setRemarks] = useState('');
  const query = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
  const { data, isLoading, isFetching, refetch } = useGetRegularizationApprovalsQuery(query);
  const [reviewRequest, { isLoading: reviewing }] = useReviewRegularizationMutation();
  const records = data?.data?.records || [];
  const summary = data?.data?.summary || { total: 0, pending: 0, approved: 0, rejected: 0 };
  const employees = useMemo(() => {
    const map = new Map();
    records.forEach((record) => {
      if (record.employeeId?._id) map.set(record.employeeId._id, record.employeeId.fullName);
    });
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [records]);
  const departments = useMemo(() => [...new Set(records.map((record) => record.employeeId?.department).filter(Boolean))].sort(), [records]);

  const canReview = (record) => {
    if (record.regularizationStatus !== 'pending') return false;
    const assigned = record.regularization?.assignedApprover?._id || record.regularization?.assignedApprover;
    const stage = record.regularization?.approvalStage
      || (['hr', 'super_admin'].includes(record.regularization?.assignedApprover?.role) ? 'hr' : 'reporting');
    if (stage === 'hr' && ['hr', 'super_admin'].includes(user?.role)) return true;
    return String(assigned || '') === String(user?.id || user?._id || '');
  };

  async function submitReview(action) {
    if (action === 'reject' && !remarks.trim()) return toast.error('Rejection reason is required');
    try {
      await reviewRequest({ id: review._id, action, remarks: remarks.trim() }).unwrap();
      toast.success(`Attendance request ${action === 'approve' ? 'approved' : 'rejected'}`);
      setReview(null);
      setRemarks('');
    } catch (error) {
      toast.error(error?.data?.error?.message || 'Unable to review request');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Attendance Approvals</h1><p className="text-sm text-muted-foreground">Review attendance corrections from one place.</p></div>
        <Button variant="secondary" onClick={refetch} loading={isFetching}>Refresh</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total Requests" value={summary.total} icon={FileCheck2} tone="bg-primary/10 text-primary" />
        <SummaryCard label="Pending" value={summary.pending} icon={Clock3} tone="bg-amber-500/10 text-amber-500" />
        <SummaryCard label="Approved" value={summary.approved} icon={CheckCircle2} tone="bg-emerald-500/10 text-emerald-500" />
        <SummaryCard label="Rejected" value={summary.rejected} icon={XCircle} tone="bg-red-500/10 text-red-500" />
      </div>

      <div className="glass-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <select className="rounded-lg border border-border bg-background px-3 py-2 text-sm" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
            <option value="">All Statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
          </select>
          <select className="rounded-lg border border-border bg-background px-3 py-2 text-sm" value={filters.employeeId} onChange={(event) => setFilters({ ...filters, employeeId: event.target.value })}>
            <option value="">All Employees</option>{employees.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <select className="rounded-lg border border-border bg-background px-3 py-2 text-sm" value={filters.department} onChange={(event) => setFilters({ ...filters, department: event.target.value })}>
            <option value="">All Departments</option>{departments.map((department) => <option key={department}>{department}</option>)}
          </select>
          <select className="rounded-lg border border-border bg-background px-3 py-2 text-sm" value={filters.requestType} onChange={(event) => setFilters({ ...filters, requestType: event.target.value })}>
            <option value="">All Request Types</option><option value="time_correction">Time Correction</option><option value="late_waiver">Late Waiver</option>
          </select>
          <input type="date" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" value={filters.dateFrom} onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })} aria-label="From date" />
          <input type="date" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" value={filters.dateTo} onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })} aria-label="To date" />
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {isLoading ? <div className="p-12 text-center text-muted-foreground">Loading approvals...</div> : records.length === 0 ? (
          <div className="p-12 text-center"><Search className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 font-medium">No attendance requests found</p></div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-3">Employee</th><th className="px-5 py-3">Attendance Date</th><th className="px-5 py-3">Request</th><th className="px-5 py-3">Assigned To</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Requested</th><th className="px-5 py-3 text-right">Action</th></tr></thead>
            <tbody className="divide-y divide-border">{records.map((record) => <tr key={record._id} className="hover:bg-muted/20">
              <td className="px-5 py-4"><p className="font-medium">{record.employeeId?.fullName || record.employeeName || 'Former employee'}</p><p className="text-xs text-muted-foreground">{record.employeeId?.department || 'No department'}</p></td>
              <td className="px-5 py-4">{formatDate(record.date)}</td>
              <td className="px-5 py-4"><p>{requestLabels[record.regularization?.requestType] || 'Attendance Correction'}</p><p className="max-w-xs truncate text-xs text-muted-foreground">{record.regularization?.reason || 'No reason provided'}</p>{record.regularizationStatus === 'pending' && <p className="mt-1 text-xs font-medium text-primary">{record.regularization?.approvalStage === 'hr' ? 'HR final approval' : 'Reporting approval'}</p>}</td>
              <td className="px-5 py-4">{record.regularization?.assignedApprover?.fullName || '—'}</td>
              <td className="px-5 py-4"><Badge variant={statusVariant[record.regularizationStatus]}>{record.regularizationStatus}</Badge></td>
              <td className="px-5 py-4">{formatDate(record.regularization?.requestedAt, true)}</td>
              <td className="px-5 py-4 text-right">{canReview(record) ? <Button size="sm" onClick={() => { setReview(record); setRemarks(''); }}>Review</Button> : <Button size="sm" variant="ghost" onClick={() => { setReview(record); setRemarks(record.regularization?.remarks || ''); }}>View</Button>}</td>
            </tr>)}</tbody>
          </table></div>
        )}
      </div>

      <Modal isOpen={Boolean(review)} onClose={() => setReview(null)} title={canReview(review || {}) ? 'Review Attendance Request' : 'Attendance Request Details'} size="sm">
        {review && <div className="space-y-4 p-6">
          <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm"><p className="font-semibold">{review.employeeId?.fullName}</p><p className="text-muted-foreground">{formatDate(review.date)} · {requestLabels[review.regularization?.requestType]}</p><p className="mt-3">{review.regularization?.reason || 'No reason provided'}</p></div>
          {review.regularization?.requestedSignInTime && <p className="text-sm"><span className="text-muted-foreground">Requested sign-in:</span> {formatDate(review.regularization.requestedSignInTime, true)}</p>}
          {review.regularization?.requestedSignOutTime && <p className="text-sm"><span className="text-muted-foreground">Requested sign-out:</span> {formatDate(review.regularization.requestedSignOutTime, true)}</p>}
          {review.regularization?.reportingReviewedBy && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm"><p className="font-medium text-emerald-600">Reporting approval completed</p><p>{review.regularization.reportingReviewedBy.fullName} · {formatDate(review.regularization.reportingReviewedAt, true)}</p>{review.regularization.reportingRemarks && <p className="mt-1 text-muted-foreground">{review.regularization.reportingRemarks}</p>}</div>}
          {canReview(review) ? <textarea className="min-h-24 w-full rounded-xl border border-border bg-background p-3 text-sm" value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Remarks (required when rejecting)" /> : review.regularization?.remarks && <p className="rounded-xl border border-border p-3 text-sm">{review.regularization.remarks}</p>}
        </div>}
        <ModalFooter>{canReview(review || {}) ? <><Button variant="danger" onClick={() => submitReview('reject')} loading={reviewing}>Reject</Button><Button onClick={() => submitReview('approve')} loading={reviewing}>Approve</Button></> : <Button variant="secondary" onClick={() => setReview(null)}>Close</Button>}</ModalFooter>
      </Modal>
    </div>
  );
}

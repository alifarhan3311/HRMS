/**
 * features/leaves/pages/LeavesListPage.jsx
 * Full leave management page:
 *  - Leave balance cards
 *  - Apply leave form
 *  - Leave requests table with status
 *  - Approval flow for managers/HR
 *  - Cancel with confirm
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import {
  CalendarDays, Plus, CheckCircle2, XCircle, Clock, RefreshCw,
  ChevronLeft, ChevronRight, AlertCircle, Ban,
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  useListLeavesQuery, useApplyLeaveMutation, useApproveLeaveMutation,
  useRejectLeaveMutation, useCancelLeaveMutation, useGetPendingApprovalsQuery,
} from '../api/leaves.api';
import { toast } from '../../../utils/toast';
import { useGetEmployeeByIdQuery } from '../../employees/api/employees.api';
import StatCard from '../../../components/ui/StatCard';
import Button from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Modal, ModalFooter } from '../../../components/ui/Modal';
import { useFormDraft } from '../../../hooks/useFormDraft';
import { Input, Select, Textarea } from '../../../components/ui/Input';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Avatar } from '../../../components/ui/Avatar';
import { Skeleton } from '../../../components/ui/Skeleton';

// ─── Constants ───────────────────────────────────────────────────────────────
const DEFAULT_LEAVE_TYPES = ['paid', 'casual', 'sick', 'annual'];
const CHART_COLORS = ['#C9971F', '#10b981', '#ef4444', '#64748b', '#8b5cf6', '#0ea5e9', '#f97316'];
const STATUS_STYLES = {
  pending:   { label: 'Pending',   variant: 'yellow' },
  approved:  { label: 'Approved',  variant: 'green'  },
  rejected:  { label: 'Rejected',  variant: 'red'    },
  cancelled: { label: 'Cancelled', variant: 'gray'   },
};
const STAGE_ROLES = { 1: 'Team Lead / Manager', 2: 'HR', 3: 'Admin' };

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
}
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

// ─── Leave Balance Cards ─────────────────────────────────────────────────────
function LeaveBalanceCards({ balance }) {
  if (!balance) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Object.entries(balance).map(([type, bal]) => {
        const remaining = (bal.available || 0) - (bal.used || 0);
        const pct = bal.available > 0 ? Math.round((bal.used / bal.available) * 100) : 0;
        return (
          <motion.div key={type} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="glass-card p-4 hover:shadow-glow hover:-translate-y-0.5 transition-all">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              {capitalize(type)} Leave
            </p>
            <div className="flex items-end justify-between mb-2">
              <span className="text-2xl font-bold">{remaining}</span>
              <span className="text-xs text-muted-foreground">Remaining</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span>Policy: <strong className="text-foreground">{bal.entitlement ?? bal.available}</strong></span>
              <span>Carried: <strong className="text-foreground">{bal.carriedForward || 0}</strong></span>
              <span>Used: <strong className="text-foreground">{bal.used || 0}</strong></span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Total balance: {bal.available} · {pct}% used</p>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Apply Leave Form ────────────────────────────────────────────────────────
function ApplyLeaveForm({ onSubmit, onClose, isLoading, leaveTypes, draftKey }) {
  const [form, setForm, clearDraft] = useFormDraft(draftKey, {
    leaveType: leaveTypes[0] || '', startDate: '', endDate: '', reason: '', emergencyContact: '',
  });
  const [errors, setErrors] = useState({});
  useEffect(() => {
    if (!leaveTypes.includes(form.leaveType)) {
      setForm((previous) => ({ ...previous, leaveType: leaveTypes[0] || '' }));
    }
  }, [form.leaveType, leaveTypes]);

  function set(k, v) { setForm(p => ({ ...p, [k]: v })); if (errors[k]) setErrors(p => ({ ...p, [k]: '' })); }

  function validate() {
    const e = {};
    if (!form.leaveType) e.leaveType = 'Leave type required';
    if (!form.startDate) e.startDate = 'Start date required';
    if (!form.endDate) e.endDate = 'End date required';
    if (form.endDate && form.startDate && form.endDate < form.startDate) e.endDate = 'End must be after start';
    if (form.leaveType !== 'casual' && !form.reason.trim()) e.reason = 'Please provide a reason';
    setErrors(e);
    return !Object.keys(e).length;
  }

  // Calculate working days preview
  function workingDays() {
    if (!form.startDate || !form.endDate) return 0;
    let count = 0;
    const cur = new Date(form.startDate);
    const end = new Date(form.endDate);
    while (cur <= end) { if (cur.getDay() !== 0 && cur.getDay() !== 6) count++; cur.setDate(cur.getDate() + 1); }
    return count;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    const saved = await onSubmit(form);
    if (saved !== false) clearDraft();
  }
  const days = workingDays();

  return (
    <form onSubmit={handleSubmit}>
      <div className="px-6 py-5 space-y-4">
        <Select label="Leave Type" required value={form.leaveType} onChange={(e) => set('leaveType', e.target.value)}
          error={errors.leaveType}>
          {leaveTypes.map(t => <option key={t} value={t}>{capitalize(t)} Leave</option>)}
        </Select>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Start Date" required type="date" value={form.startDate}
            onChange={(e) => set('startDate', e.target.value)} error={errors.startDate} />
          <Input label="End Date" required type="date" value={form.endDate}
            onChange={(e) => set('endDate', e.target.value)} error={errors.endDate} />
        </div>
        {days > 0 && (
          <div className="rounded-lg bg-primary/5 border border-primary/10 px-3 py-2 text-sm">
            <span className="font-medium text-primary">{days} working day{days !== 1 ? 's' : ''}</span>
            <span className="text-muted-foreground ml-1">will be applied for this period.</span>
          </div>
        )}
        <Textarea label={form.leaveType === 'casual' ? 'Reason (optional)' : 'Reason'} required={form.leaveType !== 'casual'} value={form.reason}
          onChange={(e) => set('reason', e.target.value)} error={errors.reason}
          placeholder={form.leaveType === 'casual' ? 'Add a reason if you want...' : 'Please explain why you need this leave...'} />
        <Input label="Emergency Contact (optional)" value={form.emergencyContact}
          onChange={(e) => set('emergencyContact', e.target.value)}
          placeholder="+92 300 1234567" />
        <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
          Approval Flow: <span className="text-foreground font-medium">You → Team Lead → HR → Admin</span>
        </div>
      </div>
      <ModalFooter>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" size="sm" disabled={isLoading || days === 0}>
          {isLoading ? 'Submitting...' : 'Submit Request'}
        </Button>
      </ModalFooter>
    </form>
  );
}

// ─── Approval Chain Timeline ─────────────────────────────────────────────────
function ApprovalTimeline({ chain = [], currentStage }) {
  return (
    <div className="flex items-center gap-0 mt-2">
      {chain.map((step, i) => {
        const isDone = step.status === 'approved';
        const isRej  = step.status === 'rejected';
        const isActive = step.stage === currentStage && step.status === 'pending';
        return (
          <div key={step.stage} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                ${isDone ? 'bg-emerald-500 border-emerald-500 text-white' :
                  isRej  ? 'bg-red-500 border-red-500 text-white' :
                  isActive ? 'bg-primary border-primary text-white animate-pulse' :
                  'bg-muted border-border text-muted-foreground'}`}>
                {isDone ? '✓' : isRej ? '✗' : step.stage}
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 whitespace-nowrap">
                {STAGE_ROLES[step.stage]}
              </span>
            </div>
            {i < chain.length - 1 && (
              <div className={`h-0.5 w-8 mx-0.5 -mt-5 transition-colors ${isDone ? 'bg-emerald-400' : 'bg-border'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LeavesListPage() {
  const { user } = useSelector((s) => s.auth);
  const isApprover = ['hr', 'admin', 'super_admin', 'manager', 'team_lead'].includes(user?.role);

  const [applyOpen, setApplyOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [reviewTarget, setReviewTarget] = useState(null); // { leave, action }
  const [remarkText, setRemarkText] = useState('');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: '', leaveType: '' });

  const { data: empData } = useGetEmployeeByIdQuery(user?.id, { skip: !user?.id });
  const balance = empData?.data?.leaveBalance;
  const enabledLeaveTypes = empData?.data?.enabledLeaveTypes || DEFAULT_LEAVE_TYPES;

  const { data, isLoading, isFetching, refetch } = useListLeavesQuery({ page, limit: 15, ...filters });
  const { data: analyticsData, refetch: refetchAnalytics } = useListLeavesQuery({ limit: 100, sort: '-createdAt' });
  const { data: pendingData, refetch: refetchPending } = useGetPendingApprovalsQuery(undefined, { skip: !isApprover });
  const [applyLeave, { isLoading: applying }] = useApplyLeaveMutation();
  const [approveLeave, { isLoading: approving }] = useApproveLeaveMutation();
  const [rejectLeave, { isLoading: rejecting }] = useRejectLeaveMutation();
  const [cancelLeave, { isLoading: cancelling }] = useCancelLeaveMutation();

  const leaves = data?.items || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const pending = pendingData?.data || [];
  const analyticsLeaves = analyticsData?.items || [];
  const balanceChartData = Object.entries(balance || {}).map(([type, values]) => ({
    name: capitalize(type),
    used: Number(values?.used || 0),
    remaining: Math.max(Number(values?.available || 0) - Number(values?.used || 0), 0),
  }));
  const statusCounts = analyticsLeaves.reduce((counts, leave) => {
    counts[leave.status] = (counts[leave.status] || 0) + 1;
    return counts;
  }, {});
  const statusChartData = Object.entries(statusCounts).map(([name, value]) => ({ name: capitalize(name), value }));
  const typeDays = analyticsLeaves.reduce((totals, leave) => {
    if (enabledLeaveTypes.includes(leave.leaveType)) {
      totals[leave.leaveType] = (totals[leave.leaveType] || 0) + Number(leave.totalDays || 0);
    }
    return totals;
  }, {});
  const typeChartData = Object.entries(typeDays).map(([name, days]) => ({ name: capitalize(name), days }));

  async function handleApply(payload) {
    try { await applyLeave(payload).unwrap(); toast.success('Leave request submitted'); setApplyOpen(false); return true; }
    catch (err) { toast.error(err?.data?.error?.message || 'Failed to submit'); return false; }
  }
  async function handleApprove() {
    try { await approveLeave({ id: reviewTarget._id, remarks: remarkText }).unwrap();
      setReviewTarget(null); setRemarkText('');
      await Promise.allSettled([refetch(), refetchAnalytics(), refetchPending()]);
      toast.success('Leave approved'); }
    catch (err) { toast.error(err?.data?.error?.message || 'Failed to approve'); }
  }
  async function handleReject() {
    try { await rejectLeave({ id: reviewTarget._id, remarks: remarkText }).unwrap();
      setReviewTarget(null); setRemarkText('');
      await Promise.allSettled([refetch(), refetchAnalytics(), refetchPending()]);
      toast.success('Leave rejected'); }
    catch (err) { toast.error(err?.data?.error?.message || 'Failed to reject'); }
  }
  async function handleCancel() {
    try { await cancelLeave({ id: cancelTarget._id, reason: 'Cancelled by user' }).unwrap();
      toast.success('Leave cancelled'); setCancelTarget(null); }
    catch (err) { toast.error(err?.data?.error?.message || 'Failed to cancel'); }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leave Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Apply for leave and track approval status</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="primary" size="sm" className="gap-1.5" onClick={() => setApplyOpen(true)}>
            <Plus className="h-4 w-4" /> Apply for Leave
          </Button>
        </div>
      </motion.div>

      {/* Balance cards */}
      {balance && <LeaveBalanceCards balance={balance} />}

      {/* Leave analytics */}
      <div className="grid gap-5 xl:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 xl:col-span-2">
          <h3 className="font-semibold mb-4">Leave Balance Usage</h3>
          {balanceChartData.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={balanceChartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="used" stackId="balance" fill="#C9971F" radius={[0, 0, 4, 4]} />
                <Bar dataKey="remaining" stackId="balance" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-sm text-muted-foreground">No balance data available</div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
          <h3 className="font-semibold mb-4">Requests by Status</h3>
          {statusChartData.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={statusChartData} dataKey="value" nameKey="name" cx="50%" cy="46%" innerRadius={48}
                  outerRadius={78} paddingAngle={3} label={({ name, value }) => `${name}: ${value}`}>
                  {statusChartData.map((_, index) => <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-sm text-muted-foreground">No leave requests yet</div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 xl:col-span-3">
          <h3 className="font-semibold mb-4">Requested Days by Leave Type</h3>
          {typeChartData.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={typeChartData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={85} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => [`${value} days`, 'Requested']} />
                <Bar dataKey="days" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">No leave usage data available</div>
          )}
        </motion.div>
      </div>

      {/* Pending approvals (approvers only) */}
      {isApprover && pending.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            Pending Approvals ({pending.length})
          </h3>
          <div className="space-y-3">
            {pending.map((leave) => (
              <div key={leave._id} className="flex items-center justify-between gap-4 p-3 rounded-xl border border-border hover:bg-accent/30 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={leave.employeeId?.fullName || leave.employeeName} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{leave.employeeId?.fullName || leave.employeeName || 'Former employee'}</p>
                    <p className="text-xs text-muted-foreground">
                      {capitalize(leave.leaveType)} · {fmtDate(leave.startDate)} – {fmtDate(leave.endDate)} ({leave.totalDays}d)
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{leave.reason}</p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="primary" className="bg-emerald-600 hover:bg-emerald-700 gap-1"
                    onClick={() => { setReviewTarget(leave); setRemarkText(''); }}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Review
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* My Leaves table */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
          <h3 className="font-semibold flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Leave Requests
          </h3>
          <div className="ml-auto flex gap-2">
            <select className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
              value={filters.status} onChange={(e) => { setFilters(p => ({ ...p, status: e.target.value })); setPage(1); }}>
              <option value="">All Status</option>
              {Object.keys(STATUS_STYLES).map(s => <option key={s} value={s}>{STATUS_STYLES[s].label}</option>)}
            </select>
            <select className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
              value={filters.leaveType} onChange={(e) => { setFilters(p => ({ ...p, leaveType: e.target.value })); setPage(1); }}>
              <option value="">All Types</option>
              {enabledLeaveTypes.map(t => <option key={t} value={t}>{capitalize(t)}</option>)}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : leaves.length === 0 ? (
          <div className="py-16 text-center">
            <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">No leave requests found</p>
            <p className="text-sm text-muted-foreground mt-1">Apply for leave using the button above.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {leaves.map((leave, i) => {
              const st = STATUS_STYLES[leave.status];
              const isOwner = leave.employeeId?._id === user?.id || leave.employeeId === user?.id;
              return (
                <motion.div key={leave._id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="px-5 py-4 hover:bg-accent/30 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <Avatar name={leave.employeeId?.fullName || leave.employeeName || user?.fullName} size="sm" className="mt-0.5" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{leave.employeeId?.fullName || leave.employeeName || 'You'}</span>
                          <Badge variant={st.variant}>{st.label}</Badge>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                            {capitalize(leave.leaveType)}
                          </span>
                          <span className="text-xs text-muted-foreground">{leave.totalDays}d</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {fmtDate(leave.startDate)} – {fmtDate(leave.endDate)}
                        </p>
                        {leave.reason && <p className="text-xs text-muted-foreground mt-0.5 truncate">{leave.reason}</p>}
                        {leave.approvalChain?.length > 0 && (
                          <ApprovalTimeline chain={leave.approvalChain} currentStage={leave.currentStage} />
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {leave.status === 'pending' && isOwner && (
                        <button onClick={() => setCancelTarget(leave)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Cancel leave">
                          <Ban className="h-4 w-4" />
                        </button>
                      )}
                      {leave.status === 'pending' && isApprover && !isOwner && (
                        <Button size="sm" variant="secondary" className="gap-1"
                          onClick={() => { setReviewTarget(leave); setRemarkText(''); }}>
                          Review
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">{total} requests</span>
            <div className="flex gap-1">
              <Button variant="secondary" size="sm" className="px-2" onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-3 py-1 text-xs text-muted-foreground">{page}/{totalPages}</span>
              <Button variant="secondary" size="sm" className="px-2" onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Apply Modal */}
      <Modal isOpen={applyOpen} onClose={() => setApplyOpen(false)} title="Apply for Leave" size="md">
        <ApplyLeaveForm onSubmit={handleApply} onClose={() => setApplyOpen(false)} isLoading={applying}
          leaveTypes={enabledLeaveTypes} draftKey={`hrms:draft:leave:create:${user?.id || 'user'}`} />
      </Modal>

      {/* Review Modal */}
      <Modal isOpen={!!reviewTarget} onClose={() => setReviewTarget(null)} title="Review Leave Request" size="sm">
        {reviewTarget && (
          <div className="px-6 py-5 space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40">
              <Avatar name={reviewTarget.employeeId?.fullName || reviewTarget.employeeName} size="sm" />
              <div>
                <p className="font-medium text-sm">{reviewTarget.employeeId?.fullName || reviewTarget.employeeName || 'Former employee'}</p>
                <p className="text-xs text-muted-foreground">{capitalize(reviewTarget.leaveType)} · {reviewTarget.totalDays} days</p>
                <p className="text-xs text-muted-foreground">{fmtDate(reviewTarget.startDate)} – {fmtDate(reviewTarget.endDate)}</p>
              </div>
            </div>
            {reviewTarget.reason && (
              <div className="text-sm border border-border rounded-lg p-3 bg-background">{reviewTarget.reason}</div>
            )}
            <Textarea label="Remarks (optional)" value={remarkText} onChange={(e) => setRemarkText(e.target.value)} placeholder="Add remarks..." />
            <div className="flex gap-3">
              <Button variant="primary" size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-1.5"
                onClick={handleApprove} disabled={approving || rejecting}>
                <CheckCircle2 className="h-4 w-4" />{approving ? 'Approving...' : 'Approve'}
              </Button>
              <Button variant="danger" size="sm" className="flex-1 gap-1.5"
                onClick={handleReject} disabled={approving || rejecting}>
                <XCircle className="h-4 w-4" />{rejecting ? 'Rejecting...' : 'Reject'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Cancel Confirm */}
      <ConfirmDialog isOpen={!!cancelTarget} onCancel={() => setCancelTarget(null)}
        onConfirm={handleCancel} isLoading={cancelling}
        title="Cancel Leave Request"
        message={`Cancel your ${cancelTarget?.leaveType} leave from ${fmtDate(cancelTarget?.startDate)} to ${fmtDate(cancelTarget?.endDate)}?`}
        confirmLabel="Yes, Cancel" />
    </div>
  );
}

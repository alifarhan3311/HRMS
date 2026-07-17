/**
 * features/attendance/pages/AttendanceListPage.jsx
 * Full attendance management page:
 *  - Sign In / Sign Out widget for current user
 *  - Monthly calendar heatmap
 *  - Daily attendance table with filters
 *  - Regularization request
 *  - HR/Admin: manual correction, approve/reject regularizations
 */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import {
  Clock, CheckCircle2, XCircle, AlertCircle, Calendar,
  Filter, ChevronLeft, ChevronRight, Edit, RefreshCw,
} from 'lucide-react';
import {
  useGetTodayAttendanceQuery,
  useGetMonthlySummaryQuery,
  useListAttendanceQuery,
  useSignInMutation,
  useSignOutMutation,
  useManualCorrectionMutation,
  useRequestRegularizationMutation,
  useReviewRegularizationMutation,
  useGetPendingRegularizationsQuery,
} from '../api/attendance.api';
import { toast } from '../../../utils/toast';
import StatCard from '../../../components/ui/StatCard';
import Button from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Modal, ModalFooter } from '../../../components/ui/Modal';
import { Input, Textarea } from '../../../components/ui/Input';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Avatar } from '../../../components/ui/Avatar';

// ─── helpers ────────────────────────────────────────────────────────────────
const STATUS_STYLES = {
  present:  { label: 'Present',  variant: 'green',  dot: 'bg-emerald-500' },
  late:     { label: 'Late',     variant: 'yellow', dot: 'bg-amber-500' },
  absent:   { label: 'Absent',   variant: 'red',    dot: 'bg-red-500' },
  half_day: { label: 'Half Day', variant: 'blue',   dot: 'bg-blue-400' },
  on_leave: { label: 'On Leave', variant: 'purple', dot: 'bg-purple-400' },
  holiday:  { label: 'Holiday',  variant: 'indigo', dot: 'bg-indigo-400' },
  weekend:  { label: 'Weekend',  variant: 'gray',   dot: 'bg-gray-300' },
};

function fmtTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
}

function toLocalDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
function nowYM() {
  const n = new Date();
  return { year: n.getFullYear(), month: n.getMonth() + 1 };
}

// ─── Sign-In/Out Widget ──────────────────────────────────────────────────────
function SignInWidget({ user }) {
  const { data: todayData, isLoading } = useGetTodayAttendanceQuery();
  const [signIn, { isLoading: signingIn }] = useSignInMutation();
  const [signOut, { isLoading: signingOut }] = useSignOutMutation();

  const record = todayData?.data;
  const hasSignedIn = !!record?.signInTime;
  const hasSignedOut = !!record?.signOutTime;

  async function handleSignIn() {
    try {
      await signIn({ method: 'manual' }).unwrap();
      toast.success('Signed in successfully!');
    } catch (err) {
      toast.error(err?.data?.error?.message || 'Sign in failed');
    }
  }
  async function handleSignOut() {
    try {
      await signOut({}).unwrap();
      toast.success('Signed out successfully!');
    } catch (err) {
      toast.error(err?.data?.error?.message || 'Sign out failed');
    }
  }

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6 flex flex-col sm:flex-row items-center gap-6">
      <div className="flex-1 text-center sm:text-left">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Today</p>
        <p className="text-3xl font-bold tabular-nums">{timeStr}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{dateStr}</p>
        {record && (
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            {record.signInTime && (
              <span className="flex items-center gap-1.5 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                Sign In: {fmtTime(record.signInTime)}
                {record.lateMinutes > 0 && (
                  <span className="text-amber-500 text-xs">({record.lateMinutes}m late)</span>
                )}
              </span>
            )}
            {record.signOutTime && (
              <span className="flex items-center gap-1.5 text-blue-600">
                <XCircle className="h-4 w-4" />
                Sign Out: {fmtTime(record.signOutTime)}
              </span>
            )}
            {record.totalHours > 0 && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-4 w-4" />
                {record.totalHours}h worked
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex gap-3">
        {!hasSignedIn && (
          <Button variant="primary" onClick={handleSignIn} disabled={signingIn || isLoading}
            className="gap-2 px-6">
            <CheckCircle2 className="h-4 w-4" />
            {signingIn ? 'Signing In...' : 'Sign In'}
          </Button>
        )}
        {hasSignedIn && !hasSignedOut && (
          <Button variant="secondary" onClick={handleSignOut} disabled={signingOut}
            className="gap-2 px-6 border-amber-300 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20">
            <XCircle className="h-4 w-4" />
            {signingOut ? 'Signing Out...' : 'Sign Out'}
          </Button>
        )}
        {hasSignedOut && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 text-sm font-medium">
            <CheckCircle2 className="h-4 w-4" />
            Day Complete
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Monthly Calendar ────────────────────────────────────────────────────────
function MonthlyCalendar({ year, month, records = [] }) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun

  const recordMap = {};
  records.forEach((r) => {
    const d = new Date(r.date).getDate();
    recordMap[d] = r;
  });

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null); // empty leading cells
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <div className="glass-card p-4">
      <div className="grid grid-cols-7 gap-1 mb-2">
        {days.map((d) => (
          <div key={d} className="text-[11px] font-medium text-muted-foreground text-center py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;
          const rec = recordMap[day];
          const style = rec ? (STATUS_STYLES[rec.status] || STATUS_STYLES.present) : null;
          const isToday = day === new Date().getDate() && month === new Date().getMonth() + 1 && year === new Date().getFullYear();
          return (
            <div key={day} title={rec ? `${style?.label} — In: ${fmtTime(rec.signInTime)} Out: ${fmtTime(rec.signOutTime)}` : ''}
              className={`relative flex flex-col items-center justify-center rounded-lg h-9 text-xs font-medium transition-all cursor-default
                ${isToday ? 'ring-2 ring-primary' : ''}
                ${rec ? `${rec.status === 'present' || rec.status === 'late' ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`  : 'hover:bg-accent'}`}>
              <span className={isToday ? 'text-primary font-bold' : ''}>{day}</span>
              {rec && <div className={`absolute bottom-1 h-1 w-1 rounded-full ${style?.dot}`} />}
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-3">
        {['present','late','absent','half_day','on_leave','holiday'].map((s) => (
          <div key={s} className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <div className={`h-2 w-2 rounded-full ${STATUS_STYLES[s].dot}`} />
            {STATUS_STYLES[s].label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Correction Modal ────────────────────────────────────────────────────────
function CorrectionModal({ record, isOpen, onClose, onSubmit, isLoading }) {
  const [form, setForm] = useState({
    signInTime: record?.signInTime ? new Date(record.signInTime).toISOString().slice(0,16) : '',
    signOutTime: record?.signOutTime ? new Date(record.signOutTime).toISOString().slice(0,16) : '',
    notes: '',
  });
  function set(k, v) { setForm(p => ({ ...p, [k]: v })); }
  function handleSubmit(e) { e.preventDefault(); onSubmit(form); }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manual Attendance Correction" size="sm">
      <form onSubmit={handleSubmit}>
        <div className="px-6 py-5 space-y-4">
          {record && (
            <div className="text-sm text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
              Correcting: <span className="font-medium text-foreground">
                {fmtDate(record.date)}
              </span>
            </div>
          )}
          <Input label="Sign In Time" type="datetime-local" value={form.signInTime}
            onChange={(e) => set('signInTime', e.target.value)} />
          <Input label="Sign Out Time" type="datetime-local" value={form.signOutTime}
            onChange={(e) => set('signOutTime', e.target.value)} />
          <Textarea label="Notes / Reason" value={form.notes}
            onChange={(e) => set('notes', e.target.value)} placeholder="Reason for correction..." />
        </div>
        <ModalFooter>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" size="sm" disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Correction'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

// ─── Regularization Modal ────────────────────────────────────────────────────
function RegularizeModal({ record, isOpen, onClose, onSubmit, isLoading }) {
  const [reason, setReason] = useState('');
  const [requestType, setRequestType] = useState('time_correction');
  const [requestedSignInTime, setRequestedSignInTime] = useState('');
  const [requestedSignOutTime, setRequestedSignOutTime] = useState('');

  useEffect(() => {
    if (!record) return;
    setReason('');
    setRequestType(record.lateMinutes > 0 ? 'late_waiver' : 'time_correction');
    setRequestedSignInTime(toLocalDateTime(record.signInTime));
    setRequestedSignOutTime(toLocalDateTime(record.signOutTime));
  }, [record]);

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit({
      reason,
      requestType,
      ...(requestType === 'time_correction' && requestedSignInTime
        ? { requestedSignInTime: new Date(requestedSignInTime).toISOString() }
        : {}),
      ...(requestType === 'time_correction' && requestedSignOutTime
        ? { requestedSignOutTime: new Date(requestedSignOutTime).toISOString() }
        : {}),
    });
  }
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Request Attendance Regularization" size="sm">
      <form onSubmit={handleSubmit}>
        <div className="px-6 py-5 space-y-4">
          {record && (
            <div className="text-sm bg-amber-50 dark:bg-amber-900/20 text-amber-700 rounded-lg px-3 py-2">
              Requesting for: <span className="font-medium">{fmtDate(record.date)}</span>
            </div>
          )}
          <label className="block space-y-1.5 text-sm font-medium">
            Request type
            <select value={requestType} onChange={(e) => setRequestType(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary">
              {record?.lateMinutes > 0 && <option value="late_waiver">Late waiver</option>}
              <option value="time_correction">Time correction</option>
            </select>
          </label>
          {requestType === 'time_correction' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="Requested Sign In" type="datetime-local" value={requestedSignInTime}
                onChange={(e) => setRequestedSignInTime(e.target.value)} />
              <Input label="Requested Sign Out" type="datetime-local" value={requestedSignOutTime}
                onChange={(e) => setRequestedSignOutTime(e.target.value)} />
            </div>
          )}
          <Textarea label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why regularization is needed..." />
        </div>
        <ModalFooter>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" size="sm" disabled={isLoading || !reason.trim()}>
            {isLoading ? 'Submitting...' : 'Submit Request'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AttendanceListPage() {
  const { user } = useSelector((s) => s.auth);
  const isAdminHR = ['hr', 'super_admin'].includes(user?.role);
  const isManagerUp = ['hr', 'super_admin', 'manager', 'team_lead'].includes(user?.role);

  const [ym, setYm] = useState(nowYM());
  const [filters, setFilters] = useState({ status: '', employeeId: '' });
  const [page, setPage] = useState(1);
  const [correctionRecord, setCorrectionRecord] = useState(null);
  const [regularizeRecord, setRegularizeRecord] = useState(null);
  const [reviewRecord, setReviewRecord] = useState(null);

  const monthParams = { year: ym.year, month: ym.month };
  const { data: summaryData, isLoading: summaryLoading } = useGetMonthlySummaryQuery(monthParams);
  const { data: listData, isLoading: listLoading, isFetching, refetch } = useListAttendanceQuery({
    ...monthParams, page, limit: 20, ...filters,
    ...(isAdminHR ? {} : { employeeId: user?.id }),
  });
  const { data: pendingData } = useGetPendingRegularizationsQuery(undefined, { skip: !isManagerUp });
  const [manualCorrection, { isLoading: correcting }] = useManualCorrectionMutation();
  const [requestReg, { isLoading: requesting }] = useRequestRegularizationMutation();
  const [reviewReg, { isLoading: reviewing }] = useReviewRegularizationMutation();

  const summary = summaryData?.data?.summary || {};
  const calRecords = summaryData?.data?.records || [];
  const listRecords = listData?.items || [];
  const total = listData?.total || 0;
  const totalPages = listData?.totalPages || 1;
  const pendingRegs = pendingData?.data || [];

  function prevMonth() {
    setYm(({ year, month }) => month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 });
    setPage(1);
  }
  function nextMonth() {
    setYm(({ year, month }) => month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 });
    setPage(1);
  }

  async function handleCorrection(payload) {
    try {
      await manualCorrection({ id: correctionRecord._id, ...payload }).unwrap();
      toast.success('Attendance corrected successfully');
      setCorrectionRecord(null);
    } catch (err) {
      toast.error(err?.data?.error?.message || 'Correction failed');
    }
  }
  async function handleRegularize(payload) {
    try {
      await requestReg({ id: regularizeRecord._id, ...payload }).unwrap();
      toast.success('Regularization request submitted');
      setRegularizeRecord(null);
    } catch (err) {
      toast.error(err?.data?.error?.message || 'Request failed');
    }
  }
  async function handleReview(action) {
    try {
      await reviewReg({ id: reviewRecord._id, action }).unwrap();
      toast.success(`Regularization ${action === 'approve' ? 'approved' : 'rejected'}`);
      setReviewRecord(null);
    } catch (err) {
      toast.error(err?.data?.error?.message || 'Review failed');
    }
  }

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track and manage daily attendance records</p>
        </div>
        <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </motion.div>

      {/* Sign In/Out widget (own attendance) */}
      <SignInWidget user={user} />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryLoading ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatCard title="Present" value={summary.present ?? 0} icon={CheckCircle2}
              trend={{ label: 'This month', positive: true }} />
            <StatCard title="Late" value={summary.late ?? 0} icon={AlertCircle} />
            <StatCard title="Absent" value={summary.absent ?? 0} icon={XCircle} />
            <StatCard title="On Leave" value={summary.on_leave ?? 0} icon={Calendar} />
          </>
        )}
      </div>

      {/* Month navigator + Calendar */}
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {/* Month nav */}
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">
              {MONTH_NAMES[ym.month - 1]} {ym.year}
            </h2>
            <div className="flex gap-1">
              <Button variant="secondary" size="sm" className="px-2" onClick={prevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="secondary" size="sm" className="px-2" onClick={nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Records Table */}
          <div className="glass-card overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              {isAdminHR && (
                <select className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
                  value={filters.status} onChange={(e) => { setFilters(p => ({ ...p, status: e.target.value })); setPage(1); }}>
                  <option value="">All Statuses</option>
                  {Object.keys(STATUS_STYLES).map(s => (
                    <option key={s} value={s}>{STATUS_STYLES[s].label}</option>
                  ))}
                </select>
              )}
              <span className="text-xs text-muted-foreground ml-auto">{total} records</span>
            </div>

            {listLoading ? (
              <div className="p-4 space-y-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex gap-4 items-center py-2">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            ) : listRecords.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-sm">
                No attendance records found for this period.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {listRecords.map((rec, i) => {
                  const st = STATUS_STYLES[rec.status] || STATUS_STYLES.present;
                  return (
                    <motion.div key={rec._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-4 px-4 py-3 hover:bg-accent/30 transition-colors group">
                      <Avatar name={rec.employeeId?.fullName || user?.fullName} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{rec.employeeId?.fullName || 'You'}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(rec.date)}</p>
                      </div>
                      <Badge variant={st.variant}>{st.label}</Badge>
                      <div className="hidden sm:block text-xs text-muted-foreground space-y-0.5 text-right">
                        <p>{fmtTime(rec.signInTime)} – {fmtTime(rec.signOutTime)}</p>
                        {rec.totalHours > 0 && <p>{rec.totalHours}h</p>}
                      </div>
                      {rec.lateMinutes > 0 && (
                        <span className="text-xs text-amber-500">{rec.lateMinutes}m late</span>
                      )}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isAdminHR && (
                          <button onClick={() => setCorrectionRecord(rec)} title="Correct"
                            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground">
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {!isAdminHR && rec.regularizationStatus === 'none' && (
                          <button onClick={() => setRegularizeRecord(rec)} title="Request regularization"
                            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-amber-500">
                            <AlertCircle className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {rec.regularizationStatus === 'pending' && (
                          <Badge variant="yellow">Reg. Pending</Badge>
                        )}
                        {rec.regularizationStatus === 'approved' && (
                          <Badge variant="green">Regularized</Badge>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
                <div className="flex gap-1">
                  <Button variant="secondary" size="sm" className="px-2" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="secondary" size="sm" className="px-2" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Calendar sidebar */}
        <div className="space-y-4">
          <MonthlyCalendar year={ym.year} month={ym.month} records={calRecords} />

          {/* Pending regularizations (HR/Admin) */}
          {isManagerUp && pendingRegs.length > 0 && (
            <div className="glass-card p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                Pending Regularizations ({pendingRegs.length})
              </h3>
              <div className="space-y-2">
                {pendingRegs.slice(0, 5).map((r) => (
                  <div key={r._id} className="flex items-center justify-between gap-2 p-2 rounded-lg border border-border text-sm">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{r.employeeId?.fullName}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(r.date)}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {(r.regularization?.requestType || 'time_correction').replace('_', ' ')}
                        {r.regularization?.assignedApprover?.fullName
                          ? ` · ${r.regularization.assignedApprover.fullName}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => { setReviewRecord(r); }} className="px-2 py-1 text-xs rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400">
                        Review
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CorrectionModal record={correctionRecord} isOpen={!!correctionRecord}
        onClose={() => setCorrectionRecord(null)} onSubmit={handleCorrection} isLoading={correcting} />

      <RegularizeModal record={regularizeRecord} isOpen={!!regularizeRecord}
        onClose={() => setRegularizeRecord(null)} onSubmit={handleRegularize} isLoading={requesting} />

      {/* Review Modal */}
      <Modal isOpen={!!reviewRecord} onClose={() => setReviewRecord(null)} title="Review Regularization" size="sm">
        {reviewRecord && (
          <div className="px-6 py-5 space-y-4">
            <div className="text-sm">
              <p className="font-medium">{reviewRecord.employeeId?.fullName}</p>
              <p className="text-muted-foreground">{fmtDate(reviewRecord.date)}</p>
              <p className="mt-1 text-xs capitalize text-muted-foreground">
                {(reviewRecord.regularization?.requestType || 'time_correction').replace('_', ' ')}
                {reviewRecord.regularization?.assignedApprover?.fullName
                  ? ` · Assigned to ${reviewRecord.regularization.assignedApprover.fullName}`
                  : ''}
              </p>
              <p className="mt-2 text-sm border border-border rounded-lg p-3 bg-muted/30">
                {reviewRecord.regularization?.reason || 'No reason provided'}
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="primary" size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => handleReview('approve')} disabled={reviewing}>
                {reviewing ? 'Processing...' : 'Approve'}
              </Button>
              <Button variant="danger" size="sm" className="flex-1"
                onClick={() => handleReview('reject')} disabled={reviewing}>
                Reject
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

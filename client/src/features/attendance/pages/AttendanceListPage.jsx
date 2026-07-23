/**
 * features/attendance/pages/AttendanceListPage.jsx
 * Full attendance management page:
 *  - Sign In / Sign Out widget for current user
 *  - Monthly calendar heatmap
 *  - Daily attendance table with filters
 *  - Regularization request
 *  - HR/Admin: manual correction, approve/reject regularizations
 */
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import {
  Clock, CheckCircle2, XCircle, AlertCircle, Calendar,
  ChevronLeft, ChevronRight, Edit, RefreshCw, Search, X,
  Download, CalendarRange, Timer, Gauge, BarChart3,
} from 'lucide-react';
import { BarChart, Bar, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  useGetTodayAttendanceQuery,
  useGetMonthlySummaryQuery,
  useGetAttendanceRangeSummaryQuery,
  useListAttendanceQuery,
  useSignInMutation,
  useSignOutMutation,
  useManualCorrectionMutation,
  useRequestRegularizationMutation,
  useReviewRegularizationMutation,
  useGetPendingRegularizationsQuery,
} from '../api/attendance.api';
import { useListEmployeesQuery } from '../../employees/api/employees.api';
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

function fmtTime(d, timeZone) {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', ...(timeZone && { timeZone }) });
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

function zonedDateTimeParts(value, timeZone) {
  if (!value) return { date: '', time: '' };
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone || undefined,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value)).reduce((result, part) => {
    if (part.type !== 'literal') result[part.type] = part.value;
    return result;
  }, {});
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

function zonedDateTimeToIso(date, time, timeZone) {
  if (!timeZone) return new Date(`${date}T${time}`).toISOString();
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  let guess = targetAsUtc;
  for (let pass = 0; pass < 2; pass += 1) {
    const actual = zonedDateTimeParts(new Date(guess), timeZone);
    const [actualYear, actualMonth, actualDay] = actual.date.split('-').map(Number);
    const [actualHour, actualMinute] = actual.time.split(':').map(Number);
    guess -= Date.UTC(actualYear, actualMonth - 1, actualDay, actualHour, actualMinute) - targetAsUtc;
  }
  return new Date(guess).toISOString();
}

function addIsoDateDays(date, amount) {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + amount, 12));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
}
function nowYM() {
  const n = new Date();
  return { year: n.getFullYear(), month: n.getMonth() + 1 };
}

function inputDate(date) {
  const value = new Date(date);
  const offset = value.getTimezoneOffset() * 60000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 10);
}

function presetRange(preset) {
  const to = new Date();
  const from = new Date(to);
  if (preset === 'month') from.setDate(1);
  if (preset === '3months') from.setMonth(from.getMonth() - 3);
  if (preset === '6months') from.setMonth(from.getMonth() - 6);
  if (preset === 'year') from.setFullYear(from.getFullYear() - 1);
  return { preset, dateFrom: inputDate(from), dateTo: inputDate(to) };
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

// ─── Sign-In/Out Widget ──────────────────────────────────────────────────────
function SignInWidget({ user, onSigningOutChange }) {
  const { data: todayData, isLoading } = useGetTodayAttendanceQuery();
  const [signIn, { isLoading: signingIn }] = useSignInMutation();
  const [signOut, { isLoading: signingOut }] = useSignOutMutation();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const updateClock = () => setNow(new Date());
    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    document.addEventListener('visibilitychange', updateClock);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', updateClock);
    };
  }, []);

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
    onSigningOutChange?.(true);
    try {
      await signOut({}).unwrap();
      toast.success('Signed out successfully!');
    } catch (err) {
      toast.error(err?.data?.error?.message || 'Sign out failed');
    } finally {
      onSigningOutChange?.(false);
    }
  }

  const timeZone = record?.shiftTimezone;
  const timeStr = now.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', second: '2-digit', ...(timeZone && { timeZone }) });
  const dateStr = now.toLocaleDateString('en-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', ...(timeZone && { timeZone }) });

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6 flex flex-col sm:flex-row items-center gap-6">
      <div className="flex-1 text-center sm:text-left">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Today</p>
        <p className="text-3xl font-bold tabular-nums">{timeStr}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{dateStr}</p>
        {timeZone && <p className="mt-0.5 text-xs text-muted-foreground">Company time · {timeZone}</p>}
        {record?.shiftName && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
            <Clock className="h-4 w-4" /> {record.shiftName}: {record.shiftStartTime} – {record.shiftEndTime}
            {record.shiftEndTime <= record.shiftStartTime ? ' (overnight)' : ''}
          </p>
        )}
        {record && (
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            {record.signInTime && (
              <span className="flex items-center gap-1.5 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                Sign In: {fmtTime(record.signInTime, record.shiftTimezone)}
                {record.lateMinutes > 0 && (
                  <span className="text-amber-500 text-xs">({record.lateMinutes}m late)</span>
                )}
              </span>
            )}
            {record.signOutTime && (
              <span className="flex items-center gap-1.5 text-blue-600">
                <XCircle className="h-4 w-4" />
                Sign Out: {fmtTime(record.signOutTime, record.shiftTimezone)}
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
  const [form, setForm] = useState({ signInDate: '', signInTime: '', signOutDate: '', signOutTime: '', notes: '' });

  useEffect(() => {
    if (!isOpen || !record) return;
    const signInParts = zonedDateTimeParts(record.signInTime || record.scheduledStart, record.shiftTimezone);
    const signOutParts = zonedDateTimeParts(record.signOutTime || record.scheduledEnd, record.shiftTimezone);
    const fixedShift = (record.shiftType || 'fixed') === 'fixed';
    const fixedWorkDate = record.shiftDate || signInParts.date || inputDate(record.date);
    const overnight = fixedShift && record.shiftStartTime && record.shiftEndTime
      && record.shiftEndTime <= record.shiftStartTime;
    setForm({
      signInDate: fixedShift ? fixedWorkDate : signInParts.date,
      signInTime: signInParts.time || '',
      signOutDate: fixedShift
        ? addIsoDateDays(fixedWorkDate, overnight ? 1 : 0)
        : (signOutParts.date || fixedWorkDate),
      signOutTime: record.signOutTime ? (signOutParts.time || '') : '',
      notes: '',
    });
  }, [isOpen, record]);

  function set(k, v) { setForm(p => ({ ...p, [k]: v })); }
  function handleSubmit(e) {
    e.preventDefault();
    const fixedShift = (record.shiftType || 'fixed') === 'fixed';
    const crossesMidnight = fixedShift && form.signInTime && form.signOutTime
      && form.signOutTime <= form.signInTime;
    const resolvedSignOutDate = crossesMidnight
      ? addIsoDateDays(form.signInDate, 1)
      : form.signOutDate;
    onSubmit({
      signInTime: form.signInTime ? zonedDateTimeToIso(form.signInDate, form.signInTime, record.shiftTimezone) : undefined,
      signOutTime: form.signOutTime ? zonedDateTimeToIso(resolvedSignOutDate, form.signOutTime, record.shiftTimezone) : undefined,
      notes: form.notes,
    });
  }

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
          <Input label="Sign In Time" type="time" value={form.signInTime}
            onChange={(e) => set('signInTime', e.target.value)} />
          <Input label="Sign Out Time" type="time" value={form.signOutTime}
            onChange={(e) => set('signOutTime', e.target.value)} />
          {form.signOutDate && form.signOutDate !== form.signInDate && (
            <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
              Overnight shift: sign-out date is automatically fixed to the next day.
            </p>
          )}
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
  const [times, setTimes] = useState({
    signInDate: '', signInTime: '', signOutDate: '', signOutTime: '',
  });

  useEffect(() => {
    if (!record) return;
    const signInParts = zonedDateTimeParts(record.signInTime || record.scheduledStart, record.shiftTimezone);
    const signOutParts = zonedDateTimeParts(record.signOutTime || record.scheduledEnd, record.shiftTimezone);
    const fixedShift = (record.shiftType || 'fixed') === 'fixed';
    const fixedWorkDate = record.shiftDate || signInParts.date || inputDate(record.date);
    const overnight = fixedShift && (
      (record.shiftStartTime && record.shiftEndTime && record.shiftEndTime <= record.shiftStartTime)
      || (signOutParts.date && signOutParts.date !== fixedWorkDate)
    );
    setReason('');
    setRequestType(record.status === 'late' || record.lateMinutes > 0 ? 'late_waiver' : 'time_correction');
    setTimes({
      signInDate: fixedShift ? fixedWorkDate : signInParts.date,
      signInTime: record.signInTime ? (signInParts.time || '') : '',
      signOutDate: fixedShift
        ? addIsoDateDays(fixedWorkDate, overnight ? 1 : 0)
        : (signOutParts.date || fixedWorkDate),
      signOutTime: record.signOutTime ? (signOutParts.time || '') : '',
    });
  }, [record]);

  function handleSubmit(e) {
    e.preventDefault();
    const fixedShift = (record.shiftType || 'fixed') === 'fixed';
    const crossesMidnight = fixedShift && times.signInTime && times.signOutTime
      && times.signOutTime <= times.signInTime;
    const resolvedSignOutDate = crossesMidnight
      ? addIsoDateDays(times.signInDate, 1)
      : times.signOutDate;
    onSubmit({
      reason,
      requestType,
      ...(requestType === 'time_correction' && times.signInTime
        ? { requestedSignInTime: zonedDateTimeToIso(times.signInDate, times.signInTime, record.shiftTimezone) }
        : {}),
      ...(requestType === 'time_correction' && times.signOutTime
        ? { requestedSignOutTime: zonedDateTimeToIso(resolvedSignOutDate, times.signOutTime, record.shiftTimezone) }
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
              {(record?.status === 'late' || record?.lateMinutes > 0) && <option value="late_waiver">Late waiver</option>}
              <option value="time_correction">Time correction</option>
            </select>
          </label>
          {requestType === 'time_correction' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="Requested Sign In Time" type="time" value={times.signInTime}
                onChange={(e) => setTimes((previous) => ({ ...previous, signInTime: e.target.value }))} />
              <Input label="Requested Sign Out Time" type="time" value={times.signOutTime}
                onChange={(e) => setTimes((previous) => ({ ...previous, signOutTime: e.target.value }))} />
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
  const canSelectEmployee = ['manager', 'hr', 'super_admin'].includes(user?.role);
  const canViewLeaveBalances = canSelectEmployee;

  const [ym, setYm] = useState(nowYM());
  const [reportRange, setReportRange] = useState(() => presetRange('month'));
  const [filters, setFilters] = useState({ status: '', employeeId: '' });
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const employeePickerRef = useRef(null);
  const [page, setPage] = useState(1);
  const [correctionRecord, setCorrectionRecord] = useState(null);
  const [regularizeRecord, setRegularizeRecord] = useState(null);
  const [reviewRecord, setReviewRecord] = useState(null);
  const [fullPageSigningOut, setFullPageSigningOut] = useState(false);

  const { data: employeesData, isLoading: employeesLoading } = useListEmployeesQuery(
    { page: 1, limit: 100, sort: '-createdAt' },
    { skip: !canSelectEmployee }
  );
  const employees = employeesData?.items || [];
  const selectedEmployee = employees.find((employee) => employee._id === filters.employeeId);
  const matchingEmployees = employees.filter((employee) => {
    const needle = employeeSearch.trim().toLowerCase();
    if (!needle) return true;
    return [employee.fullName, employee.employeeCode, employee.email]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(needle));
  });

  const selectedEmployeeId = canSelectEmployee ? (filters.employeeId || user?.id) : user?.id;
  const viewedEmployee = employees.find(employee => employee._id === selectedEmployeeId);
  const monthParams = {
    year: ym.year,
    month: ym.month,
    ...(selectedEmployeeId && { employeeId: selectedEmployeeId }),
  };
  const { data: summaryData } = useGetMonthlySummaryQuery(monthParams);
  const { data: rangeData, isLoading: rangeLoading, isFetching: rangeFetching } = useGetAttendanceRangeSummaryQuery({
    employeeId: selectedEmployeeId,
    dateFrom: reportRange.dateFrom,
    dateTo: reportRange.dateTo,
  }, { skip: !selectedEmployeeId });
  const { data: listData, isLoading: listLoading, isFetching, refetch } = useListAttendanceQuery({
    page, limit: 30, status: filters.status,
    dateFrom: reportRange.dateFrom,
    dateTo: reportRange.dateTo,
    ...(selectedEmployeeId && { employeeId: selectedEmployeeId }),
  });
  const { data: pendingData } = useGetPendingRegularizationsQuery(undefined, { skip: !isManagerUp });
  const [manualCorrection, { isLoading: correcting }] = useManualCorrectionMutation();
  const [requestReg, { isLoading: requesting }] = useRequestRegularizationMutation();
  const [reviewReg, { isLoading: reviewing }] = useReviewRegularizationMutation();

  const summary = rangeData?.data?.summary || {};
  const trend = rangeData?.data?.trend || [];
  const reportRecords = rangeData?.data?.records || [];
  const calRecords = summaryData?.data?.records || [];
  const listRecords = listData?.items || [];
  const total = listData?.total || 0;
  const totalPages = listData?.totalPages || 1;
  const pendingRegs = pendingData?.data || [];

  useEffect(() => {
    if (!employeePickerOpen) return undefined;
    const closeOutside = (event) => {
      if (!employeePickerRef.current?.contains(event.target)) setEmployeePickerOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setEmployeePickerOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [employeePickerOpen]);

  function prevMonth() {
    setYm(({ year, month }) => {
      const next = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
      setReportRange({
        preset: 'month',
        dateFrom: inputDate(new Date(next.year, next.month - 1, 1)),
        dateTo: inputDate(new Date(next.year, next.month, 0)),
      });
      return next;
    });
    setPage(1);
  }
  function nextMonth() {
    setYm(({ year, month }) => {
      const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
      setReportRange({
        preset: 'month',
        dateFrom: inputDate(new Date(next.year, next.month - 1, 1)),
        dateTo: inputDate(new Date(next.year, next.month, 0)),
      });
      return next;
    });
    setPage(1);
  }

  function applyPreset(preset) {
    setReportRange(presetRange(preset));
    setPage(1);
  }

  function exportCsv() {
    if (!reportRecords.length) {
      toast.error('No attendance records available to export');
      return;
    }
    const headers = ['Employee', 'Employee Code', 'Date', 'Status', 'Sign In', 'Sign Out', 'Worked Hours', 'Late Minutes', 'Early Leave Minutes', 'Overtime Minutes', 'Method', 'Notes'];
    const name = selectedEmployee?.fullName || user?.fullName || 'Employee';
    const code = selectedEmployee?.employeeCode || user?.employeeCode || '';
    const rows = reportRecords.map((record) => [
      name, code, inputDate(record.date), STATUS_STYLES[record.status]?.label || record.status,
      record.signInTime ? fmtTime(record.signInTime, record.shiftTimezone) : '',
      record.signOutTime ? fmtTime(record.signOutTime, record.shiftTimezone) : '',
      record.totalHours || 0, record.lateMinutes || 0, record.earlyLeaveMinutes || 0,
      record.overtimeMinutes || 0, record.method || '', record.notes || record.attendanceAdjustmentReason || '',
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${reportRange.dateFrom}-to-${reportRange.dateTo}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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
    <div className="relative space-y-6">
      {fullPageSigningOut && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/85 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-8 py-6 shadow-xl">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
            <p className="font-semibold">Signing out...</p>
            <p className="text-sm text-muted-foreground">Attendance calculate ho rahi hai</p>
          </div>
        </div>
      )}
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
      <SignInWidget user={user} onSigningOutChange={setFullPageSigningOut} />

      {canSelectEmployee && (
        <div className="relative z-30 rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Employee attendance</p>
              <p className="text-xs text-muted-foreground">Search by employee name, code or email</p>
            </div>
            {filters.employeeId && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setFilters((previous) => ({ ...previous, employeeId: '' }));
                  setEmployeeSearch('');
                  setPage(1);
                }}
              >
                <X className="h-3.5 w-3.5" /> My attendance
              </Button>
            )}
          </div>
          <div ref={employeePickerRef} className="relative max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-primary" />
            <input
              type="search"
              value={employeePickerOpen ? employeeSearch : (selectedEmployee?.fullName || employeeSearch)}
              onFocus={() => {
                setEmployeeSearch(selectedEmployee ? '' : employeeSearch);
                setEmployeePickerOpen(true);
              }}
              onChange={(event) => {
                setEmployeeSearch(event.target.value);
                setEmployeePickerOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.stopPropagation();
                  setEmployeePickerOpen(false);
                  event.currentTarget.blur();
                }
              }}
              placeholder={employeesLoading ? 'Loading employees...' : 'Search employee...'}
              disabled={employeesLoading}
              className="h-11 w-full rounded-xl border border-primary/40 bg-background pl-10 pr-4 text-sm text-foreground shadow-sm outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/25"
            />
            {employeePickerOpen && (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-xl border border-primary/30 bg-card p-1.5 text-card-foreground shadow-2xl ring-1 ring-black/10 dark:ring-white/10">
                {matchingEmployees.length ? matchingEmployees.map((employee) => (
                  <button
                    key={employee._id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setFilters((previous) => ({ ...previous, employeeId: employee._id }));
                      setEmployeeSearch(employee.fullName);
                      setEmployeePickerOpen(false);
                      setPage(1);
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-left text-foreground transition-colors hover:border-border hover:bg-accent ${filters.employeeId === employee._id ? 'border-primary/20 bg-primary/15' : ''}`}
                  >
                    <Avatar name={employee.fullName} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{employee.fullName}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[employee.employeeCode, employee.designation, employee.email].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </button>
                )) : (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">No employee found.</p>
                )}
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Showing: <span className="font-medium text-foreground">{selectedEmployee?.fullName || `${user?.fullName || 'My'} attendance`}</span>
          </p>
        </div>
      )}

      {canViewLeaveBalances && viewedEmployee && (
        <div className="grid gap-4 md:grid-cols-2">
          {[
            ['Casual Leave', 'casual', 'bg-sky-500/10 text-sky-600'],
            ['Sick Leave', 'sick', 'bg-rose-500/10 text-rose-600'],
          ].map(([label, type, accent]) => {
            const balance = viewedEmployee.leaveBalance?.[type] || {};
            const total = Number(balance.available || 0);
            const used = Number(balance.used || 0);
            const remaining = Math.max(0, total - used);
            return (
              <div key={type} className="glass-card overflow-hidden p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{viewedEmployee.fullName}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${accent}`}>{remaining} remaining</span>
                </div>
                <div className="mt-5 grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-muted/20 py-3 text-center">
                  <div><p className="text-lg font-bold">{total}</p><p className="text-[11px] text-muted-foreground">Total</p></div>
                  <div><p className="text-lg font-bold text-amber-600">{used}</p><p className="text-[11px] text-muted-foreground">Used</p></div>
                  <div><p className="text-lg font-bold text-emerald-600">{remaining}</p><p className="text-[11px] text-muted-foreground">Remaining</p></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reporting period */}
      <div className="glass-card p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <CalendarRange className="h-4 w-4 text-primary" /> Attendance report period
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Choose a quick period or enter any custom dates (maximum one year).</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                ['month', 'This month'], ['3months', 'Last 3 months'],
                ['6months', 'Last 6 months'], ['year', 'Last 12 months'],
              ].map(([value, label]) => (
                <button key={value} type="button" onClick={() => applyPreset(value)}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${reportRange.preset === value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:border-primary/50 hover:bg-accent'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Input label="From date" type="date" value={reportRange.dateFrom}
              max={reportRange.dateTo}
              onChange={(event) => { setReportRange((old) => ({ ...old, preset: 'custom', dateFrom: event.target.value })); setPage(1); }} />
            <Input label="To date" type="date" value={reportRange.dateTo}
              min={reportRange.dateFrom}
              onChange={(event) => { setReportRange((old) => ({ ...old, preset: 'custom', dateTo: event.target.value })); setPage(1); }} />
            <Button type="button" variant="secondary" className="gap-2 whitespace-nowrap" onClick={exportCsv}
              disabled={rangeLoading || !reportRecords.length}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
          <span><strong className="text-foreground">Period:</strong> {fmtDate(reportRange.dateFrom)} – {fmtDate(reportRange.dateTo)}</span>
          <span><strong className="text-foreground">Employee:</strong> {selectedEmployee?.fullName || user?.fullName}</span>
          {rangeFetching && <span className="text-primary">Updating report...</span>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        {rangeLoading ? (
          [...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatCard title="Present" value={summary.present ?? 0} icon={CheckCircle2}
              trend={{ label: `${summary.attendanceRate ?? 0}% attendance`, positive: true }} />
            <StatCard title="Late" value={summary.late ?? 0} icon={AlertCircle} />
            <StatCard title="Absent" value={summary.absent ?? 0} icon={XCircle} />
            <StatCard title="On Leave" value={summary.on_leave ?? 0} icon={Calendar} />
            <StatCard title="Worked Hours" value={`${summary.workedHours ?? 0}h`} icon={Timer} />
            <StatCard title="Overtime" value={`${summary.overtimeHours ?? 0}h`} icon={Gauge} />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="glass-card min-h-[310px] p-5">
          <h3 className="mb-1 flex items-center gap-2 font-semibold"><BarChart3 className="h-4 w-4 text-primary" /> Monthly attendance trend</h3>
          <p className="mb-5 text-xs text-muted-foreground">Present, late and absent days across the selected report period.</p>
          {trend.length ? (
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 10, borderColor: 'hsl(var(--border))', background: 'hsl(var(--card))' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="present" name="Present" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="late" name="Late" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="absent" name="Absent" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">No records in this period.</div>}
        </div>
        <div className="glass-card p-5">
          <h3 className="font-semibold">Period details</h3>
          <div className="mt-4 divide-y divide-border text-sm">
            {[
              ['Attendance rate', `${summary.attendanceRate ?? 0}%`],
              ['Average daily hours', `${summary.averageHours ?? 0}h`],
              ['Half days', summary.half_day ?? 0],
              ['Holidays', summary.holiday ?? 0],
              ['Late time', `${summary.lateMinutes ?? 0} min`],
              ['Early departures', `${summary.earlyLeaveMinutes ?? 0} min`],
              ['Total records', summary.totalRecords ?? 0],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-muted-foreground">{label}</span><strong>{value}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Month navigator + Calendar */}
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {/* Month nav */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Attendance records</h2>
              <p className="text-xs text-muted-foreground">{fmtDate(reportRange.dateFrom)} – {fmtDate(reportRange.dateTo)}</p>
            </div>
            {reportRange.preset === 'month' && <div className="flex items-center gap-2">
              <span className="hidden text-xs text-muted-foreground sm:inline">{MONTH_NAMES[ym.month - 1]} {ym.year}</span>
              <Button variant="secondary" size="sm" className="px-2" onClick={prevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="secondary" size="sm" className="px-2" onClick={nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>}
          </div>

          {/* Records Table */}
          <div className="glass-card overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <select className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
                value={filters.status} onChange={(e) => { setFilters(p => ({ ...p, status: e.target.value })); setPage(1); }}>
                <option value="">All Statuses</option>
                {Object.keys(STATUS_STYLES).map(s => (
                  <option key={s} value={s}>{STATUS_STYLES[s].label}</option>
                ))}
              </select>
              <span className="text-xs text-muted-foreground ml-auto">{total} records</span>
            </div>
            <div className="hidden grid-cols-[1fr_auto_auto_auto] gap-4 border-b border-border bg-muted/25 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
              <span>Employee / Date</span><span>Status</span><span>Timing / Hours</span><span>Actions</span>
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
                        <p>{fmtTime(rec.signInTime, rec.shiftTimezone)} – {fmtTime(rec.signOutTime, rec.shiftTimezone)}</p>
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

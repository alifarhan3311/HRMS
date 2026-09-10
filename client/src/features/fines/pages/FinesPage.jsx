/**
 * features/fines/pages/FinesPage.jsx
 * Dual-view page:
 *   - HR / Super Admin: Issue fines form + Company-wide fine history table + Void modal
 *   - Regular Employees: "My Fines" self-service portal view showing their penalty records, amounts, dates, and reasons
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import {
  useIssueFineMutation,
  useListFinesQuery,
  useGetMyFinesQuery,
  useVoidFineMutation,
} from '../api/fines.api';
import { useListEmployeesQuery } from '../../employees/api/employees.api';
import {
  AlertTriangle,
  BadgeDollarSign,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Ban,
  CheckCircle2,
  Calendar,
  User,
  FileText,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatPKR(n) {
  return `PKR ${Number(n || 0).toLocaleString('en-PK')}`;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Employee Search Dropdown (for HR) ─────────────────────────────────────────
function EmployeeDropdown({ value, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const { data } = useListEmployeesQuery(
    { search: query, limit: 20, status: 'active' },
    { skip: !open && !query }
  );
  const employees = data?.data?.items || data?.items || [];
  const selected = value ? employees.find((e) => e._id === value) : null;

  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const choose = useCallback(
    (emp) => {
      onChange(emp._id, emp);
      setQuery('');
      setOpen(false);
    },
    [onChange]
  );

  const clear = useCallback(() => {
    onChange('', null);
    setQuery('');
  }, [onChange]);

  return (
    <div ref={wrapRef} className="relative">
      <div
        className="flex items-center gap-2 w-full rounded-xl border border-border bg-card px-3 py-2 cursor-pointer focus-within:ring-2 focus-within:ring-primary/40 transition"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        {selected && !open ? (
          <span className="flex-1 text-sm text-foreground truncate font-medium">
            {selected.fullName} — <span className="text-muted-foreground font-normal">{selected.employeeCode}</span>
          </span>
        ) : (
          <input
            autoFocus={open}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Type employee name or code…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
          />
        )}
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              clear();
            }}
            className="text-muted-foreground hover:text-destructive transition-colors p-1"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1.5 w-full max-h-60 overflow-y-auto rounded-xl border border-border bg-card shadow-2xl divide-y divide-border/40"
          >
            {employees.length === 0 && (
              <li className="px-4 py-3 text-sm text-muted-foreground">No employees found.</li>
            )}
            {employees.map((emp) => (
              <li
                key={emp._id}
                onClick={() => choose(emp)}
                className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/60 transition-colors"
              >
                <div className="h-8 w-8 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs uppercase">
                  {emp.fullName?.[0] || '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{emp.fullName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {emp.employeeCode} · {emp.department || 'General'}
                  </p>
                </div>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── HR Issue Fine Form ───────────────────────────────────────────────────────
function IssueFineForm({ onSuccess }) {
  const [form, setForm] = useState({ employeeId: '', amount: '', reason: '' });
  const [errors, setErrors] = useState({});
  const [issueFine, { isLoading }] = useIssueFineMutation();

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.employeeId) e.employeeId = 'Please select an employee.';
    if (!form.amount || Number(form.amount) < 1) e.amount = 'Amount must be at least 1 PKR.';
    if (!form.reason || form.reason.trim().length < 3)
      e.reason = 'Reason must be at least 3 characters.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      await issueFine({ ...form, amount: Number(form.amount) }).unwrap();
      setForm({ employeeId: '', amount: '', reason: '' });
      setErrors({});
      onSuccess?.('Fine issued successfully! Employee received in-app notification and email.');
    } catch (err) {
      setErrors({ submit: err?.data?.error?.message || 'Failed to issue fine.' });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-border bg-card p-6 shadow-sm"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
          <AlertTriangle className="h-5 w-5 text-destructive" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Issue a Fine</h2>
          <p className="text-xs text-muted-foreground">
            Notification & email will be sent to the employee automatically.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Field 1: Employee Selection */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Fine kis ko kiya ja raha hai (Employee) <span className="text-destructive">*</span>
          </label>
          <EmployeeDropdown
            value={form.employeeId}
            onChange={(id) => set('employeeId', id)}
          />
          {errors.employeeId && (
            <p className="mt-1 text-xs text-destructive">{errors.employeeId}</p>
          )}
        </div>

        {/* Field 2: Amount */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Kitnay ka fine kiya ja raha hai (Amount in PKR) <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-semibold">
              PKR
            </span>
            <input
              type="number"
              min="1"
              step="1"
              value={form.amount}
              onChange={(e) => set('amount', e.target.value)}
              placeholder="e.g. 1000"
              className="w-full rounded-xl border border-border bg-background pl-14 pr-4 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40 transition"
            />
          </div>
          {errors.amount && <p className="mt-1 text-xs text-destructive">{errors.amount}</p>}
        </div>

        {/* Field 3: Reason */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Fine ki waja (Reason) <span className="text-destructive">*</span>
          </label>
          <textarea
            rows={4}
            value={form.reason}
            onChange={(e) => set('reason', e.target.value)}
            placeholder="Explain why this fine is being issued…"
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40 resize-none transition"
          />
          <p className="mt-0.5 text-xs text-muted-foreground text-right">
            {form.reason.length} / 1000
          </p>
          {errors.reason && <p className="mt-1 text-xs text-destructive">{errors.reason}</p>}
        </div>

        {errors.submit && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {errors.submit}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-xl bg-destructive px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-destructive/90 active:scale-[0.98] transition disabled:opacity-60 cursor-pointer"
        >
          {isLoading ? 'Issuing Fine…' : 'Issue Fine & Notify Employee'}
        </button>
      </form>
    </motion.div>
  );
}

// ─── Company-Wide Fine History Table (HR View) ────────────────────────────────
function HRFineHistory() {
  const [page, setPage] = useState(1);
  const [filterEmp, setFilterEmp] = useState('');
  const [voidTarget, setVoidTarget] = useState(null);
  const [voidReason, setVoidReason] = useState('');

  const { data, isFetching } = useListFinesQuery({
    page,
    limit: 15,
    ...(filterEmp && { employeeId: filterEmp }),
  });
  const [voidFine, { isLoading: voiding }] = useVoidFineMutation();

  const fines = data?.items || [];
  const totalPages = data?.totalPages || 1;

  const handleVoid = async () => {
    if (!voidTarget) return;
    await voidFine({ id: voidTarget._id, voidReason }).unwrap().catch(() => {});
    setVoidTarget(null);
    setVoidReason('');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10">
            <BadgeDollarSign className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Company Fine Records</h2>
            <p className="text-xs text-muted-foreground">{data?.total || 0} total active records</p>
          </div>
        </div>

        {/* Filter by employee */}
        <div className="w-full sm:w-64">
          <EmployeeDropdown value={filterEmp} onChange={(id) => { setFilterEmp(id); setPage(1); }} />
        </div>
      </div>

      {isFetching ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Loading fine history…</div>
      ) : fines.length === 0 ? (
        <div className="p-12 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500/60 mb-3" />
          <p className="text-sm font-medium text-foreground">No fines issued yet</p>
          <p className="text-xs text-muted-foreground mt-1">Use the form to record any disciplinary fine.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Employee</th>
                <th className="px-5 py-3.5">Amount</th>
                <th className="px-5 py-3.5">Reason</th>
                <th className="px-5 py-3.5">Issued By</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {fines.map((fine) => (
                <tr key={fine._id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs uppercase">
                        {fine.employeeId?.fullName?.[0] || '?'}
                      </div>
                      <div>
                        <p className="font-medium text-foreground text-sm">{fine.employeeId?.fullName || '—'}</p>
                        <p className="text-xs text-muted-foreground">{fine.employeeId?.employeeCode || '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-destructive">
                    {formatPKR(fine.amount)}
                  </td>
                  <td className="px-5 py-3.5 text-foreground max-w-xs truncate" title={fine.reason}>
                    {fine.reason}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-muted-foreground">
                    {fine.issuedBy?.fullName || 'HR'}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(fine.createdAt)}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => setVoidTarget(fine)}
                      title="Void this fine"
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition"
                    >
                      <Ban className="h-3.5 w-3.5" />
                      Void
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-border">
          <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Void Modal */}
      <AnimatePresence>
        {voidTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
                  <Ban className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">Void Fine</h3>
                  <p className="text-xs text-muted-foreground">Cancel this fine of {formatPKR(voidTarget.amount)}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Employee: <strong className="text-foreground">{voidTarget.employeeId?.fullName}</strong>
                <br />
                Reason: {voidTarget.reason}
              </p>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Reason for voiding (optional)
                </label>
                <input
                  type="text"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="e.g. Fine was issued in error"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setVoidTarget(null)}
                  className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleVoid}
                  disabled={voiding}
                  className="rounded-xl bg-destructive px-4 py-2 text-sm font-medium text-white hover:bg-destructive/90 disabled:opacity-60"
                >
                  {voiding ? 'Voiding…' : 'Confirm Void'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Employee Portal Self-Service View ("My Fines") ───────────────────────────
function EmployeeMyFines() {
  const [page, setPage] = useState(1);
  const { data, isFetching } = useGetMyFinesQuery({ page, limit: 15 });

  const fines = data?.items || [];
  const totalAmount = data?.totalAmount || 0;
  const totalCount = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-6">
      {/* Header Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Penalties Amount */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Fines Amount
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
              <BadgeDollarSign className="h-4 w-4 text-destructive" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-destructive">
            {formatPKR(totalAmount)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Active penalties on your profile</p>
        </motion.div>

        {/* Total Incidents */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-border bg-card p-5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Incidents
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-foreground">
            {totalCount} {totalCount === 1 ? 'Incident' : 'Incidents'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Recorded disciplinary fines</p>
        </motion.div>

        {/* Payroll Note */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-border bg-card p-5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Payroll Deduction
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Info className="h-4 w-4 text-primary" />
            </div>
          </div>
          <p className="mt-3 text-sm font-semibold text-foreground">
            Salary Adjustment
          </p>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Fines are accounted during upcoming payroll cycles. Contact HR if you have queries.
          </p>
        </motion.div>
      </div>

      {/* Fines Details List / Card Table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden"
      >
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">My Fine History</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Detailed breakdown of all fines issued to you by HR
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">
            {totalCount} Active
          </span>
        </div>

        {isFetching ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading your fines…</div>
        ) : fines.length === 0 ? (
          <div className="p-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 mb-4">
              <CheckCircle2 className="h-7 w-7 text-emerald-500" />
            </div>
            <h4 className="text-base font-semibold text-foreground">No Fines on Record!</h4>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              Your record is completely clear. You have not been issued any disciplinary fines.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {fines.map((fine) => (
              <div key={fine._id} className="p-5 hover:bg-muted/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-destructive">
                      {formatPKR(fine.amount)}
                    </span>
                    <span className="rounded-full bg-destructive/10 text-destructive text-[11px] font-semibold px-2.5 py-0.5 uppercase tracking-wide">
                      Active Fine
                    </span>
                  </div>
                  <p className="text-sm text-foreground font-medium flex items-start gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <span>{fine.reason}</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      Issued: {formatDate(fine.createdAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      Issued By: {fine.issuedBy?.fullName || 'HR Department'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FinesPage() {
  const user = useSelector((state) => state.auth.user);
  const isHR = user?.role === 'hr' || user?.role === 'super_admin';
  const [successMsg, setSuccessMsg] = useState('');

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {isHR ? 'Fine Management & Penalties' : 'My Fines & Deductions'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isHR
              ? 'Issue disciplinary fines, notify employees via in-app & email, and monitor company fine logs.'
              : 'Review disciplinary fines and penalty records registered on your employee account.'}
          </p>
        </div>
      </div>

      {/* Success Toast / Alert */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg('')} className="p-1 hover:opacity-70">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic View based on Role */}
      {isHR ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <IssueFineForm onSuccess={(msg) => setSuccessMsg(msg)} />
          </div>
          <div className="lg:col-span-2">
            <HRFineHistory />
          </div>
        </div>
      ) : (
        <EmployeeMyFines />
      )}
    </div>
  );
}

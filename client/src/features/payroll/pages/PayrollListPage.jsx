/**
 * features/payroll/pages/PayrollListPage.jsx
 * Full payroll management:
 *  - Employee: view own payslips + salary breakup
 *  - Admin: generate, approve, mark paid, lock
 *  - Payslip detail modal with full breakdown
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import {
  Wallet, Plus, CheckCircle2, Lock, CreditCard,
  RefreshCw, ChevronLeft, ChevronRight, Eye,
  TrendingUp, TrendingDown, Banknote, FileText,
} from 'lucide-react';
import {
  useListPayrollQuery, useGeneratePayrollMutation,
  useSubmitPayrollMutation, useApprovePayrollMutation,
  useMarkPayrollPaidMutation, useLockPayrollMutation,
} from '../api/payroll.api';
import { toast } from '../../../utils/toast';
import StatCard from '../../../components/ui/StatCard';
import Button from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Modal, ModalFooter } from '../../../components/ui/Modal';
import { Input, Select } from '../../../components/ui/Input';
import { Avatar } from '../../../components/ui/Avatar';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useFormDraft } from '../../../hooks/useFormDraft';

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_STYLES = {
  draft:            { label: 'Draft',            variant: 'gray'   },
  pending_approval: { label: 'Pending Approval', variant: 'yellow' },
  approved:         { label: 'Approved',         variant: 'blue'   },
  paid:             { label: 'Paid',             variant: 'green'  },
  locked:           { label: 'Locked',           variant: 'purple' },
};
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtPKR(v) {
  const n = Number(v);
  if (isNaN(n)) return v || '—';
  return `PKR ${n.toLocaleString()}`;
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PK', { day:'numeric', month:'short', year:'numeric' });
}

// ─── Payslip Detail Modal ─────────────────────────────────────────────────────
function PayslipDetailModal({ payslip, isOpen, onClose, onAction, canManage, isActioning }) {
  if (!payslip) return null;
  const emp = payslip.employeeId;
  const st = STATUS_STYLES[payslip.status] || STATUS_STYLES.draft;

  const rows = [
    { label: 'Basic Salary',   amount: Number(payslip.basicSalary),  type: 'base'  },
    ...(payslip.allowanceItems||[]).map(a => ({ label: a.label, amount: a.amount, type: 'add' })),
    ...(payslip.bonus     ? [{ label: 'Bonus',       amount: payslip.bonus,      type: 'add' }] : []),
    ...(payslip.incentives? [{ label: 'Incentives',  amount: payslip.incentives, type: 'add' }] : []),
    ...(payslip.overtime  ? [{ label: 'Overtime',    amount: payslip.overtime,   type: 'add' }] : []),
    ...(payslip.deductionItems||[]).map(d => ({ label: d.label, amount: d.amount, type: 'deduct' })),
    ...(payslip.taxDeduction ? [{ label: 'Income Tax', amount: payslip.taxDeduction, type: 'deduct' }] : []),
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Payslip Details" size="lg">
      <div className="px-6 py-5 space-y-5">
        {/* Employee card */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-primary/5 border border-primary/10">
          <Avatar name={emp?.fullName} size="lg" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base">{emp?.fullName}</p>
            <p className="text-sm text-muted-foreground">{emp?.designation} · {emp?.department}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{emp?.employeeCode}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-muted-foreground">Period</p>
            <p className="font-semibold">{MONTHS[payslip.month - 1]} {payslip.year}</p>
            <Badge variant={st.variant} className="mt-1">{st.label}</Badge>
          </div>
        </div>

        {/* Attendance summary */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Working Days', val: payslip.workingDays },
            { label: 'Present', val: payslip.presentDays, cls: 'text-emerald-600' },
            { label: 'Absent',  val: payslip.absentDays,  cls: 'text-red-500' },
            { label: 'Late',    val: payslip.lateDays,    cls: 'text-amber-500' },
          ].map(({ label, val, cls }) => (
            <div key={label} className="glass-card p-3 text-center">
              <p className={`text-xl font-bold ${cls || ''}`}>{val ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Salary breakdown table */}
        <div className="glass-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-muted/30">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Salary Breakdown</p>
          </div>
          <div className="divide-y divide-border">
            {rows.map((row, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2">
                  {row.type === 'add'    && <TrendingUp   className="h-3.5 w-3.5 text-emerald-500" />}
                  {row.type === 'deduct' && <TrendingDown  className="h-3.5 w-3.5 text-red-500" />}
                  {row.type === 'base'   && <Banknote      className="h-3.5 w-3.5 text-primary" />}
                  <span className="text-sm">{row.label}</span>
                </div>
                <span className={`text-sm font-medium ${
                  row.type === 'add' ? 'text-emerald-600' :
                  row.type === 'deduct' ? 'text-red-500' : ''}`}>
                  {row.type === 'deduct' ? '−' : row.type === 'add' ? '+' : ''} {fmtPKR(row.amount)}
                </span>
              </div>
            ))}
          </div>
          {/* Net total */}
          <div className="flex items-center justify-between px-4 py-3 bg-primary/5 border-t-2 border-primary/20">
            <span className="font-bold">Net Salary</span>
            <span className="text-xl font-bold text-primary">{fmtPKR(payslip.netSalary)}</span>
          </div>
        </div>

        {payslip.notes && (
          <div className="text-sm text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 italic">
            {payslip.notes}
          </div>
        )}

        {/* Action buttons */}
        {canManage && (
          <div className="flex gap-2 flex-wrap">
            {payslip.status === 'draft' && (
              <Button variant="primary" size="sm" className="gap-1.5"
                onClick={() => onAction('submit', payslip._id)} disabled={isActioning}>
                <FileText className="h-4 w-4" /> Submit for Approval
              </Button>
            )}
            {payslip.status === 'pending_approval' && (
              <Button variant="primary" size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => onAction('approve', payslip._id)} disabled={isActioning}>
                <CheckCircle2 className="h-4 w-4" /> Approve
              </Button>
            )}
            {payslip.status === 'approved' && (
              <Button variant="primary" size="sm" className="gap-1.5"
                onClick={() => onAction('paid', payslip._id)} disabled={isActioning}>
                <CreditCard className="h-4 w-4" /> Mark as Paid
              </Button>
            )}
            {payslip.status === 'paid' && (
              <Button variant="secondary" size="sm" className="gap-1.5"
                onClick={() => onAction('lock', payslip._id)} disabled={isActioning}>
                <Lock className="h-4 w-4" /> Lock Payslip
              </Button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Generate Payslip Form ────────────────────────────────────────────────────
function GenerateForm({ onSubmit, onClose, isLoading, draftKey }) {
  const now = new Date();
  const [form, setForm, clearDraft] = useFormDraft(draftKey, {
    employeeId: '',
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    bonus: '', incentives: '', overtime: '',
    loanDeduction: '', advanceSalary: '', notes: '',
    allowanceItems: [{ label: 'House Rent', amount: '' }, { label: 'Transport', amount: '' }],
  });
  function set(k, v) { setForm(p => ({ ...p, [k]: v })); }
  function setAllowance(i, k, v) {
    setForm(p => {
      const items = [...p.allowanceItems];
      items[i] = { ...items[i], [k]: v };
      return { ...p, allowanceItems: items };
    });
  }
  function addAllowance() { setForm(p => ({ ...p, allowanceItems: [...p.allowanceItems, { label: '', amount: '' }] })); }
  function removeAllowance(i) { setForm(p => ({ ...p, allowanceItems: p.allowanceItems.filter((_, idx) => idx !== i) })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.employeeId) { toast.error('Employee ID is required'); return; }
    const saved = await onSubmit({
      ...form,
      month: Number(form.month),
      year: Number(form.year),
      bonus: Number(form.bonus) || 0,
      incentives: Number(form.incentives) || 0,
      overtime: Number(form.overtime) || 0,
      loanDeduction: Number(form.loanDeduction) || 0,
      advanceSalary: Number(form.advanceSalary) || 0,
      allowanceItems: form.allowanceItems
        .filter(a => a.label && a.amount)
        .map(a => ({ label: a.label, amount: Number(a.amount) })),
    });
    if (saved !== false) clearDraft();
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
        <Input label="Employee ID" required placeholder="MongoDB ObjectId of employee"
          value={form.employeeId} onChange={(e) => set('employeeId', e.target.value)} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Month" value={form.month} onChange={(e) => set('month', e.target.value)}>
            {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </Select>
          <Input label="Year" type="number" value={form.year} onChange={(e) => set('year', e.target.value)} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Allowances</label>
            <button type="button" onClick={addAllowance}
              className="text-xs text-primary hover:underline">+ Add</button>
          </div>
          {form.allowanceItems.map((a, i) => (
            <div key={i} className="flex gap-2">
              <Input placeholder="Label (e.g. House Rent)" value={a.label}
                onChange={(e) => setAllowance(i, 'label', e.target.value)} />
              <Input placeholder="Amount" type="number" value={a.amount}
                onChange={(e) => setAllowance(i, 'amount', e.target.value)} className="w-32" />
              <button type="button" onClick={() => removeAllowance(i)}
                className="text-muted-foreground hover:text-destructive text-xs px-1">✕</button>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Bonus (PKR)" type="number" placeholder="0" value={form.bonus} onChange={(e) => set('bonus', e.target.value)} />
          <Input label="Incentives (PKR)" type="number" placeholder="0" value={form.incentives} onChange={(e) => set('incentives', e.target.value)} />
          <Input label="Overtime (PKR)" type="number" placeholder="0" value={form.overtime} onChange={(e) => set('overtime', e.target.value)} />
          <Input label="Loan Deduction (PKR)" type="number" placeholder="0" value={form.loanDeduction} onChange={(e) => set('loanDeduction', e.target.value)} />
          <Input label="Advance Salary (PKR)" type="number" placeholder="0" value={form.advanceSalary} onChange={(e) => set('advanceSalary', e.target.value)} />
        </div>
        <Input label="Notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Optional notes..." />
      </div>
      <ModalFooter>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" size="sm" disabled={isLoading} className="gap-1.5">
          <Wallet className="h-4 w-4" /> {isLoading ? 'Generating...' : 'Generate Payslip'}
        </Button>
      </ModalFooter>
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PayrollListPage() {
  const { user } = useSelector((s) => s.auth);
  const canManage = ['admin', 'super_admin'].includes(user?.role);
  const now = new Date();

  const [generateOpen, setGenerateOpen] = useState(false);
  const [detailPayslip, setDetailPayslip] = useState(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ month: '', year: String(now.getFullYear()), status: '' });

  const { data, isLoading, isFetching, refetch } = useListPayrollQuery({ page, limit: 15, ...filters });
  const [generatePayroll, { isLoading: generating }] = useGeneratePayrollMutation();
  const [submitPayroll,   { isLoading: submitting }]  = useSubmitPayrollMutation();
  const [approvePayroll,  { isLoading: approving }]   = useApprovePayrollMutation();
  const [markPaid,        { isLoading: paying }]      = useMarkPayrollPaidMutation();
  const [lockPayroll,     { isLoading: locking }]     = useLockPayrollMutation();

  const isActioning = submitting || approving || paying || locking;

  const payslips   = data?.items || [];
  const total      = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  // Stats
  const stats = {
    total,
    draft:    payslips.filter(p => p.status === 'draft').length,
    pending:  payslips.filter(p => p.status === 'pending_approval').length,
    approved: payslips.filter(p => p.status === 'approved').length,
    paid:     payslips.filter(p => p.status === 'paid').length,
  };

  async function handleGenerate(payload) {
    try { await generatePayroll(payload).unwrap(); toast.success('Payslip generated'); setGenerateOpen(false); return true; }
    catch (err) { toast.error(err?.data?.error?.message || 'Failed to generate payslip'); return false; }
  }

  async function handleAction(action, id) {
    const mutations = { submit: submitPayroll, approve: approvePayroll, paid: markPaid, lock: lockPayroll };
    const labels    = { submit: 'Submitted', approve: 'Approved', paid: 'Marked as Paid', lock: 'Locked' };
    try {
      await mutations[action](id).unwrap();
      toast.success(`Payslip ${labels[action]}`);
      setDetailPayslip(null);
    } catch (err) { toast.error(err?.data?.error?.message || `Failed to ${action}`); }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payroll</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage salary, payslips and disbursements</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" className="gap-1.5"
            onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
          {canManage && (
            <Button variant="primary" size="sm" className="gap-1.5" onClick={() => setGenerateOpen(true)}>
              <Plus className="h-4 w-4" /> Generate Payslip
            </Button>
          )}
        </div>
      </motion.div>

      {/* Stats */}
      {canManage && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Payslips" value={total} icon={Wallet} />
          <StatCard title="Pending Approval" value={stats.pending} icon={FileText}
            trend={{ label: 'Needs review', positive: false }} />
          <StatCard title="Approved" value={stats.approved} icon={CheckCircle2}
            trend={{ label: 'Ready to disburse', positive: true }} />
          <StatCard title="Paid" value={stats.paid} icon={CreditCard}
            trend={{ label: 'Disbursed', positive: true }} />
        </div>
      )}

      {/* Filters + Table */}
      <div className="glass-card overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center flex-wrap gap-3 px-5 py-3 border-b border-border">
          <Select value={filters.month} onChange={(e) => { setFilters(p => ({ ...p, month: e.target.value })); setPage(1); }}
            className="w-32">
            <option value="">All Months</option>
            {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </Select>
          <Input type="number" placeholder="Year" value={filters.year}
            onChange={(e) => { setFilters(p => ({ ...p, year: e.target.value })); setPage(1); }}
            className="w-24" />
          <select className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            value={filters.status} onChange={(e) => { setFilters(p => ({ ...p, status: e.target.value })); setPage(1); }}>
            <option value="">All Status</option>
            {Object.entries(STATUS_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <span className="text-xs text-muted-foreground ml-auto">{total} payslips</span>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex gap-4 items-center py-2">
                <Skeleton className="h-9 w-9 rounded-full" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
            ))}
          </div>
        ) : payslips.length === 0 ? (
          <div className="py-16 text-center">
            <Wallet className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">No payslips found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {canManage ? 'Generate payslips using the button above.' : 'No payslips available for your account yet.'}
            </p>
          </div>
        ) : (
          <>
            {/* Header row */}
            <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_80px] gap-4 px-5 py-2.5 border-b border-border bg-muted/30">
              {['Employee','Period','Net Salary','Status','Generated',''].map(h => (
                <span key={h} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</span>
              ))}
            </div>

            <div className="divide-y divide-border">
              {payslips.map((p, i) => {
                const st = STATUS_STYLES[p.status] || STATUS_STYLES.draft;
                return (
                  <motion.div key={p._id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.025 }}
                    className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_80px] gap-4 px-5 py-3.5 hover:bg-accent/30 transition-colors cursor-pointer group"
                    onClick={() => setDetailPayslip(p)}>
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={p.employeeId?.fullName} size="sm" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.employeeId?.fullName}</p>
                        <p className="text-xs text-muted-foreground truncate">{p.employeeId?.department}</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <span className="text-sm">{MONTHS[p.month - 1]} {p.year}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-sm font-semibold text-primary">{fmtPKR(p.netSalary)}</span>
                    </div>
                    <div className="flex items-center">
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </div>
                    <div className="flex items-center">
                      <span className="text-xs text-muted-foreground">{fmtDate(p.createdAt)}</span>
                    </div>
                    <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"
                        onClick={(e) => { e.stopPropagation(); setDetailPayslip(p); }}>
                        <Eye className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
            <div className="flex gap-1">
              <Button variant="secondary" size="sm" className="px-2"
                onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="secondary" size="sm" className="px-2"
                onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Generate Modal */}
      <Modal isOpen={generateOpen} onClose={() => setGenerateOpen(false)} title="Generate Payslip" size="lg">
        <GenerateForm onSubmit={handleGenerate} onClose={() => setGenerateOpen(false)} isLoading={generating}
          draftKey={`hrms:draft:payroll:create:${user?.id || 'user'}`} />
      </Modal>

      {/* Detail Modal */}
      <PayslipDetailModal
        payslip={detailPayslip}
        isOpen={!!detailPayslip}
        onClose={() => setDetailPayslip(null)}
        onAction={handleAction}
        canManage={canManage}
        isActioning={isActioning}
      />
    </div>
  );
}

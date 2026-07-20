/**
 * features/expenses/pages/ExpensesListPage.jsx
 * Full expense management with submit form, approval workflow, filters, charts.
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import {
  Receipt, Plus, RefreshCw, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, CreditCard, Eye,
  BarChart3, TrendingDown, Settings2, Pencil, Trash2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  useListExpensesQuery, useSubmitExpenseMutation,
  useApproveExpenseMutation, useRejectExpenseMutation, useMarkExpensePaidMutation,
  useListExpenseCategoriesQuery, useCreateExpenseCategoryMutation,
  useUpdateExpenseCategoryMutation, useDeleteExpenseCategoryMutation,
} from '../api/expenses.api';
import { toast } from '../../../utils/toast';
import StatCard from '../../../components/ui/StatCard';
import Button from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Modal, ModalFooter } from '../../../components/ui/Modal';
import { Input, Select, Textarea } from '../../../components/ui/Input';
import { Avatar } from '../../../components/ui/Avatar';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useFormDraft } from '../../../hooks/useFormDraft';

// ─── Constants ────────────────────────────────────────────────────────────────
const PAYMENT_METHODS = ['Cash','Bank Transfer','Credit Card','Cheque','Online'];
const STATUS_STYLES = {
  pending:    { label: 'Pending',    variant: 'yellow' },
  processing: { label: 'Processing', variant: 'blue'   },
  approved:   { label: 'Approved',   variant: 'green'  },
  rejected:   { label: 'Rejected',   variant: 'red'    },
  paid:       { label: 'Paid',       variant: 'purple' },
  cancelled:  { label: 'Cancelled',  variant: 'gray'   },
};

function fmtPKR(v) { return `PKR ${Number(v||0).toLocaleString()}`; }
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PK', { day:'numeric', month:'short', year:'numeric' });
}

// ─── Submit Expense Form ──────────────────────────────────────────────────────
function SubmitExpenseForm({ onSubmit, onClose, isLoading, categories, draftKey }) {
  const today = new Date().toISOString().substring(0, 10);
  const [form, setForm, clearDraft] = useFormDraft(draftKey, {
    category: categories[0] || '', vendorName: '', amount: '',
    expenseDate: today, paymentMethod: 'Cash', remarks: '',
  });
  useEffect(() => {
    if (!form.category && categories[0]) setForm(current => ({ ...current, category: categories[0] }));
  }, [categories, form.category]);
  const [errors, setErrors] = useState({});
  function set(k, v) { setForm(p => ({ ...p, [k]: v })); if (errors[k]) setErrors(p => ({ ...p, [k]: '' })); }

  function validate() {
    const e = {};
    if (!form.amount || Number(form.amount) <= 0) e.amount = 'Enter a valid amount';
    if (!form.vendorName.trim()) e.vendorName = 'Vendor name is required';
    setErrors(e);
    return !Object.keys(e).length;
  }
  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    const saved = await onSubmit({ ...form, amount: Number(form.amount) });
    if (saved !== false) clearDraft();
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="px-6 py-5 space-y-4">
        <Select label="Category" required value={form.category} onChange={e => set('category', e.target.value)}>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Vendor / Supplier" required placeholder="Company name"
            value={form.vendorName} onChange={e => set('vendorName', e.target.value)} error={errors.vendorName} />
          <Input label="Amount (PKR)" required type="number" placeholder="5000"
            value={form.amount} onChange={e => set('amount', e.target.value)} error={errors.amount} />
          <Input label="Expense Date" type="date" value={form.expenseDate} onChange={e => set('expenseDate', e.target.value)} />
          <Select label="Payment Method" value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)}>
            {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
          </Select>
        </div>
        <Textarea label="Remarks / Description" value={form.remarks}
          onChange={e => set('remarks', e.target.value)} placeholder="What was this expense for?" />
        <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
          Approval: <span className="text-foreground font-medium">Manager → Admin → Payment</span>
        </div>
      </div>
      <ModalFooter>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" size="sm" disabled={isLoading} className="gap-1.5">
          <Receipt className="h-4 w-4" /> {isLoading ? 'Submitting...' : 'Submit Expense'}
        </Button>
      </ModalFooter>
    </form>
  );
}

function CategoryManagerModal({ isOpen, onClose, categories }) {
  const [form, setForm] = useState({ name: '', description: '', active: true });
  const [editingId, setEditingId] = useState(null);
  const [createCategory, { isLoading: creating }] = useCreateExpenseCategoryMutation();
  const [updateCategory, { isLoading: updating }] = useUpdateExpenseCategoryMutation();
  const [deleteCategory, { isLoading: deleting }] = useDeleteExpenseCategoryMutation();
  const busy = creating || updating || deleting;

  function reset() {
    setEditingId(null);
    setForm({ name: '', description: '', active: true });
  }

  async function save(e) {
    e.preventDefault();
    try {
      if (editingId) await updateCategory({ id: editingId, ...form }).unwrap();
      else await createCategory(form).unwrap();
      toast.success(editingId ? 'Expense category updated' : 'Expense category created');
      reset();
    } catch (error) {
      toast.error(error?.data?.error?.message || 'Unable to save expense category');
    }
  }

  async function remove(category) {
    try {
      await deleteCategory(category._id).unwrap();
      toast.success('Expense category deleted');
      if (editingId === category._id) reset();
    } catch (error) {
      toast.error(error?.data?.error?.message || 'Unable to delete expense category');
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Expense Categories" size="md">
      <form onSubmit={save} className="border-b border-border px-6 py-4 space-y-3">
        <Input label="Category Name" required value={form.name}
          onChange={e => setForm(current => ({ ...current, name: e.target.value }))}
          placeholder="e.g. Software Subscriptions" />
        <Textarea label="Description" value={form.description}
          onChange={e => setForm(current => ({ ...current, description: e.target.value }))}
          placeholder="Optional category description" rows={2} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.active}
            onChange={e => setForm(current => ({ ...current, active: e.target.checked }))} />
          Active category
        </label>
        <div className="flex justify-end gap-2">
          {editingId && <Button type="button" variant="ghost" size="sm" onClick={reset}>Cancel Edit</Button>}
          <Button type="submit" variant="primary" size="sm" disabled={busy || !form.name.trim()}>
            {editingId ? 'Update Category' : 'Create Category'}
          </Button>
        </div>
      </form>
      <div className="max-h-80 divide-y divide-border overflow-y-auto px-6 py-2">
        {categories.map(category => (
          <div key={category._id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{category.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {category.description || 'No description'} · {category.active ? 'Active' : 'Inactive'}
              </p>
            </div>
            <button type="button" title="Edit category" className="rounded p-1.5 hover:bg-accent"
              onClick={() => { setEditingId(category._id); setForm({ name: category.name, description: category.description || '', active: category.active }); }}>
              <Pencil className="h-4 w-4" />
            </button>
            <button type="button" title="Delete category" className="rounded p-1.5 text-destructive hover:bg-destructive/10"
              onClick={() => remove(category)} disabled={busy}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// ─── Expense Detail Modal ─────────────────────────────────────────────────────
function ExpenseDetailModal({ expense, isOpen, onClose, onApprove, onReject, onMarkPaid, canApprove, isActioning }) {
  const [remarks, setRemarks] = useState('');
  if (!expense) return null;
  const st = STATUS_STYLES[expense.status] || STATUS_STYLES.pending;
  const STAGE_LABELS = { 1: 'Manager', 2: 'Admin' };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Expense Details" size="md">
      <div className="px-6 py-5 space-y-5">
        {/* Submitter */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
          <Avatar name={expense.submittedBy?.fullName} size="md" />
          <div>
            <p className="font-medium">{expense.submittedBy?.fullName}</p>
            <p className="text-xs text-muted-foreground">{expense.submittedBy?.department}</p>
          </div>
          <Badge variant={st.variant} className="ml-auto">{st.label}</Badge>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-3 sm:gap-3">
          {[
            { label: 'Category',       value: expense.category },
            { label: 'Vendor',         value: expense.vendorName || '—' },
            { label: 'Amount',         value: fmtPKR(expense.amount), highlight: true },
            { label: 'Payment Method', value: expense.paymentMethod || '—' },
            { label: 'Date',           value: fmtDate(expense.expenseDate) },
            { label: 'Submitted',      value: fmtDate(expense.createdAt) },
          ].map(({ label, value, highlight }) => (
            <div key={label} className="glass-card px-3 py-2">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
              <p className={`text-sm font-medium mt-0.5 ${highlight ? 'text-primary text-base' : ''}`}>{value}</p>
            </div>
          ))}
        </div>

        {expense.remarks && (
          <div className="text-sm border border-border rounded-lg p-3">{expense.remarks}</div>
        )}

        {/* Approval Chain */}
        {expense.approvalChain?.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Approval Progress</p>
            <div className="space-y-2">
              {expense.approvalChain.map(step => (
                <div key={step.stage} className={`flex items-center gap-3 p-2.5 rounded-lg border
                  ${step.status === 'approved' ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20' :
                    step.status === 'rejected'  ? 'border-red-200 bg-red-50 dark:bg-red-900/20' :
                    step.stage === expense.currentStage ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/20'}`}>
                  <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold
                    ${step.status === 'approved' ? 'bg-emerald-500 text-white' :
                      step.status === 'rejected'  ? 'bg-red-500 text-white' :
                      step.stage === expense.currentStage ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                    {step.status === 'approved' ? '✓' : step.status === 'rejected' ? '✗' : step.stage}
                  </div>
                  <span className="text-sm">{STAGE_LABELS[step.stage]}</span>
                  {step.status !== 'pending' && (
                    <Badge variant={step.status === 'approved' ? 'green' : 'red'} className="ml-auto">
                      {step.status}
                    </Badge>
                  )}
                  {step.remarks && <span className="text-xs text-muted-foreground ml-2 truncate">{step.remarks}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Approve / Reject actions */}
        {canApprove && ['pending','processing'].includes(expense.status) && (
          <div className="space-y-3">
            <Textarea label="Remarks (optional)" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Add review remarks..." rows={2} />
            <div className="flex gap-2">
              <Button variant="primary" size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-1.5"
                onClick={() => onApprove(expense._id, remarks)} disabled={isActioning}>
                <CheckCircle2 className="h-4 w-4" /> {isActioning ? '...' : 'Approve'}
              </Button>
              <Button variant="danger" size="sm" className="flex-1 gap-1.5"
                onClick={() => onReject(expense._id, remarks)} disabled={isActioning}>
                <XCircle className="h-4 w-4" /> {isActioning ? '...' : 'Reject'}
              </Button>
            </div>
          </div>
        )}
        {canApprove && expense.status === 'approved' && (
          <Button variant="primary" size="sm" className="w-full gap-1.5"
            onClick={() => onMarkPaid(expense._id)} disabled={isActioning}>
            <CreditCard className="h-4 w-4" /> {isActioning ? 'Processing...' : 'Mark as Paid'}
          </Button>
        )}
      </div>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ExpensesListPage() {
  const { user } = useSelector(s => s.auth);
  const canApprove = ['admin','super_admin','manager'].includes(user?.role);
  const isAdmin = ['admin','super_admin'].includes(user?.role);

  const [submitOpen, setSubmitOpen]     = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [detailExpense, setDetailExpense] = useState(null);
  const [page, setPage]                 = useState(1);
  const [filters, setFilters]           = useState({ status: '', category: '' });

  const { data, isLoading, isFetching, refetch } = useListExpensesQuery({ page, limit: 15, ...filters });
  const { data: categoriesData } = useListExpenseCategoriesQuery();
  const [submitExpense,  { isLoading: submitting }]  = useSubmitExpenseMutation();
  const [approveExpense, { isLoading: approving }]   = useApproveExpenseMutation();
  const [rejectExpense,  { isLoading: rejecting }]   = useRejectExpenseMutation();
  const [markPaid,       { isLoading: paying }]      = useMarkExpensePaidMutation();

  const isActioning = approving || rejecting || paying;
  const expenses    = data?.items || [];
  const categoryRecords = categoriesData?.data || [];
  const categories = categoryRecords.filter(category => category.active).map(category => category.name);
  const total       = data?.total || 0;
  const totalPages  = data?.totalPages || 1;

  // Stats from current page data
  const totalAmt   = expenses.reduce((s, e) => s + (e.amount||0), 0);
  const pendingAmt = expenses.filter(e => ['pending','processing'].includes(e.status)).reduce((s,e) => s+(e.amount||0), 0);
  const paidAmt    = expenses.filter(e => e.status === 'paid').reduce((s,e) => s+(e.amount||0), 0);

  // Chart data by category
  const catData = categories.map(cat => ({
    name: cat.replace(' Expenses','').replace(' Bills',''),
    amount: expenses.filter(e => e.category === cat).reduce((s,e) => s+(e.amount||0), 0),
  })).filter(d => d.amount > 0);

  async function handleSubmit(payload) {
    try { await submitExpense(payload).unwrap(); toast.success('Expense submitted'); setSubmitOpen(false); return true; }
    catch (err) { toast.error(err?.data?.error?.message || 'Submission failed'); return false; }
  }
  async function handleApprove(id, remarks) {
    try { await approveExpense({ id, remarks }).unwrap(); toast.success('Expense approved'); setDetailExpense(null); }
    catch (err) { toast.error(err?.data?.error?.message || 'Approval failed'); }
  }
  async function handleReject(id, remarks) {
    try { await rejectExpense({ id, remarks }).unwrap(); toast.success('Expense rejected'); setDetailExpense(null); }
    catch (err) { toast.error('Rejection failed'); }
  }
  async function handleMarkPaid(id) {
    try { await markPaid(id).unwrap(); toast.success('Marked as paid'); setDetailExpense(null); }
    catch (err) { toast.error('Failed to update payment status'); }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Submit and manage company expenses</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
          {isAdmin && (
            <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => setCategoriesOpen(true)}>
              <Settings2 className="h-4 w-4" /> Categories
            </Button>
          )}
          <Button variant="primary" size="sm" className="gap-1.5" onClick={() => setSubmitOpen(true)}>
            <Plus className="h-4 w-4" /> Submit Expense
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Total Expenses"   value={fmtPKR(totalAmt)}   icon={Receipt} />
        <StatCard title="Pending Payment"  value={fmtPKR(pendingAmt)} icon={TrendingDown} trend={{ label: 'Awaiting approval', positive: false }} />
        <StatCard title="Paid"             value={fmtPKR(paidAmt)}    icon={CreditCard} trend={{ label: 'Disbursed', positive: true }} />
      </div>

      {/* Chart + Table layout */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Table */}
        <div className="glass-card overflow-hidden">
          {/* Toolbar */}
          <div className="flex flex-wrap gap-3 items-center px-5 py-3 border-b border-border">
            <select className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
              value={filters.status} onChange={e => { setFilters(p => ({ ...p, status: e.target.value })); setPage(1); }}>
              <option value="">All Status</option>
              {Object.entries(STATUS_STYLES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
              value={filters.category} onChange={e => { setFilters(p => ({ ...p, category: e.target.value })); setPage(1); }}>
              <option value="">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <span className="text-xs text-muted-foreground ml-auto">{total} expenses</span>
          </div>

          {isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : expenses.length === 0 ? (
            <div className="py-16 text-center">
              <Receipt className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium">No expenses found</p>
              <p className="text-sm text-muted-foreground mt-1">Submit an expense using the button above.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {expenses.map((exp, i) => {
                const st = STATUS_STYLES[exp.status] || STATUS_STYLES.pending;
                return (
                  <motion.div key={exp._id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.025 }}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-accent/30 transition-colors cursor-pointer group"
                    onClick={() => setDetailExpense(exp)}>
                    <Avatar name={exp.submittedBy?.fullName} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{exp.category}</span>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {exp.vendorName} · {fmtDate(exp.expenseDate)} · {exp.submittedBy?.fullName}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-primary shrink-0">{fmtPKR(exp.amount)}</span>
                    <button className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={e => { e.stopPropagation(); setDetailExpense(exp); }}>
                      <Eye className="h-4 w-4" />
                    </button>
                  </motion.div>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-border">
              <span className="text-xs text-muted-foreground">Page {page}/{totalPages}</span>
              <div className="flex gap-1">
                <Button variant="secondary" size="sm" className="px-2"
                  onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="secondary" size="sm" className="px-2"
                  onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Category chart */}
        <div className="glass-card p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> By Category
          </h3>
          {catData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={catData} layout="vertical" margin={{ left: 0, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${v/1000}k`} />
                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10 }} />
                <Tooltip formatter={v => fmtPKR(v)} />
                <Bar dataKey="amount" fill="#6366f1" radius={[0,6,6,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Submit Modal */}
      <Modal isOpen={submitOpen} onClose={() => setSubmitOpen(false)} title="Submit New Expense" size="md">
        <SubmitExpenseForm onSubmit={handleSubmit} onClose={() => setSubmitOpen(false)}
          isLoading={submitting} categories={categories}
          draftKey={`hrms:draft:expense:create:${user?.id || 'user'}`} />
      </Modal>

      <CategoryManagerModal isOpen={categoriesOpen} onClose={() => setCategoriesOpen(false)}
        categories={categoryRecords} />

      {/* Detail Modal */}
      <ExpenseDetailModal
        expense={detailExpense} isOpen={!!detailExpense} onClose={() => setDetailExpense(null)}
        onApprove={handleApprove} onReject={handleReject} onMarkPaid={handleMarkPaid}
        canApprove={canApprove} isActioning={isActioning}
      />
    </div>
  );
}

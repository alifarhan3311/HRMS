import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import {
  Receipt, Plus, RefreshCw, ChevronLeft, ChevronRight, Eye,
  BarChart3, Settings2, Pencil, Trash2, ListChecks, Tags,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  useListExpensesQuery,
  useSubmitExpenseMutation,
  useListExpenseCategoriesQuery,
  useCreateExpenseCategoryMutation,
  useUpdateExpenseCategoryMutation,
  useDeleteExpenseCategoryMutation,
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

const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Credit Card', 'Cheque', 'Online'];
const STATUS_STYLES = {
  recorded: { label: 'Recorded', variant: 'blue' },
  pending: { label: 'Historical: Pending', variant: 'yellow' },
  processing: { label: 'Historical: Processing', variant: 'blue' },
  approved: { label: 'Historical: Approved', variant: 'green' },
  rejected: { label: 'Historical: Rejected', variant: 'red' },
  paid: { label: 'Historical: Paid', variant: 'purple' },
  cancelled: { label: 'Historical: Cancelled', variant: 'gray' },
};

function fmtPKR(value) {
  return `PKR ${Number(value || 0).toLocaleString()}`;
}

function fmtDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-PK', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function SubmitExpenseForm({ onSubmit, onClose, isLoading, categories, draftKey }) {
  const today = new Date().toISOString().substring(0, 10);
  const [form, setForm, clearDraft] = useFormDraft(draftKey, {
    category: categories[0] || '',
    vendorName: '',
    amount: '',
    expenseDate: today,
    paymentMethod: 'Cash',
    remarks: '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!form.category && categories[0]) {
      setForm((current) => ({ ...current, category: categories[0] }));
    }
  }, [categories, form.category, setForm]);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: '' }));
  }

  async function submit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!form.category) nextErrors.category = 'Create or select an expense category';
    if (!form.vendorName.trim()) nextErrors.vendorName = 'Vendor name is required';
    if (!form.amount || Number(form.amount) <= 0) nextErrors.amount = 'Enter a valid amount';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const saved = await onSubmit({ ...form, amount: Number(form.amount) });
    if (saved) clearDraft();
  }

  return (
    <form onSubmit={submit}>
      <div className="space-y-4 px-6 py-5">
        <Select label="Category" required value={form.category}
          onChange={(event) => updateField('category', event.target.value)} error={errors.category}>
          {!categories.length && <option value="">Create a category first</option>}
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </Select>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Vendor / Supplier" required placeholder="Company or person name"
            value={form.vendorName} onChange={(event) => updateField('vendorName', event.target.value)}
            error={errors.vendorName} />
          <Input label="Amount (PKR)" required type="number" min="0" step="0.01" placeholder="5000"
            value={form.amount} onChange={(event) => updateField('amount', event.target.value)}
            error={errors.amount} />
          <Input label="Expense Date" required type="date" max={today} value={form.expenseDate}
            onChange={(event) => updateField('expenseDate', event.target.value)} />
          <Select label="Payment Method" value={form.paymentMethod}
            onChange={(event) => updateField('paymentMethod', event.target.value)}>
            {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
          </Select>
        </div>
        <Textarea label="Remarks / Description" value={form.remarks}
          onChange={(event) => updateField('remarks', event.target.value)}
          placeholder="What was this expense for?" />
        <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          This entry will be recorded immediately and shown to Super Admin. No approval is required.
        </p>
      </div>
      <ModalFooter>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" size="sm" disabled={isLoading || !categories.length} className="gap-1.5">
          <Receipt className="h-4 w-4" /> {isLoading ? 'Recording...' : 'Record Expense'}
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

  async function save(event) {
    event.preventDefault();
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
      <form onSubmit={save} className="space-y-3 border-b border-border px-6 py-4">
        <Input label="Category Name" required value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          placeholder="e.g. Utility Bills" />
        <Textarea label="Description" rows={2} value={form.description}
          onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.active}
            onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} />
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
        {!categories.length && <p className="py-8 text-center text-sm text-muted-foreground">No categories yet</p>}
        {categories.map((category) => (
          <div key={category._id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{category.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {category.description || 'No description'} · {category.active ? 'Active' : 'Inactive'}
              </p>
            </div>
            <button type="button" title="Edit category" className="rounded p-1.5 hover:bg-accent"
              onClick={() => {
                setEditingId(category._id);
                setForm({ name: category.name, description: category.description || '', active: category.active });
              }}>
              <Pencil className="h-4 w-4" />
            </button>
            <button type="button" title="Delete category"
              className="rounded p-1.5 text-destructive hover:bg-destructive/10"
              onClick={() => remove(category)} disabled={busy}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function ExpenseDetailModal({ expense, isOpen, onClose }) {
  if (!expense) return null;
  const status = STATUS_STYLES[expense.status] || STATUS_STYLES.recorded;
  const details = [
    ['Category', expense.category],
    ['Vendor', expense.vendorName || '-'],
    ['Amount', fmtPKR(expense.amount)],
    ['Payment Method', expense.paymentMethod || '-'],
    ['Expense Date', fmtDate(expense.expenseDate)],
    ['Recorded On', fmtDate(expense.createdAt)],
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Expense Details" size="md">
      <div className="space-y-5 px-6 py-5">
        <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-3">
          <Avatar name={expense.submittedBy?.fullName} size="md" />
          <div>
            <p className="font-medium">{expense.submittedBy?.fullName || 'HR'}</p>
            <p className="text-xs text-muted-foreground">Recorded by HR</p>
          </div>
          <Badge variant={status.variant} className="ml-auto">{status.label}</Badge>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {details.map(([label, value]) => (
            <div key={label} className="glass-card px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-0.5 text-sm font-medium">{value}</p>
            </div>
          ))}
        </div>
        {expense.remarks && <div className="rounded-lg border border-border p-3 text-sm">{expense.remarks}</div>}
      </div>
    </Modal>
  );
}

export default function ExpensesListPage() {
  const { user } = useSelector((state) => state.auth);
  const isHR = user?.role === 'hr';
  const isSuperAdmin = user?.role === 'super_admin';
  const [submitOpen, setSubmitOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [detailExpense, setDetailExpense] = useState(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: '', category: '' });

  const { data, isLoading, isFetching, refetch } = useListExpensesQuery(
    { page, limit: 15, ...filters },
    { skip: !isSuperAdmin },
  );
  const { data: categoriesData } = useListExpenseCategoriesQuery(undefined, {
    skip: !isHR && !isSuperAdmin,
  });
  const [submitExpense, { isLoading: submitting }] = useSubmitExpenseMutation();

  const expenses = data?.items || [];
  const categoryRecords = categoriesData?.data || [];
  const categories = categoryRecords.filter((category) => category.active).map((category) => category.name);
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const totalAmount = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
  const categoryTotals = expenses.reduce((totals, expense) => {
    totals[expense.category] = (totals[expense.category] || 0) + (expense.amount || 0);
    return totals;
  }, {});
  const catData = Object.entries(categoryTotals).map(([category, amount]) => ({
    name: category.replace(' Expenses', '').replace(' Bills', ''),
    amount,
  }));

  async function handleSubmit(payload) {
    try {
      await submitExpense(payload).unwrap();
      toast.success('Expense recorded and shared with Super Admin');
      setSubmitOpen(false);
      return true;
    } catch (error) {
      toast.error(error?.data?.error?.message || 'Unable to record expense');
      return false;
    }
  }

  if (isHR) {
    return (
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Record Expenses</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Add company expenses for Super Admin to view</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => setCategoriesOpen(true)}>
              <Settings2 className="h-4 w-4" /> Categories
            </Button>
            <Button variant="primary" size="sm" className="gap-1.5" onClick={() => setSubmitOpen(true)}>
              <Plus className="h-4 w-4" /> Record Expense
            </Button>
          </div>
        </motion.div>

        <div className="glass-card p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-primary/10 p-3 text-primary"><Receipt className="h-6 w-6" /></div>
            <div>
              <h2 className="font-semibold">Simple expense entry</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Record the category, vendor, amount, date and payment method. The entry is saved immediately
                and becomes visible to Super Admin; there is no approval or payment-status workflow.
              </p>
              <p className="mt-3 text-sm"><span className="font-medium">Active categories:</span> {categories.length}</p>
            </div>
          </div>
        </div>

        <Modal isOpen={submitOpen} onClose={() => setSubmitOpen(false)} title="Record New Expense" size="md">
          <SubmitExpenseForm onSubmit={handleSubmit} onClose={() => setSubmitOpen(false)}
            isLoading={submitting} categories={categories}
            draftKey={`hrms:draft:expense:create:${user?.id || 'user'}`} />
        </Modal>
        <CategoryManagerModal isOpen={categoriesOpen} onClose={() => setCategoriesOpen(false)}
          categories={categoryRecords} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Company Expenses</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Read-only expense records submitted by HR</p>
        </div>
        <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Page Total" value={fmtPKR(totalAmount)} icon={Receipt} />
        <StatCard title="Expense Entries" value={total} icon={ListChecks} />
        <StatCard title="Categories" value={categoryRecords.length} icon={Tags} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="glass-card overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
            <select className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
              value={filters.status} onChange={(event) => { setFilters((current) => ({ ...current, status: event.target.value })); setPage(1); }}>
              <option value="">All Statuses</option>
              {Object.entries(STATUS_STYLES).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
            </select>
            <select className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
              value={filters.category} onChange={(event) => { setFilters((current) => ({ ...current, category: event.target.value })); setPage(1); }}>
              <option value="">All Categories</option>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            <span className="ml-auto text-xs text-muted-foreground">{total} expenses</span>
          </div>

          {isLoading ? (
            <div className="space-y-2 p-4">{[...Array(6)].map((_, index) => <Skeleton key={index} className="h-16 rounded-xl" />)}</div>
          ) : !expenses.length ? (
            <div className="py-16 text-center">
              <Receipt className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-medium">No expenses recorded</p>
              <p className="mt-1 text-sm text-muted-foreground">New entries recorded by HR will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {expenses.map((expense, index) => {
                const status = STATUS_STYLES[expense.status] || STATUS_STYLES.recorded;
                return (
                  <motion.div key={expense._id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.025 }} onClick={() => setDetailExpense(expense)}
                    className="group flex cursor-pointer items-center gap-4 px-5 py-3.5 transition-colors hover:bg-accent/30">
                    <Avatar name={expense.submittedBy?.fullName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{expense.category}</span>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {expense.vendorName} · {fmtDate(expense.expenseDate)} · {expense.submittedBy?.fullName || 'HR'}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-primary">{fmtPKR(expense.amount)}</span>
                    <Eye className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </motion.div>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-5 py-3">
              <span className="text-xs text-muted-foreground">Page {page}/{totalPages}</span>
              <div className="flex gap-1">
                <Button variant="secondary" size="sm" className="px-2" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="secondary" size="sm" className="px-2" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page === totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="glass-card p-5">
          <h3 className="mb-4 flex items-center gap-2 font-semibold"><BarChart3 className="h-4 w-4" /> By Category</h3>
          {!catData.length ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={catData} layout="vertical" margin={{ left: 0, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(value) => `${value / 1000}k`} />
                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value) => fmtPKR(value)} />
                <Bar dataKey="amount" fill="#6366f1" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <ExpenseDetailModal expense={detailExpense} isOpen={Boolean(detailExpense)} onClose={() => setDetailExpense(null)} />
    </div>
  );
}

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import {
  Receipt, Plus, RefreshCw, ChevronLeft, ChevronRight, Eye,
  BarChart3, Settings2, Pencil, Trash2, ListChecks, Tags, Upload, MessageCircle,
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
  useSubmitBulkExpensesMutation,
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

function BulkExpenseForm({ onSubmit, onClose, isLoading }) {
  const today = new Date().toISOString().slice(0, 10);
  const emptyRow = () => ({ expenseDate: today, productName: '', quantity: 1, unitPrice: '' });
  const [rows, setRows] = useState([emptyRow()]);
  const [importError, setImportError] = useState('');

  function updateRow(index, field, value) {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  }

  function excelDate(value, XLSX) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
    if (typeof value === 'number') {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
  }

  async function importExcel(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImportError('');
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      const normalized = data.map((source) => {
        const values = Object.fromEntries(Object.entries(source).map(([key, value]) => [
          String(key).trim().toLowerCase().replace(/[^a-z]/g, ''), value,
        ]));
        return {
          expenseDate: excelDate(values.date || values.expensedate, XLSX),
          productName: String(values.product || values.productname || '').trim(),
          quantity: Number(values.quantity || values.qty || 0),
          unitPrice: Number(values.price || values.unitprice || 0),
        };
      }).filter((row) => row.expenseDate || row.productName || row.quantity || row.unitPrice);
      if (!normalized.length) throw new Error('No expense rows found in the first sheet.');
      const invalidIndex = normalized.findIndex((row) => (
        !row.expenseDate || !row.productName || row.quantity <= 0 || row.unitPrice <= 0
      ));
      if (invalidIndex >= 0) throw new Error(`Excel row ${invalidIndex + 2} has an invalid Date, Product, Quantity or Price.`);
      setRows(normalized);
      toast.success(`${normalized.length} Excel rows imported`);
    } catch (error) {
      setImportError(error.message || 'Unable to read Excel file');
    }
  }

  async function submit(event) {
    event.preventDefault();
    const normalized = rows.map((row) => ({
      expenseDate: row.expenseDate,
      productName: String(row.productName || '').trim(),
      quantity: Number(row.quantity),
      unitPrice: Number(row.unitPrice),
    }));
    if (normalized.some((row) => !row.expenseDate || !row.productName || row.quantity <= 0 || row.unitPrice <= 0)) {
      return toast.error('Complete every row with a valid date, product, quantity and price');
    }
    await onSubmit(normalized);
  }

  const grandTotal = rows.reduce((sum, row) => sum + (Number(row.quantity || 0) * Number(row.unitPrice || 0)), 0);
  return (
    <form onSubmit={submit}>
      <div className="space-y-4 px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3">
          <div>
            <p className="text-sm font-semibold">Import from Excel</p>
            <p className="text-xs text-muted-foreground">First sheet headers: Date, Product, Quantity, Price. Total is calculated automatically.</p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-background px-3 py-2 text-sm font-medium shadow-sm ring-1 ring-border hover:bg-accent">
            <Upload className="h-4 w-4" /> Select Excel
            <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={importExcel} />
          </label>
        </div>
        {importError && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{importError}</p>}

        <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
          <div className="hidden grid-cols-[145px_minmax(180px,1fr)_100px_130px_120px_36px] gap-2 px-2 text-[11px] font-semibold uppercase text-muted-foreground lg:grid">
            <span>Date</span><span>Product</span><span>Quantity</span><span>Price</span><span>Total</span><span />
          </div>
          {rows.map((row, index) => {
            const total = Number(row.quantity || 0) * Number(row.unitPrice || 0);
            return (
              <div key={index} className="grid gap-2 rounded-xl border border-border p-3 lg:grid-cols-[145px_minmax(180px,1fr)_100px_130px_120px_36px] lg:items-center lg:border-0 lg:p-0">
                <Input aria-label={`Date row ${index + 1}`} type="date" max={today} required value={row.expenseDate}
                  onChange={(e) => updateRow(index, 'expenseDate', e.target.value)} />
                <Input aria-label={`Product row ${index + 1}`} placeholder="Product / item" required value={row.productName}
                  onChange={(e) => updateRow(index, 'productName', e.target.value)} />
                <Input aria-label={`Quantity row ${index + 1}`} type="number" min="0.001" step="0.001" required value={row.quantity}
                  onChange={(e) => updateRow(index, 'quantity', e.target.value)} />
                <Input aria-label={`Price row ${index + 1}`} type="number" min="0.01" step="0.01" required value={row.unitPrice}
                  onChange={(e) => updateRow(index, 'unitPrice', e.target.value)} />
                <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm font-semibold">{fmtPKR(total)}</div>
                <button type="button" aria-label={`Remove row ${index + 1}`} disabled={rows.length === 1}
                  className="rounded-lg p-2 text-destructive hover:bg-destructive/10 disabled:opacity-30"
                  onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <Button type="button" variant="secondary" size="sm" className="gap-1.5"
            onClick={() => setRows((current) => [...current, emptyRow()])}>
            <Plus className="h-4 w-4" /> Add Row
          </Button>
          <div className="text-right"><p className="text-xs text-muted-foreground">{rows.length} items</p><p className="text-lg font-bold">Grand Total: {fmtPKR(grandTotal)}</p></div>
        </div>
      </div>
      <ModalFooter>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" size="sm" disabled={isLoading} className="gap-1.5">
          <Receipt className="h-4 w-4" /> {isLoading ? 'Recording...' : `Submit ${rows.length} Expense${rows.length === 1 ? '' : 's'}`}
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
  const [whatsAppNumber, setWhatsAppNumber] = useState('');
  if (!expense) return null;
  const status = STATUS_STYLES[expense.status] || STATUS_STYLES.recorded;
  const details = [
    ['Category', expense.category],
    ['Product', expense.productName || expense.vendorName || '-'],
    ['Quantity', expense.quantity ?? '-'],
    ['Unit Price', expense.unitPrice != null ? fmtPKR(expense.unitPrice) : '-'],
    ['Total', fmtPKR(expense.amount)],
    ['Payment Method', expense.paymentMethod || '-'],
    ['Expense Date', fmtDate(expense.expenseDate)],
    ['Recorded On', fmtDate(expense.createdAt)],
  ];

  function shareOnWhatsApp() {
    let number = whatsAppNumber.replace(/\D/g, '');
    if (number.startsWith('0')) number = `92${number.slice(1)}`;
    if (number.length < 10) {
      toast.error('Enter a valid WhatsApp number');
      return;
    }
    const message = [
      '*HRMS Expense Details*',
      `Category: ${expense.category}`,
      `Product/Vendor: ${expense.productName || expense.vendorName || '-'}`,
      `Amount: ${fmtPKR(expense.amount)}`,
      `Date: ${fmtDate(expense.expenseDate)}`,
      `Payment: ${expense.paymentMethod || '-'}`,
      expense.remarks ? `Remarks: ${expense.remarks}` : '',
      `Recorded by: ${expense.submittedBy?.fullName || 'HR'}`,
    ].filter(Boolean).join('\n');
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  }

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
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
          <p className="mb-3 text-sm font-semibold">Share expense on WhatsApp</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              aria-label="WhatsApp number"
              placeholder="03XXXXXXXXX or 923XXXXXXXXX"
              value={whatsAppNumber}
              onChange={(event) => setWhatsAppNumber(event.target.value)}
            />
            <Button type="button" variant="secondary" className="shrink-0 gap-2 text-emerald-700"
              onClick={shareOnWhatsApp}>
              <MessageCircle className="h-4 w-4" /> Share
            </Button>
          </div>
        </div>
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
    { skip: !isHR && !isSuperAdmin },
  );
  const { data: categoriesData } = useListExpenseCategoriesQuery(undefined, {
    skip: !isHR && !isSuperAdmin,
  });
  const [submitExpense, { isLoading: submitting }] = useSubmitExpenseMutation();
  const [submitBulkExpenses, { isLoading: submittingBulk }] = useSubmitBulkExpensesMutation();

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

  async function handleBulkSubmit(rows) {
    try {
      const result = await submitBulkExpenses(rows).unwrap();
      toast.success(`${result.data.count} expenses recorded — ${fmtPKR(result.data.total)}`);
      setSubmitOpen(false);
      return true;
    } catch (error) {
      toast.error(error?.data?.error?.message || 'Unable to record expenses');
      return false;
    }
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Company Expenses</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">View recorded expenses and share details on WhatsApp</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          {isHR && (
            <>
              <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => setCategoriesOpen(true)}>
                <Settings2 className="h-4 w-4" /> Categories
              </Button>
              <Button variant="primary" size="sm" className="gap-1.5" onClick={() => setSubmitOpen(true)}>
                <Plus className="h-4 w-4" /> Add Expenses
              </Button>
            </>
          )}
        </div>
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
      {isHR && (
        <>
          <Modal isOpen={submitOpen} onClose={() => setSubmitOpen(false)} title="Add Expenses" size="full">
            <BulkExpenseForm onSubmit={handleBulkSubmit} onClose={() => setSubmitOpen(false)}
              isLoading={submittingBulk} />
          </Modal>
          <CategoryManagerModal isOpen={categoriesOpen} onClose={() => setCategoriesOpen(false)}
            categories={categoryRecords} />
        </>
      )}
    </div>
  );
}

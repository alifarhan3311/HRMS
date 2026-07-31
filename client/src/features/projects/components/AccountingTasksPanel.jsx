import { useMemo, useState } from 'react';
import { Check, Download, FileSpreadsheet, Plus, Printer, RotateCcw, Trash2, X } from 'lucide-react';
import {
  useCreateAccountingTasksMutation,
  useDecideAccountingTaskMutation,
  useGetAccountingTaskContextQuery,
  useListAccountingTasksQuery,
} from '../api/projects.api';
import Button from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Input, Select, Textarea } from '../../../components/ui/Input';
import { Modal, ModalFooter } from '../../../components/ui/Modal';
import { toast } from '../../../utils/toast';

const today = () => new Date().toISOString().slice(0, 10);
const blankRow = () => ({ taskDate: today(), title: '', description: '' });
const statusVariant = { pending: 'warning', approved: 'success', rejected: 'danger' };

function dateRange(period, month, year, customFrom, customTo) {
  if (period === 'custom') return { fromDate: customFrom, toDate: customTo };
  if (period === 'daily') return { fromDate: today(), toDate: today() };
  const y = Number(year);
  if (period === 'yearly') return { fromDate: `${y}-01-01`, toDate: `${y}-12-31` };
  const m = Number(month);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    fromDate: `${y}-${String(m).padStart(2, '0')}-01`,
    toDate: `${y}-${String(m).padStart(2, '0')}-${last}`,
  };
}

function TaskForm({ onClose }) {
  const [rows, setRows] = useState([blankRow()]);
  const [createTasks, { isLoading }] = useCreateAccountingTasksMutation();
  const setField = (index, field, value) => setRows((items) => items.map(
    (item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item,
  ));
  async function submit(event) {
    event.preventDefault();
    if (rows.some((row) => !row.taskDate || row.title.trim().length < 2 || row.description.trim().length < 2)) {
      return toast.error('Date, title and description are required for every task.');
    }
    try {
      await createTasks({ tasks: rows }).unwrap();
      toast.success(`${rows.length} task${rows.length === 1 ? '' : 's'} sent to your Team Lead.`);
      onClose();
    } catch (error) {
      toast.error(error?.data?.error?.message || 'Unable to add tasks.');
    }
  }
  return (
    <form onSubmit={submit}>
      <div className="max-h-[68vh] space-y-3 overflow-y-auto p-5">
        {rows.map((row, index) => (
          <div key={index} className="rounded-xl border border-border bg-muted/10 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">Task {index + 1}</p>
              {rows.length > 1 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setRows((items) => items.filter((_, i) => i !== index))}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Input label="Date" required type="date" value={row.taskDate} onChange={(e) => setField(index, 'taskDate', e.target.value)} />
              <Input label="Title" required value={row.title} maxLength={200} onChange={(e) => setField(index, 'title', e.target.value)} placeholder="Task title" />
            </div>
            <Textarea label="Description" required className="mt-3" value={row.description} maxLength={3000}
              onChange={(e) => setField(index, 'description', e.target.value)} placeholder="Task details..." />
          </div>
        ))}
        <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={() => setRows((items) => [...items, blankRow()])}>
          <Plus className="h-4 w-4" /> Add Another Task
        </Button>
      </div>
      <ModalFooter>
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={isLoading}>{isLoading ? 'Submitting...' : `Submit ${rows.length} Task${rows.length === 1 ? '' : 's'}`}</Button>
      </ModalFooter>
    </form>
  );
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

export default function AccountingTasksPanel({ user }) {
  const now = new Date();
  const viewer = ['team_lead', 'manager'].includes(user?.role);
  const [modalOpen, setModalOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [period, setPeriod] = useState('monthly');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [customFrom, setCustomFrom] = useState(today());
  const [customTo, setCustomTo] = useState(today());
  const range = dateRange(period, month, year, customFrom, customTo);
  const query = { status, employeeId, ...range };
  const { data: contextData } = useGetAccountingTaskContextQuery();
  const context = contextData?.data;
  const { data, isFetching, refetch } = useListAccountingTasksQuery(query);
  const [decide, { isLoading: deciding }] = useDecideAccountingTaskMutation();
  const records = data?.data?.records || [];
  const counts = data?.data?.counts || {};
  const employees = context?.employees || [];

  const reportTitle = useMemo(() => {
    const employee = employees.find((item) => item._id === employeeId);
    return `Accounting Tasks - ${employee?.fullName || 'All Employees'}`;
  }, [employeeId, employees]);

  async function makeDecision(record, nextStatus) {
    const reason = nextStatus === 'rejected' ? window.prompt('Rejection reason (optional):', '') : '';
    if (reason === null) return;
    try {
      await decide({ id: record._id, status: nextStatus, reason }).unwrap();
      toast.success(`Task ${nextStatus}.`);
    } catch (error) {
      toast.error(error?.data?.error?.message || 'Unable to update task.');
    }
  }

  function exportCsv() {
    if (!records.length) return toast.error('No tasks available to export.');
    const header = ['Date', 'Employee', 'Employee ID', 'Title', 'Description', 'Status', 'Decided By', 'Decision Date', 'Reason'];
    const lines = records.map((item) => [
      new Date(item.taskDate).toLocaleDateString(), item.submittedBy?.fullName, item.submittedBy?.employeeCode,
      item.title, item.description, item.status, item.decidedBy?.fullName,
      item.decidedAt ? new Date(item.decidedAt).toLocaleString() : '', item.decisionReason,
    ].map(csvCell).join(','));
    const blob = new Blob([[header.map(csvCell).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `accounting-tasks-${range.fromDate}-${range.toDate}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function exportExcel() {
    if (!records.length) return toast.error('No tasks available to export.');
    try {
      const XLSX = await import('xlsx');
      const rows = records.map((item) => ({
        Date: new Date(item.taskDate).toLocaleDateString(),
        Employee: item.submittedBy?.fullName || '',
        'Employee ID': item.submittedBy?.employeeCode || '',
        Title: item.title,
        Description: item.description,
        Status: item.status,
        'Decided By': item.decidedBy?.fullName || '',
        'Decision Date': item.decidedAt ? new Date(item.decidedAt).toLocaleString() : '',
        Reason: item.decisionReason || '',
      }));
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), 'Accounting Tasks');
      XLSX.writeFile(book, `accounting-tasks-${range.fromDate}-${range.toDate}.xlsx`);
    } catch {
      toast.error('Unable to create the Excel report.');
    }
  }

  function printReport() {
    if (!records.length) return toast.error('No tasks available to print.');
    const popup = window.open('', '_blank');
    if (!popup) return toast.error('Allow pop-ups to print or save this report as PDF.');
    const rows = records.map((item) => `<tr><td>${escapeHtml(new Date(item.taskDate).toLocaleDateString())}</td><td>${escapeHtml(item.submittedBy?.fullName)}</td><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.description)}</td><td>${escapeHtml(item.status)}</td></tr>`).join('');
    popup.document.write(`<html><head><title>${escapeHtml(reportTitle)}</title><style>body{font-family:Arial;padding:24px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}h1{font-size:20px}</style></head><body><h1>${escapeHtml(reportTitle)}</h1><p>${escapeHtml(range.fromDate)} to ${escapeHtml(range.toDate)}</p><table><thead><tr><th>Date</th><th>Employee</th><th>Title</th><th>Description</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    popup.document.close();
    popup.print();
  }

  return (
    <section className="glass-card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Accounting Tasks</h2>
          <p className="text-sm text-muted-foreground">
            {viewer ? 'Review tasks and download filtered reports.' : 'Add tasks and track Team Lead decisions.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={refetch} disabled={isFetching}><RotateCcw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /></Button>
          {viewer && <Button variant="secondary" size="sm" className="gap-1.5" onClick={exportCsv}><Download className="h-4 w-4" /> CSV</Button>}
          {viewer && <Button variant="secondary" size="sm" className="gap-1.5" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>}
          {viewer && <Button variant="secondary" size="sm" className="gap-1.5" onClick={printReport}><Printer className="h-4 w-4" /> PDF / Print</Button>}
          {context?.canCreate && <Button size="sm" className="gap-1.5" onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" /> Add Tasks</Button>}
        </div>
      </div>

      <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-2 lg:grid-cols-5">
        {viewer && (
          <Select label="Employee" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">All Employees</option>
            {employees.map((employee) => <option key={employee._id} value={employee._id}>{employee.fullName}</option>)}
          </Select>
        )}
        <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All ({counts.all || 0})</option>
          <option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
        </Select>
        <Select label="Period" value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="daily">Today</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option><option value="custom">Custom Dates</option>
        </Select>
        {period === 'monthly' && <Select label="Month" value={month} onChange={(e) => setMonth(e.target.value)}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('en', { month: 'long' })}</option>)}</Select>}
        {['monthly', 'yearly'].includes(period) && <Input label="Year" type="number" min="2000" max="2100" value={year} onChange={(e) => setYear(e.target.value)} />}
        {period === 'custom' && <Input label="From" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />}
        {period === 'custom' && <Input label="To" type="date" min={customFrom} value={customTo} onChange={(e) => setCustomTo(e.target.value)} />}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground"><th className="p-4">Employee / Date</th><th className="p-4">Task</th><th className="p-4">Status</th><th className="p-4">Decision</th>{context?.canDecide && <th className="p-4">Actions</th>}</tr></thead>
          <tbody>
            {records.map((record) => (
              <tr key={record._id} className="border-b border-border/70 align-top">
                <td className="p-4"><p className="font-medium">{record.submittedBy?.fullName}</p><p className="text-xs text-muted-foreground">{new Date(record.taskDate).toLocaleDateString()}</p></td>
                <td className="max-w-xl p-4"><p className="font-medium">{record.title}</p><p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{record.description}</p></td>
                <td className="p-4"><Badge variant={statusVariant[record.status]}>{record.status}</Badge></td>
                <td className="p-4 text-xs"><p>{record.decidedBy?.fullName || '—'}</p>{record.decisionReason && <p className="mt-1 text-muted-foreground">{record.decisionReason}</p>}</td>
                {context?.canDecide && <td className="p-4">{record.status === 'pending' ? <div className="flex gap-1"><Button size="sm" disabled={deciding} onClick={() => makeDecision(record, 'approved')}><Check className="h-4 w-4" /></Button><Button size="sm" variant="danger" disabled={deciding} onClick={() => makeDecision(record, 'rejected')}><X className="h-4 w-4" /></Button></div> : '—'}</td>}
              </tr>
            ))}
            {!records.length && <tr><td colSpan={context?.canDecide ? 5 : 4} className="p-12 text-center text-muted-foreground">No Accounting tasks found for the selected filters.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add New Tasks" size="full">
        <TaskForm onClose={() => setModalOpen(false)} />
      </Modal>
    </section>
  );
}

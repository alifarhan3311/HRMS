/**
 * features/projects/pages/ProjectsListPage.jsx
 * Full project management — create, view, assign teams, track status.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import {
  FolderKanban, Plus, RefreshCw, Clock, Users,
  CheckCircle2, Circle, PauseCircle, XCircle, Briefcase,
} from 'lucide-react';
import {
  useListProjectsQuery, useCreateProjectMutation, useUpdateProjectMutation, useGetEligibleProjectEmployeesQuery,
  useGetCallTransferContextQuery, useListCallTransfersQuery, useCreateCallTransferMutation,
  useDecideCallTransferMutation,
  useGetCallSaleContextQuery, useListCallSalesQuery, useCreateCallSaleMutation, useDecideCallSaleMutation,
} from '../api/projects.api';
import { toast } from '../../../utils/toast';
import Button from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Modal, ModalFooter } from '../../../components/ui/Modal';
import { Input, Select, Textarea } from '../../../components/ui/Input';
import StatCard from '../../../components/ui/StatCard';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useFormDraft } from '../../../hooks/useFormDraft';
import { Avatar } from '../../../components/ui/Avatar';
import AccountingTasksPanel from '../components/AccountingTasksPanel';

function CallTransferPanel({ user }) {
  const now = new Date();
  const [filters, setFilters] = useState({ status: '', employeeId: '', month: now.getMonth() + 1, year: now.getFullYear() });
  const [modalOpen, setModalOpen] = useState(false);
  const [tab, setTab] = useState(user?.role === 'team_lead' ? 'pending' : 'all');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    transferredEmployeeId: '', transferDate: now.toISOString().slice(0, 10), businessOwnerName: '', details: '',
  });
  const { data: contextData } = useGetCallTransferContextQuery();
  const context = contextData?.data;
  const query = {
    ...filters,
    status: tab === 'all' ? filters.status : tab,
  };
  const { data, isFetching } = useListCallTransfersQuery(query);
  const [createTransfer, { isLoading: creating }] = useCreateCallTransferMutation();
  const [decideTransfer, { isLoading: deciding }] = useDecideCallTransferMutation();
  const records = data?.data?.records || [];
  const progress = data?.data?.progress || {};
  const currentKey = `${user?.id || user?._id}:${Number(filters.year)}-${Number(filters.month)}`;
  const approved = progress[currentKey]?.approved || records.filter((record) => (
    record.status === 'approved'
    && String(record.submittedBy?._id || record.submittedBy) === String(user?.id || user?._id)
  )).length;
  const filteredEmployees = (context?.transferRecipients || []).filter((employee) => (
    employee.fullName.toLowerCase().includes(search.toLowerCase())
    || employee.employeeCode?.toLowerCase().includes(search.toLowerCase())
  ));
  const probationEmployees = (context?.employees || []).filter((employee) => {
    if (employee.role !== 'employee' || !employee.joiningDate) return false;
    const end = new Date(employee.joiningDate);
    end.setMonth(end.getMonth() + 3);
    return now < end;
  });
  const afterProbationEmployees = (context?.employees || []).filter((employee) => {
    if (employee.role !== 'employee' || !employee.joiningDate) return false;
    const end = new Date(employee.joiningDate);
    end.setMonth(end.getMonth() + 3);
    return now >= end;
  });

  async function submit(event) {
    event.preventDefault();
    try {
      await createTransfer(form).unwrap();
      toast.success('Transfer sent to your Team Lead');
      setModalOpen(false);
      setForm({ transferredEmployeeId: '', transferDate: now.toISOString().slice(0, 10), businessOwnerName: '', details: '' });
    } catch (error) {
      toast.error(error?.data?.error?.message || 'Could not add transfer');
    }
  }

  async function decide(record, status) {
    const reason = status === 'rejected' ? window.prompt('Rejection reason (optional):') || '' : '';
    try {
      await decideTransfer({ id: record._id, status, reason }).unwrap();
      toast.success(`Transfer ${status}`);
    } catch (error) {
      toast.error(error?.data?.error?.message || 'Could not update transfer');
    }
  }

  if (context && !context.isCallCenter) return null;
  return (
    <section className="glass-card space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Call Center Monthly Transfers</h2>
          <p className="text-xs text-muted-foreground">Probation target: 3 approved transfers every calendar month.</p>
        </div>
        {context?.underProbation && user?.role === 'employee' && (
          <Button size="sm" onClick={() => setModalOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Add Transfer</Button>
        )}
      </div>
      {user?.role === 'employee' && (
        <div className={`rounded-xl border p-4 ${approved >= 3 ? 'border-emerald-500 bg-emerald-500/10' : 'border-border bg-muted/20'}`}>
          <div className="flex justify-between text-sm"><b>Monthly target</b><b>{Math.min(approved, 3)}/3</b></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, approved / 3 * 100)}%` }} /></div>
          {approved >= 3 && <p className="mt-2 text-sm font-semibold text-emerald-600">Congratulations! Monthly target completed.</p>}
        </div>
      )}
      {['team_lead', 'floor_head', 'manager'].includes(user?.role) && (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <h3 className="font-semibold">Under Probation ({probationEmployees.length})</h3>
            <p className="mt-1 text-xs text-muted-foreground">Monthly target applies to these employees.</p>
            <div className="mt-3 flex flex-wrap gap-2">{probationEmployees.map((employee) => <span key={employee._id} className="rounded-full bg-background px-3 py-1 text-xs">{employee.fullName}</span>)}</div>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <h3 className="font-semibold">After Probation ({afterProbationEmployees.length})</h3>
            <p className="mt-1 text-xs text-muted-foreground">Historical transfer records remain available.</p>
            <div className="mt-3 flex flex-wrap gap-2">{afterProbationEmployees.map((employee) => <span key={employee._id} className="rounded-full bg-background px-3 py-1 text-xs">{employee.fullName}</span>)}</div>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {(user?.role === 'team_lead' ? ['pending', 'approved', 'rejected'] : ['all', 'pending', 'approved', 'rejected']).map((value) => (
          <Button key={value} size="sm" variant={tab === value ? 'primary' : 'outline'} onClick={() => setTab(value)} className="capitalize">{value}</Button>
        ))}
        <Select value={filters.month} onChange={(e) => setFilters((v) => ({ ...v, month: e.target.value }))} className="w-36">
          {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{new Date(2020, index).toLocaleString('en', { month: 'long' })}</option>)}
        </Select>
        <Input type="number" value={filters.year} onChange={(e) => setFilters((v) => ({ ...v, year: e.target.value }))} className="w-28" />
        {user?.role === 'team_lead' && (
          <Select value={filters.employeeId} onChange={(e) => setFilters((v) => ({ ...v, employeeId: e.target.value }))}>
            <option value="">All Employees</option>
            {(context?.employees || []).filter((e) => e.role === 'employee').map((e) => <option key={e._id} value={e._id}>{e.fullName}</option>)}
          </Select>
        )}
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left"><tr><th className="p-3">Employee</th><th className="p-3">Transferred To</th><th className="p-3">Date</th><th className="p-3">Owner / Manager</th><th className="p-3">Details</th><th className="p-3">Status</th>{user?.role === 'team_lead' && <th className="p-3">Actions</th>}</tr></thead>
          <tbody>{records.map((record) => <tr key={record._id} className="border-t border-border">
            <td className="p-3 font-medium">{record.submittedBy?.fullName}</td><td className="p-3">{record.transferredEmployeeId?.fullName}</td>
            <td className="p-3">{fmtDate(record.transferDate)}</td><td className="p-3">{record.businessOwnerName || record.ownerManagerId?.fullName || '—'}</td>
            <td className="max-w-xs whitespace-normal p-3" title={record.details || ''}>{record.details || '—'}</td>
            <td className="p-3 capitalize">{record.status}</td>
            {user?.role === 'team_lead' && <td className="p-3">{record.status === 'pending' && <div className="flex gap-2"><Button size="xs" disabled={deciding} onClick={() => decide(record, 'approved')}>Approve</Button><Button size="xs" variant="destructive" disabled={deciding} onClick={() => decide(record, 'rejected')}>Reject</Button></div>}</td>}
          </tr>)}</tbody>
        </table>
        {!records.length && <p className="p-8 text-center text-sm text-muted-foreground">{isFetching ? 'Loading...' : 'No transfers found.'}</p>}
      </div>
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add Call Transfer" size="sm">
        <form onSubmit={submit}><div className="space-y-4 p-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Transferred To <span className="text-destructive">*</span></label>
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setForm((value) => ({ ...value, transferredEmployeeId: '' }));
              }}
              placeholder="Search Call Center Team Lead..."
              autoComplete="off"
            />
            <div className="max-h-44 overflow-y-auto rounded-xl border border-border bg-background p-1">
              {filteredEmployees.map((employee) => {
                const selected = String(form.transferredEmployeeId) === String(employee._id);
                return (
                  <button key={employee._id} type="button"
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${selected ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
                    onClick={() => {
                      setForm((value) => ({ ...value, transferredEmployeeId: employee._id }));
                      setSearch(employee.fullName);
                    }}>
                    <span>{employee.fullName}</span><span className="text-xs opacity-70">{employee.employeeCode}</span>
                  </button>
                );
              })}
              {!filteredEmployees.length && <p className="px-3 py-4 text-center text-xs text-muted-foreground">No Call Center Team Lead found.</p>}
            </div>
          </div>
          <Input label="Transfer Date" required type="date" value={form.transferDate} onChange={(e) => setForm((v) => ({ ...v, transferDate: e.target.value }))} />
          <Input label="Business Owner / Manager Name" required
            placeholder="Name of the business owner you called"
            value={form.businessOwnerName}
            onChange={(e) => setForm((v) => ({ ...v, businessOwnerName: e.target.value }))} />
          <Textarea label="Transfer Details"
            placeholder="Add call transfer details, discussion notes, or important information..."
            value={form.details}
            onChange={(e) => setForm((v) => ({ ...v, details: e.target.value }))} />
        </div><ModalFooter><Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button><Button type="submit" disabled={creating}>Submit Transfer</Button></ModalFooter></form>
      </Modal>
    </section>
  );
}

const SALE_PRODUCTS = {
  pos: 'POS', atm_service: 'ATM Service', accounting: 'Accounting', osap: 'OSAP',
  digital_media_service: 'Digital Media Service', pr: 'PR', insurance: 'Insurance',
};

function CallSalesPanel({ user }) {
  const now = new Date();
  const [modalOpen, setModalOpen] = useState(false);
  const [tab, setTab] = useState('pending');
  const [filters, setFilters] = useState({ employeeId: '', product: '', month: now.getMonth() + 1, year: now.getFullYear() });
  const [form, setForm] = useState({
    saleDate: now.toISOString().slice(0, 10), businessName: '', ownerName: '', product: '', details: '',
  });
  const { data: contextData } = useGetCallSaleContextQuery();
  const context = contextData?.data;
  const { data, isFetching } = useListCallSalesQuery({ ...filters, status: tab === 'all' ? '' : tab });
  const [createSale, { isLoading: creating }] = useCreateCallSaleMutation();
  const [decideSale, { isLoading: deciding }] = useDecideCallSaleMutation();
  const records = data?.data?.records || [];
  const progress = data?.data?.progress || {};
  const target = Number(context?.target || 0);
  const key = `${user?.id || user?._id}:${filters.year}-${filters.month}`;
  const approved = Number(progress[key]?.approved || 0);
  const canSubmit = context?.isCallCenter && context?.afterProbation && ['employee', 'team_lead', 'floor_head'].includes(user?.role);

  async function submit(event) {
    event.preventDefault();
    try {
      await createSale(form).unwrap();
      toast.success('Sale submitted for approval');
      setModalOpen(false);
      setForm({ saleDate: now.toISOString().slice(0, 10), businessName: '', ownerName: '', product: '', details: '' });
    } catch (error) {
      toast.error(error?.data?.error?.message || 'Could not submit sale');
    }
  }

  async function decide(record, status) {
    const reason = status === 'rejected' ? window.prompt('Rejection reason (optional):') || '' : '';
    try {
      await decideSale({ id: record._id, status, reason }).unwrap();
      toast.success(status === 'approved'
        ? (user?.role === 'manager' ? 'Sale finally approved and counted' : 'Approved and sent to next stage')
        : 'Sale rejected');
    } catch (error) {
      toast.error(error?.data?.error?.message || 'Could not process sale');
    }
  }

  if (context && !context.isCallCenter) return null;
  return (
    <section className="glass-card space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold">After Probation Sales</h2><p className="text-xs text-muted-foreground">Only Manager-finalized sales count toward the monthly target.</p></div>
        {canSubmit && <Button size="sm" className="gap-1.5" onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" /> Add Sale</Button>}
      </div>
      {canSubmit && target > 0 && (
        <div className={`rounded-xl border p-4 ${approved >= target ? 'border-emerald-500 bg-emerald-500/10' : 'border-border bg-muted/20'}`}>
          <div className="flex justify-between text-sm"><b>Monthly Manager-approved target</b><b>{Math.min(approved, target)}/{target}</b></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, approved / target * 100)}%` }} /></div>
          {approved >= target && <p className="mt-2 font-semibold text-emerald-600">Congratulations! Monthly sales target completed.</p>}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {['all', 'pending', 'approved', 'rejected'].map((value) => <Button key={value} size="sm" variant={tab === value ? 'primary' : 'outline'} className="capitalize" onClick={() => setTab(value)}>{value}</Button>)}
        <Select value={filters.employeeId} onChange={(e) => setFilters((v) => ({ ...v, employeeId: e.target.value }))}><option value="">All Employees</option>{(context?.employees || []).map((e) => <option key={e._id} value={e._id}>{e.fullName}</option>)}</Select>
        <Select value={filters.product} onChange={(e) => setFilters((v) => ({ ...v, product: e.target.value }))}><option value="">All Products</option>{Object.entries(SALE_PRODUCTS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
        <Select value={filters.month} onChange={(e) => setFilters((v) => ({ ...v, month: e.target.value }))}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2020, i).toLocaleString('en', { month: 'long' })}</option>)}</Select>
        <Input type="number" value={filters.year} onChange={(e) => setFilters((v) => ({ ...v, year: e.target.value }))} className="w-28" />
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm"><thead className="bg-muted/50 text-left"><tr><th className="p-3">Employee</th><th className="p-3">Date</th><th className="p-3">Business</th><th className="p-3">Owner</th><th className="p-3">Product</th><th className="p-3">Details</th><th className="p-3">Status / Stage</th><th className="p-3">Actions</th></tr></thead>
          <tbody>{records.map((record) => {
            const isCurrentApprover = String(record.currentApproverId?._id || record.currentApproverId || '') === String(user?.id || user?._id);
            return <tr key={record._id} className="border-t border-border"><td className="p-3 font-medium">{record.submittedBy?.fullName}</td><td className="p-3">{fmtDate(record.saleDate)}</td><td className="p-3">{record.businessName}</td><td className="p-3">{record.ownerName}</td><td className="p-3">{SALE_PRODUCTS[record.product]}</td><td className="max-w-xs whitespace-normal p-3" title={record.details || ''}>{record.details || '—'}</td><td className="p-3 capitalize">{record.status === 'pending' ? `Pending: ${record.currentApproverId?.role?.replace('_', ' ') || 'approval'}` : record.status}</td><td className="p-3">{isCurrentApprover && record.status === 'pending' && <div className="flex gap-2"><Button size="xs" disabled={deciding} onClick={() => decide(record, 'approved')}>Approve</Button><Button size="xs" variant="destructive" disabled={deciding} onClick={() => decide(record, 'rejected')}>Reject</Button></div>}</td></tr>;
          })}</tbody>
        </table>
        {!records.length && <p className="p-8 text-center text-sm text-muted-foreground">{isFetching ? 'Loading...' : 'No sales found.'}</p>}
      </div>
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add Sale" size="sm">
        <form onSubmit={submit}><div className="space-y-4 p-5">
          <Input label="Sale Date" required type="date" value={form.saleDate} onChange={(e) => setForm((v) => ({ ...v, saleDate: e.target.value }))} />
          <Input label="Business Name" required value={form.businessName} onChange={(e) => setForm((v) => ({ ...v, businessName: e.target.value }))} />
          <Input label="Owner Name" required value={form.ownerName} onChange={(e) => setForm((v) => ({ ...v, ownerName: e.target.value }))} />
          <Select label="Product" required value={form.product} onChange={(e) => setForm((v) => ({ ...v, product: e.target.value }))}><option value="">Select product</option>{Object.entries(SALE_PRODUCTS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
          <Textarea label="Sale Details"
            placeholder="Add sale details, discussion notes, or important information..."
            value={form.details}
            onChange={(e) => setForm((v) => ({ ...v, details: e.target.value }))} />
        </div><ModalFooter><Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button><Button type="submit" disabled={creating}>Submit Sale</Button></ModalFooter></form>
      </Modal>
    </section>
  );
}

const STATUS_STYLES = {
  planning:  { label: 'Planning',   variant: 'blue',   Icon: Circle },
  active:    { label: 'Active',     variant: 'green',  Icon: CheckCircle2 },
  on_hold:   { label: 'On Hold',    variant: 'yellow', Icon: PauseCircle },
  completed: { label: 'Completed',  variant: 'purple', Icon: CheckCircle2 },
  cancelled: { label: 'Cancelled',  variant: 'red',    Icon: XCircle },
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ProjectForm({ initial, onSubmit, onClose, isLoading, draftKey, employees, currentUser }) {
  const [form, setForm, clearDraft] = useFormDraft(initial ? null : draftKey, {
    name:         initial?.name         || '',
    clientName:   initial?.clientName   || '',
    description:  initial?.description  || '',
    status:       initial?.status       || 'planning',
    startDate:    initial?.startDate    ? initial.startDate.substring(0, 10) : '',
    endDate:      initial?.endDate      ? initial.endDate.substring(0, 10)   : '',
    billableHours:initial?.billableHours|| '',
    incentivePool:initial?.incentivePool|| '',
    projectManagerId: initial?.projectManagerId?._id || initial?.projectManagerId || (currentUser?.role === 'manager' ? currentUser.id : ''),
    teamLeadId: initial?.teamLeadId?._id || initial?.teamLeadId || '',
    teamMembers: (initial?.teamMembers || []).map((member) => ({
      employeeId: member.employeeId?._id || member.employeeId,
      projectRole: member.projectRole || '',
      allocatedHours: member.allocatedHours || 0,
    })),
  });
  function set(k, v) { setForm(p => ({ ...p, [k]: v })); }
  const selectedMemberIds = new Set(form.teamMembers.map((member) => member.employeeId));
  function toggleMember(employeeId) {
    set('teamMembers', selectedMemberIds.has(employeeId)
      ? form.teamMembers.filter((member) => member.employeeId !== employeeId)
      : [...form.teamMembers, { employeeId, projectRole: '', allocatedHours: 0 }]);
  }
  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Project name is required'); return; }
    const saved = await onSubmit(form);
    if (!initial && saved !== false) clearDraft();
  }
  return (
    <form onSubmit={handleSubmit}>
      <div className="px-6 py-5 space-y-4">
        <Input label="Project Name" required value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. E-Commerce Platform" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Client Name" value={form.clientName} onChange={e => set('clientName', e.target.value)} placeholder="Client / Company" />
          <Select label="Status" value={form.status} onChange={e => set('status', e.target.value)}>
            {Object.entries(STATUS_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
          <Input label="Start Date" type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
          <Input label="End Date"   type="date" value={form.endDate}   onChange={e => set('endDate', e.target.value)} />
          <Input label="Billable Hours" type="number" value={form.billableHours} onChange={e => set('billableHours', e.target.value)} placeholder="0" />
          <Input label="Incentive Pool (PKR)" type="number" value={form.incentivePool} onChange={e => set('incentivePool', e.target.value)} placeholder="0" />
        </div>
        <Textarea label="Description" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Project overview..." />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Project Manager" value={form.projectManagerId} onChange={(e) => set('projectManagerId', e.target.value)}>
            <option value="">Select project manager</option>
            {employees.filter((employee) => employee.role === 'manager').map((employee) => <option key={employee._id} value={employee._id}>{employee.fullName} — {employee.designation || employee.employeeCode}</option>)}
          </Select>
          <Select label="Team Lead" value={form.teamLeadId} onChange={(e) => set('teamLeadId', e.target.value)}>
            <option value="">Select team lead</option>
            {employees.filter((employee) => employee.role === 'team_lead').map((employee) => <option key={employee._id} value={employee._id}>{employee.fullName} — {employee.designation || employee.employeeCode}</option>)}
          </Select>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between"><p className="text-sm font-medium">Project Team Members</p><span className="text-xs text-muted-foreground">{form.teamMembers.length} selected</span></div>
          <div className="grid max-h-56 gap-2 overflow-y-auto rounded-xl border border-border bg-muted/10 p-2 sm:grid-cols-2">
            {employees.filter((employee) => !['super_admin', 'admin'].includes(employee.role)).map((employee) => {
              const selected = selectedMemberIds.has(employee._id);
              return (
                <button key={employee._id} type="button" onClick={() => toggleMember(employee._id)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${selected ? 'border-primary bg-primary/10' : 'border-border bg-background hover:bg-accent'}`}>
                  <input type="checkbox" checked={selected} readOnly className="accent-primary" />
                  <Avatar name={employee.fullName} src={employee.profilePicture} size="xs" />
                  <span className="min-w-0"><span className="block truncate text-sm font-medium">{employee.fullName}</span><span className="block truncate text-[11px] text-muted-foreground">{employee.designation || employee.role.replace('_', ' ')}</span></span>
                </button>
              );
            })}
            {!employees.length && <p className="col-span-2 py-6 text-center text-sm text-muted-foreground">No eligible employees found.</p>}
          </div>
        </div>
      </div>
      <ModalFooter>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" size="sm" disabled={isLoading} className="gap-1.5">
          <FolderKanban className="h-4 w-4" /> {isLoading ? 'Saving...' : initial ? 'Save Changes' : 'Create Project'}
        </Button>
      </ModalFooter>
    </form>
  );
}

export default function ProjectsListPage() {
  const { user } = useSelector(s => s.auth);
  const canManage = user?.role === 'manager';
  const isCallCenter = [user?.department, ...(user?.managedDepartments || [])]
    .some((department) => /^call[\s_-]*center$/i.test(department || ''));
  const isAccounting = ['employee', 'team_lead', 'manager'].includes(user?.role)
    && [user?.department, ...(user?.managedDepartments || [])]
      .some((department) => /^account(?:ing|s)?$/i.test(String(department || '').trim()));

  const [formOpen, setFormOpen]   = useState(false);
  const [editProj, setEditProj]   = useState(null);
  const [page, setPage]           = useState(1);

  const { data, isLoading, isFetching, refetch } = useListProjectsQuery({ page, limit: 12 });
  const { data: eligibleData } = useGetEligibleProjectEmployeesQuery();
  const [createProject, { isLoading: creating }] = useCreateProjectMutation();
  const [updateProject, { isLoading: updating }] = useUpdateProjectMutation();

  const projects   = data?.items || [];
  const eligibleEmployees = eligibleData?.data || [];
  const total      = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  const statusCounts = Object.fromEntries(
    Object.keys(STATUS_STYLES).map(s => [s, projects.filter(p => p.status === s).length])
  );

  async function handleSubmit(payload) {
    try {
      if (editProj) { await updateProject({ id: editProj._id, ...payload }).unwrap(); toast.success('Project updated'); }
      else          { await createProject(payload).unwrap(); toast.success('Project created'); }
      setFormOpen(false); setEditProj(null);
      return true;
    } catch (err) { toast.error(err?.data?.error?.message || 'Operation failed'); return false; }
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total} total projects</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
          {canManage && (
            <Button variant="primary" size="sm" className="gap-1.5" onClick={() => { setEditProj(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4" /> New Project
            </Button>
          )}
        </div>
      </motion.div>

      {isCallCenter && <CallTransferPanel user={user} />}
      {isCallCenter && <CallSalesPanel user={user} />}
      {isAccounting && <AccountingTasksPanel user={user} />}

      {/* Status stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Active"    value={statusCounts.active    || 0} icon={CheckCircle2} trend={{ label: 'In progress', positive: true }} />
        <StatCard title="Planning"  value={statusCounts.planning  || 0} icon={Circle} />
        <StatCard title="On Hold"   value={statusCounts.on_hold   || 0} icon={PauseCircle} />
        <StatCard title="Completed" value={statusCounts.completed || 0} icon={Briefcase} />
      </div>

      {/* Project cards grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="glass-card py-20 text-center">
          <FolderKanban className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="font-semibold text-lg">No projects yet</p>
          {canManage && <Button variant="primary" size="sm" className="mt-4 gap-1.5" onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" />Create First Project</Button>}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((proj, i) => {
            const st = STATUS_STYLES[proj.status] || STATUS_STYLES.active;
            const Icon = st.Icon;
            return (
              <motion.div key={proj._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="glass-card p-5 hover:shadow-glow hover:-translate-y-0.5 transition-all cursor-pointer group"
                onClick={() => canManage && (setEditProj(proj), setFormOpen(true))}>
                <div className="flex items-start justify-between mb-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <FolderKanban className="h-5 w-5 text-primary" />
                  </div>
                  <Badge variant={st.variant} className="flex items-center gap-1">
                    <Icon className="h-3 w-3" /> {st.label}
                  </Badge>
                </div>
                <h3 className="font-semibold truncate">{proj.name}</h3>
                {proj.clientName && <p className="text-xs text-muted-foreground mt-0.5">{proj.clientName}</p>}
                {proj.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{proj.description}</p>}
                <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                  {proj.teamMembers?.length > 0 && (
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{proj.teamMembers.length} members</span>
                  )}
                  {proj.billableHours > 0 && (
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{proj.billableHours}h</span>
                  )}
                  {proj.endDate && (
                    <span className="ml-auto">Due: {fmtDate(proj.endDate)}</span>
                  )}
                </div>
                {(proj.projectManagerId || proj.teamLeadId) && (
                  <div className="mt-3 space-y-1 border-t border-border pt-3 text-xs">
                    {proj.projectManagerId && <p><span className="text-muted-foreground">Manager:</span> <span className="font-medium">{proj.projectManagerId.fullName}</span></p>}
                    {proj.teamLeadId && <p><span className="text-muted-foreground">Team Lead:</span> <span className="font-medium">{proj.teamLeadId.fullName}</span></p>}
                  </div>
                )}
                {proj.teamMembers?.length > 0 && (
                  <div className="mt-3 flex -space-x-2">
                    {proj.teamMembers.slice(0, 6).map((member) => <Avatar key={member.employeeId?._id || member.employeeId} name={member.employeeId?.fullName || 'Member'} src={member.employeeId?.profilePicture} size="xs" className="ring-2 ring-card" />)}
                    {proj.teamMembers.length > 6 && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] ring-2 ring-card">+{proj.teamMembers.length - 6}</span>}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}>Previous</Button>
          <span className="px-3 py-2 text-sm text-muted-foreground">{page}/{totalPages}</span>
          <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}>Next</Button>
        </div>
      )}

      <Modal isOpen={formOpen} onClose={() => { setFormOpen(false); setEditProj(null); }}
        title={editProj ? 'Edit Project' : 'New Project'} size="md">
        <ProjectForm initial={editProj} onSubmit={handleSubmit} onClose={() => { setFormOpen(false); setEditProj(null); }}
          isLoading={creating || updating} draftKey={`hrms:draft:project:create:${user?.id || 'user'}`}
          employees={eligibleEmployees} currentUser={user} />
      </Modal>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, CalendarDays, Save, ChevronDown } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Modal, ModalFooter } from '../../../components/ui/Modal';
import { toast } from '../../../utils/toast';
import {
  useCreateTrainingCommissionMutation,
  useDeleteTrainingCommissionMutation,
  useGetSalesCommissionPeriodQuery,
  useListTrainingCommissionsQuery,
  useSaveSalesCommissionPeriodMutation,
  useUpdateTrainingCommissionRecordMutation,
} from '../api/training.api';

const emptyForm = { name: '', amount: '', unit: 'PKR' };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const money = value => `Rs. ${Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;

export default function CommissionPage() {
  const { data, isLoading, isError, refetch } = useListTrainingCommissionsQuery();
  const [createCommission, { isLoading: creating }] = useCreateTrainingCommissionMutation();
  const [updateCommission, { isLoading: updating }] = useUpdateTrainingCommissionRecordMutation();
  const [deleteCommission, { isLoading: deleting }] = useDeleteTrainingCommissionMutation();
  const [saveSales, { isLoading: savingSales }] = useSaveSalesCommissionPeriodMutation();
  const [editorOpen, setEditorOpen] = useState(false);
  const [target, setTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [salesValues, setSalesValues] = useState({});
  const { data: periodData, isLoading: periodLoading, isError: periodError, refetch: refetchPeriod } = useGetSalesCommissionPeriodQuery({ month, year });
  const commissions = data?.items || [];
  const periodCommissions = periodData?.data?.commissions || [];
  const employees = periodData?.data?.employees || [];

  useEffect(() => {
    const next = {};
    for (const employee of periodData?.data?.employees || []) {
      const products = {};
      for (const item of employee.salesCommission?.items || []) products[item.slug] = { quantity: String(item.quantity || 0), salesAmount: String(item.salesAmount || 0) };
      next[employee._id] = products;
    }
    setSalesValues(next);
  }, [periodData]);

  function updateSale(employeeId, slug, key, value) {
    setSalesValues(current => ({
      ...current,
      [employeeId]: {
        ...current[employeeId],
        [slug]: { ...current[employeeId]?.[slug], [key]: value },
      },
    }));
  }

  function getEmployeeRate(employee, commission) {
    const snapshot = employee.salesCommission?.items?.find(item => item.slug === commission.slug);
    return snapshot ? { amount: Number(snapshot.rate), unit: snapshot.unit } : { amount: Number(commission.amount), unit: commission.unit };
  }

  function calculateEmployeeCommission(employeeId) {
    const employee = employees.find(item => item._id === employeeId);
    return periodCommissions.reduce((sum, commission) => {
      const input = salesValues[employeeId]?.[commission.slug] || {};
      const rate = employee ? getEmployeeRate(employee, commission) : { amount: Number(commission.amount), unit: commission.unit };
      const quantity = Number(input.quantity || 0);
      const amount = rate.unit === 'percent'
        ? Number(input.salesAmount || 0) * rate.amount / 100
        : quantity * rate.amount;
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
  }

  const monthTotal = useMemo(() => employees.reduce((sum, employee) => sum + calculateEmployeeCommission(employee._id), 0), [employees, periodCommissions, salesValues]);

  async function saveMonthlySales() {
    try {
      const entries = employees.map(employee => ({
        employeeId: employee._id,
        products: Object.fromEntries(periodCommissions.map(commission => {
          const input = salesValues[employee._id]?.[commission.slug] || {};
          return [commission.slug, { quantity: Number(input.quantity || 0), salesAmount: commission.unit === 'percent' ? Number(input.salesAmount || 0) : 0 }];
        })),
      }));
      await saveSales({ month, year, entries }).unwrap();
      toast.success(`Sales commissions saved for ${MONTHS[month - 1]} ${year}`);
      refetchPeriod();
    } catch (error) {
      toast.error(error?.data?.error?.message || 'Unable to save monthly sales.');
    }
  }

  function openAdd() {
    setTarget(null);
    setForm(emptyForm);
    setEditorOpen(true);
  }
  function openEdit(commission) {
    setTarget(commission);
    setForm({ name: commission.name, amount: String(commission.amount), unit: commission.unit });
    setEditorOpen(true);
  }
  async function save(event) {
    event.preventDefault();
    const payload = { name: form.name.trim(), amount: Number(form.amount), unit: form.unit };
    try {
      if (target) await updateCommission({ id: target._id, revision: target.revision, ...payload }).unwrap();
      else await createCommission(payload).unwrap();
      toast.success(target ? 'Commission updated' : 'Commission added');
      setEditorOpen(false);
    } catch (error) {
      toast.error(error?.data?.error?.message || 'Unable to save commission.');
    }
  }
  async function remove() {
    try {
      await deleteCommission({ id: deleteTarget._id, revision: deleteTarget.revision }).unwrap();
      toast.success('Commission removed');
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error?.data?.error?.message || 'Unable to remove commission.');
    }
  }

  return <div className="flex flex-col gap-6">
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Commission</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage commission rates and monthly employee sales.</p>
      </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4" />Add commission</Button>
    </header>

    <section className="glass-card order-2 overflow-hidden">
      <div className="border-b border-border px-5 py-4 sm:px-7"><h2 className="font-semibold">Commission rates</h2><p className="mt-1 text-sm text-muted-foreground">These rates are used for the monthly sales calculations.</p></div>
      {isLoading ? <p role="status" className="p-12 text-center text-muted-foreground">Loading commissions…</p> : isError ? <div role="alert" className="space-y-3 p-8 text-center"><p>Unable to load commissions.</p><Button variant="secondary" onClick={refetch}>Try again</Button></div> : commissions.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/30 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-3 sm:px-7">Product / service</th><th className="px-5 py-3">Commission rate</th><th className="px-5 py-3 text-right sm:px-7">Actions</th></tr></thead><tbody className="divide-y divide-border">{commissions.map(item => <tr key={item._id} className="hover:bg-accent/20"><td className="px-5 py-3.5 font-medium sm:px-7">{item.name}</td><td className="px-5 py-3.5 font-semibold text-primary">{item.unit === 'percent' ? `${item.amount}% of sales` : `${money(item.amount)} per sale`}</td><td className="px-5 py-3.5"><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" />Edit</Button><Button size="sm" variant="ghost" aria-label={`Remove ${item.name}`} onClick={() => setDeleteTarget(item)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></td></tr>)}</tbody></table></div> : <div className="p-12 text-center text-muted-foreground">No commission records yet. Add one to get started.</div>}
    </section>

    <section className="glass-card order-1 overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border px-5 py-4 sm:px-7">
        <div><div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" /><h2 className="font-semibold">Monthly Call Center sales</h2></div><p className="mt-1 text-sm text-muted-foreground">Choose a month, enter each employee’s sales, then save.</p></div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">Month<select className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" value={month} onChange={event => setMonth(Number(event.target.value))}>{MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">Year<input className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" type="number" min="2000" max="2100" value={year} onChange={event => setYear(Number(event.target.value))} /></label>
          <Button onClick={saveMonthlySales} loading={savingSales} disabled={periodLoading || periodError || !employees.length}><Save className="h-4 w-4" />Save month</Button>
        </div>
      </div>
      {periodLoading ? <p role="status" className="p-10 text-center text-muted-foreground">Loading employees and monthly sales…</p>
        : periodError ? <div role="alert" className="space-y-3 p-8 text-center"><p>Unable to load monthly sales.</p><Button variant="secondary" onClick={refetchPeriod}>Try again</Button></div>
          : !employees.length ? <div className="p-10 text-center text-muted-foreground">No Call Center employees were employed during {MONTHS[month - 1]} {year}.</div>
            : <><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/15 px-5 py-4 sm:px-7"><p className="text-sm text-muted-foreground">{employees.length} employees · {periodCommissions.length} commission types</p><p className="text-sm text-muted-foreground">Month total <strong className="ml-2 text-base text-primary">{money(monthTotal)}</strong></p></div><div className="divide-y divide-border">{employees.map((employee, index) => <details key={employee._id} open={index === 0} className="group">
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-accent/20 sm:px-7 [&::-webkit-details-marker]:hidden"><div className="flex min-w-0 items-center gap-3"><ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" /><div className="min-w-0"><p className="truncate font-semibold">{employee.fullName}</p><p className="mt-0.5 text-xs text-muted-foreground">{employee.employeeCode} · {employee.department}</p></div></div><div className="flex items-center gap-3"><span className="text-xs text-muted-foreground">Commission</span><strong className="text-primary">{money(calculateEmployeeCommission(employee._id))}</strong></div></summary>
                <div className="border-t border-border bg-muted/10 px-5 py-4 sm:px-7"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{periodCommissions.map(commission => {
                  const input = salesValues[employee._id]?.[commission.slug] || {};
                  const rate = getEmployeeRate(employee, commission);
                  const earned = rate.unit === 'percent' ? Number(input.salesAmount || 0) * rate.amount / 100 : Number(input.quantity || 0) * rate.amount;
                  return <div key={commission._id} className="rounded-xl border border-border bg-card p-4"><div className="mb-3 flex items-start justify-between gap-2"><div><h3 className="font-medium">{commission.name}</h3><p className="mt-0.5 text-xs text-muted-foreground">{rate.unit === 'percent' ? `${rate.amount}% of sales` : `${money(rate.amount)} per sale`}</p></div><strong className="whitespace-nowrap text-sm text-emerald-600">{money(earned)}</strong></div><div className={`grid gap-3 ${rate.unit === 'percent' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    <label className="grid gap-1 text-xs text-muted-foreground">{rate.unit === 'percent' ? 'Number of sales' : 'Quantity sold'}<input aria-label={`${employee.fullName} ${commission.name} quantity`} type="number" min="0" step="1" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" value={input.quantity ?? ''} onChange={event => updateSale(employee._id, commission.slug, 'quantity', event.target.value)} />{rate.unit === 'percent' && <span className="text-[11px]">How many deals were completed?</span>}</label>
                    {rate.unit === 'percent' && <label className="grid gap-1 text-xs text-muted-foreground">Combined sales amount<input aria-label={`${employee.fullName} ${commission.name} combined sales amount`} type="number" min="0" step="0.01" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" value={input.salesAmount ?? ''} onChange={event => updateSale(employee._id, commission.slug, 'salesAmount', event.target.value)} placeholder="e.g. 270000" /><span className="text-[11px]">Add all deal amounts together (e.g. 50,000 + 20,000 + 200,000 = 270,000).</span></label>}
                  </div></div>;
                })}</div></div>
              </details>)}</div><p className="px-5 py-3 text-xs text-muted-foreground sm:px-7">Rates are saved with each monthly entry. Sales for a month are locked after its payroll is submitted for approval.</p></>}
    </section>

    {editorOpen && <Modal isOpen onClose={() => !(creating || updating) && setEditorOpen(false)} title={target ? `Edit ${target.name}` : 'Add commission'} size="sm"><form onSubmit={save} className="space-y-5 p-5"><label className="block space-y-2 text-sm font-medium"><span>Name *</span><input required autoFocus maxLength={100} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" value={form.name} onChange={event => setForm(previous => ({ ...previous, name: event.target.value }))} placeholder="e.g. ATM" /></label><div className="grid grid-cols-2 gap-3"><label className="space-y-2 text-sm font-medium"><span>Value *</span><input required type="number" min="0" step="0.01" className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" value={form.amount} onChange={event => setForm(previous => ({ ...previous, amount: event.target.value }))} placeholder="Amount" /></label><label className="space-y-2 text-sm font-medium"><span>Unit *</span><select className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" value={form.unit} onChange={event => setForm(previous => ({ ...previous, unit: event.target.value }))}><option value="PKR">Rupees (PKR)</option><option value="percent">Percent (%)</option></select></label></div><ModalFooter><Button type="button" variant="secondary" disabled={creating || updating} onClick={() => setEditorOpen(false)}>Cancel</Button><Button type="submit" loading={creating || updating}>{target ? 'Save changes' : 'Add commission'}</Button></ModalFooter></form></Modal>}
    <ConfirmDialog isOpen={!!deleteTarget} title="Remove commission?" message={`“${deleteTarget?.name || ''}” will be archived and removed from the Commission page.`} confirmLabel="Remove commission" isLoading={deleting} onCancel={() => !deleting && setDeleteTarget(null)} onConfirm={remove} />
  </div>;
}

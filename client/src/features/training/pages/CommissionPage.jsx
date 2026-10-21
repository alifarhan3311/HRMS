import { useState } from 'react';
import { Coins, Plus, Pencil, Trash2 } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Modal, ModalFooter } from '../../../components/ui/Modal';
import { toast } from '../../../utils/toast';
import {
  useCreateTrainingCommissionMutation,
  useDeleteTrainingCommissionMutation,
  useListTrainingCommissionsQuery,
  useUpdateTrainingCommissionRecordMutation,
} from '../api/training.api';

const emptyForm = { name: '', amount: '', unit: 'PKR' };

export default function CommissionPage() {
  const { data, isLoading, isError, refetch } = useListTrainingCommissionsQuery();
  const [createCommission, { isLoading: creating }] = useCreateTrainingCommissionMutation();
  const [updateCommission, { isLoading: updating }] = useUpdateTrainingCommissionRecordMutation();
  const [deleteCommission, { isLoading: deleting }] = useDeleteTrainingCommissionMutation();
  const [editorOpen, setEditorOpen] = useState(false);
  const [target, setTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const commissions = data?.items || [];

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

  return <div className="space-y-6">
    <header className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-card p-6 sm:p-8">
      <Coins aria-hidden="true" className="pointer-events-none absolute -right-5 -top-6 h-40 w-40 rotate-6 text-primary/5" />
      <div className="relative flex flex-wrap items-center justify-between gap-5">
        <div><p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">HR workspace</p><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Commission</h1><p className="mt-2 text-sm text-muted-foreground">Manage fixed and percentage commission records.</p></div>
        <Button onClick={openAdd}><Plus className="h-4 w-4" />Add commission</Button>
      </div>
    </header>

    <section className="glass-card overflow-hidden">
      <div className="border-b border-border px-5 py-4 sm:px-7"><h2 className="font-semibold">Commission records</h2><p className="mt-1 text-sm text-muted-foreground">Only HR can view or manage these values.</p></div>
      {isLoading ? <p role="status" className="p-12 text-center text-muted-foreground">Loading commissions…</p> : isError ? <div role="alert" className="space-y-3 p-8 text-center"><p>Unable to load commissions.</p><Button variant="secondary" onClick={refetch}>Try again</Button></div> : commissions.length ? <div className="divide-y divide-border">{commissions.map(item => <div key={item._id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-7"><div><h3 className="font-semibold">{item.name}</h3><p className="mt-1 text-sm text-muted-foreground">{item.unit === 'percent' ? 'Percentage rate' : 'Fixed amount'}</p></div><div className="flex items-center gap-3"><p className="min-w-32 text-right font-semibold text-primary">{item.unit === 'percent' ? `${item.amount}%` : `Rs. ${Number(item.amount).toLocaleString('en-PK')}`}</p><Button size="sm" variant="outline" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" />Edit</Button><Button size="sm" variant="ghost" aria-label={`Remove ${item.name}`} onClick={() => setDeleteTarget(item)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div>)}</div> : <div className="p-12 text-center text-muted-foreground">No commission records yet. Add one to get started.</div>}
    </section>

    {editorOpen && <Modal isOpen onClose={() => !(creating || updating) && setEditorOpen(false)} title={target ? `Edit ${target.name}` : 'Add commission'} size="sm"><form onSubmit={save} className="space-y-5 p-5"><label className="block space-y-2 text-sm font-medium"><span>Name *</span><input required autoFocus maxLength={100} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" value={form.name} onChange={event => setForm(previous => ({ ...previous, name: event.target.value }))} placeholder="e.g. ATM" /></label><div className="grid grid-cols-2 gap-3"><label className="space-y-2 text-sm font-medium"><span>Value *</span><input required type="number" min="0" step="0.01" className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" value={form.amount} onChange={event => setForm(previous => ({ ...previous, amount: event.target.value }))} placeholder="Amount" /></label><label className="space-y-2 text-sm font-medium"><span>Unit *</span><select className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" value={form.unit} onChange={event => setForm(previous => ({ ...previous, unit: event.target.value }))}><option value="PKR">Rupees (PKR)</option><option value="percent">Percent (%)</option></select></label></div><ModalFooter><Button type="button" variant="secondary" disabled={creating || updating} onClick={() => setEditorOpen(false)}>Cancel</Button><Button type="submit" loading={creating || updating}>{target ? 'Save changes' : 'Add commission'}</Button></ModalFooter></form></Modal>}
    <ConfirmDialog isOpen={!!deleteTarget} title="Remove commission?" message={`“${deleteTarget?.name || ''}” will be archived and removed from the Commission page.`} confirmLabel="Remove commission" isLoading={deleting} onCancel={() => !deleting && setDeleteTarget(null)} onConfirm={remove} />
  </div>;
}

import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { DoorOpen, Plus, CheckCircle2, XCircle } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { Modal, ModalFooter } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import SensitiveValue from '../../../components/ui/SensitiveValue';
import { toast } from '../../../utils/toast';
import { useListExitsQuery, useSubmitResignationMutation, useReviewExitMutation,
  useDecideExitMutation, useUpdateClearanceMutation, useCompleteExitMutation, useWithdrawExitMutation } from '../api/exits.api';

const inputClass = 'w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary';
const moneyFields = ['salaryUntilLastDay', 'bonuses', 'unpaidLeaveDeduction', 'loanDeduction', 'otherDeductions'];

export default function ExitManagementPage() {
  const user = useSelector((s) => s.auth.user);
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ resignationDate: '', proposedLastWorkingDay: '', reason: '', comments: '', attachmentUrl: '' });
  const { data, isLoading } = useListExitsQuery(status ? { status } : {});
  const records = data?.data || [];
  const [submit, submitting] = useSubmitResignationMutation();
  const [review] = useReviewExitMutation(); const [decide] = useDecideExitMutation();
  const [clearance] = useUpdateClearanceMutation(); const [complete] = useCompleteExitMutation(); const [withdraw] = useWithdrawExitMutation();
  const isHR = ['hr', 'super_admin'].includes(user?.role);

  const act = async (promise, message) => { try { await promise.unwrap(); toast.success(message); } catch (e) { toast.error(e?.data?.error?.message || 'Action failed.'); } };
  const send = async (e) => { e.preventDefault(); try { await submit(form).unwrap(); toast.success('Resignation submitted.'); setOpen(false); } catch (x) { toast.error(x?.data?.error?.message || 'Submission failed.'); } };

  return <div className="space-y-6 p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="flex items-center gap-2 text-2xl font-bold"><DoorOpen className="text-primary"/> Resignation & Exit</h1><p className="text-sm text-muted-foreground">Track resignation, approvals, clearance and final settlement.</p></div>
      <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4"/> Submit Resignation</Button>
    </div>
    <div className="rounded-2xl border border-border bg-card p-4">
      <select className={`${inputClass} max-w-xs`} value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">All statuses</option>{['pending_approval','hr_review','clearance','completed','rejected','withdrawn'].map(x => <option key={x} value={x}>{x.replaceAll('_',' ')}</option>)}
      </select>
    </div>
    <div className="space-y-4">
      {isLoading && <p>Loading exit requests...</p>}
      {!isLoading && !records.length && <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">No exit requests found.</div>}
      {records.map((r) => <ExitCard key={r._id} record={r} user={user} isHR={isHR} act={act} review={review} decide={decide} clearance={clearance} complete={complete} withdraw={withdraw}/>) }
    </div>
    <Modal isOpen={open} onClose={() => setOpen(false)} title="Submit Resignation">
      <form onSubmit={send}><div className="space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Resignation date<input required type="date" className={inputClass} value={form.resignationDate} onChange={e=>setForm({...form,resignationDate:e.target.value})}/></label><label className="text-sm">Proposed last working day<input required type="date" className={inputClass} value={form.proposedLastWorkingDay} onChange={e=>setForm({...form,proposedLastWorkingDay:e.target.value})}/></label></div>
        <label className="text-sm">Reason<textarea required className={`${inputClass} min-h-24`} value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})}/></label>
        <label className="text-sm">Comments (optional)<textarea className={`${inputClass} min-h-20`} value={form.comments} onChange={e=>setForm({...form,comments:e.target.value})}/></label>
        <label className="text-sm">Attachment URL (optional)<input className={inputClass} value={form.attachmentUrl} onChange={e=>setForm({...form,attachmentUrl:e.target.value})}/></label>
      </div><ModalFooter><Button type="button" variant="ghost" onClick={()=>setOpen(false)}>Cancel</Button><Button type="submit" loading={submitting.isLoading}>Submit</Button></ModalFooter></form>
    </Modal>
  </div>;
}

function ExitCard({ record:r, user, isHR, act, review, decide, clearance, complete, withdraw }) {
  const [settlement, setSettlement] = useState(Object.fromEntries(moneyFields.map(k=>[k,r.settlement?.[k]||0])));
  const mine = String(r.employeeId?._id || r.employeeId) === String(user?.id);
  const current = r.approvals?.[r.currentApprovalIndex];
  const myApproval = r.status === 'pending_approval' && String(current?.approverId?._id || current?.approverId) === String(user?.id);
  const net = useMemo(() => Number(settlement.salaryUntilLastDay)+Number(settlement.bonuses)-Number(settlement.unpaidLeaveDeduction)-Number(settlement.loanDeduction)-Number(settlement.otherDeductions), [settlement]);
  const patchChecklist = (key, completed) => act(clearance({ id:r._id, checklist:r.checklist.map(x=>({ key:x.key, completed:x.key===key?completed:x.completed, notes:x.notes })) }), 'Clearance updated.');
  return <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
    <div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-semibold">{r.employeeId?.fullName || 'Employee'}</h2><p className="text-sm text-muted-foreground">{r.employeeId?.department} · Submitted {new Date(r.resignationDate).toLocaleDateString()}</p></div><span className="h-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold capitalize text-primary">{r.status.replaceAll('_',' ')}</span></div>
    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><p><b>Proposed last day:</b><br/>{new Date(r.proposedLastWorkingDay).toLocaleDateString()}</p><p><b>Final last day:</b><br/>{r.finalLastWorkingDay ? new Date(r.finalLastWorkingDay).toLocaleDateString() : 'Pending'}</p><p><b>Reason:</b><br/>{r.reason}</p></div>
    {!!r.approvals?.length && <div className="mt-4 flex flex-wrap gap-2">{r.approvals.map((a,i)=><span key={i} className="rounded-lg border border-border px-2 py-1 text-xs capitalize">{a.role.replace('_',' ')}: {a.status}</span>)}</div>}
    <div className="mt-4 flex flex-wrap gap-2">
      {myApproval && <><Button size="sm" onClick={()=>act(review({id:r._id,action:'approve'}),'Review recorded.')}><CheckCircle2 className="h-4 w-4"/> Approve</Button><Button size="sm" variant="danger" onClick={()=>act(review({id:r._id,action:'reject'}),'Request rejected.')}><XCircle className="h-4 w-4"/> Reject</Button></>}
      {isHR && r.status==='hr_review' && <><Button size="sm" onClick={()=>act(decide({id:r._id,action:'accept',finalLastWorkingDay:r.proposedLastWorkingDay}),'Resignation accepted.')} >Accept</Button><Button size="sm" variant="danger" onClick={()=>act(decide({id:r._id,action:'reject'}),'Resignation rejected.')}>Reject</Button></>}
      {mine && ['pending_approval','hr_review'].includes(r.status) && <Button size="sm" variant="outline" onClick={()=>act(withdraw(r._id),'Resignation withdrawn.')}>Withdraw</Button>}
    </div>
    {isHR && r.status==='clearance' && <div className="mt-5 border-t border-border pt-5"><h3 className="font-semibold">Exit clearance</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{r.checklist.map(x=><label key={x.key} className="flex items-center gap-2 rounded-lg border border-border p-2 text-sm"><input type="checkbox" checked={x.completed} onChange={e=>patchChecklist(x.key,e.target.checked)}/>{x.label}</label>)}</div>
      <h3 className="mt-5 font-semibold">Final settlement</h3><div className="mt-2 grid gap-3 sm:grid-cols-3">{moneyFields.map(k=><Input key={k} label={k.replace(/([A-Z])/g,' $1')} type="number" sensitive value={settlement[k]} onChange={e=>setSettlement({...settlement,[k]:e.target.value})}/>)}</div><p className="mt-3 font-semibold">Net payable: <SensitiveValue value={net} formatter={(value) => `PKR ${Number(value).toLocaleString()}`} /></p><div className="mt-3 flex gap-2"><Button size="sm" variant="outline" onClick={()=>act(clearance({id:r._id,settlement}),'Settlement saved.')}>Save Settlement</Button><Button size="sm" onClick={()=>act(complete(r._id),'Employee exit completed.')}>Complete Exit</Button></div></div>}
  </section>;
}

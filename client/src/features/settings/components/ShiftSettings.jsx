import { useState } from 'react';
import { Clock3, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { toast } from '../../../utils/toast';
import { useCreateShiftMutation, useDeleteShiftMutation, useListShiftsQuery, useUpdateShiftMutation } from '../../shifts/api/shifts.api';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const EMPTY = { name: '', code: '', shiftType: 'fixed', startTime: '09:00', endTime: '17:00', graceMinutes: 15, lateHalfDayAfterMinutes: 150, requiredMinutes: 480, breakMinutes: 0, halfDayMinutes: 240, overtimeAfterMinutes: 480, workingDays: [1, 2, 3, 4, 5], isActive: true };

function duration(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let minutes = (eh * 60 + em) - (sh * 60 + sm);
  if (minutes <= 0) minutes += 1440;
  return `${Math.floor(minutes / 60)}h ${minutes % 60 ? `${minutes % 60}m` : ''}`.trim();
}

function durationMinutes(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let minutes = (eh * 60 + em) - (sh * 60 + sm);
  if (minutes <= 0) minutes += 1440;
  return minutes;
}

export default function ShiftSettings() {
  const { data, isLoading } = useListShiftsQuery();
  const [createShift, { isLoading: creating }] = useCreateShiftMutation();
  const [updateShift, { isLoading: updating }] = useUpdateShiftMutation();
  const [deleteShift] = useDeleteShiftMutation();
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const shifts = data?.data || [];
  const set = (field, value) => setForm(previous => ({ ...previous, [field]: value }));

  function applyPolicy(next) {
    if (next.shiftType === 'flexible') {
      const requiredMinutes = Number(next.requiredMinutes) === 360 ? 360 : 480;
      return {
        ...next,
        startTime: '00:00',
        endTime: requiredMinutes === 360 ? '06:00' : '08:00',
        breakMinutes: 0,
        graceMinutes: 0,
        lateHalfDayAfterMinutes: 0,
        requiredMinutes,
        halfDayMinutes: requiredMinutes / 2,
        overtimeAfterMinutes: requiredMinutes,
      };
    }
    const windowMinutes = durationMinutes(next.startTime, next.endTime);
    const requiredMinutes = Math.max(60, windowMinutes - Number(next.breakMinutes || 0));
    return {
      ...next,
      graceMinutes: windowMinutes > 420 ? 15 : 0,
      lateHalfDayAfterMinutes: windowMinutes > 420 ? 150 : 120,
      requiredMinutes,
      halfDayMinutes: Math.ceil(requiredMinutes / 2),
      overtimeAfterMinutes: requiredMinutes,
    };
  }

  function setShiftType(value) {
    setForm(previous => applyPolicy({
      ...previous,
      shiftType: value,
      ...(value === 'flexible' && { requiredMinutes: 480, startTime: '00:00', endTime: '08:00', breakMinutes: 0 }),
    }));
  }

  function setFlexibleDuration(value) {
    setForm(previous => applyPolicy({ ...previous, requiredMinutes: Number(value) }));
  }

  function setTime(field, value) {
    setForm(previous => applyPolicy({ ...previous, [field]: value }));
  }

  function setBreak(value) {
    setForm(previous => applyPolicy({ ...previous, breakMinutes: value }));
  }

  function toggleDay(day) {
    set('workingDays', form.workingDays.includes(day) ? form.workingDays.filter(item => item !== day) : [...form.workingDays, day].sort());
  }

  function edit(shift) {
    setEditingId(shift._id);
    setForm({ name: shift.name, code: shift.code, shiftType: shift.shiftType || 'fixed', startTime: shift.startTime, endTime: shift.endTime, graceMinutes: shift.graceMinutes, lateHalfDayAfterMinutes: shift.lateHalfDayAfterMinutes ?? 150, requiredMinutes: shift.requiredMinutes || 480, breakMinutes: shift.breakMinutes || 0, halfDayMinutes: shift.halfDayMinutes || Math.ceil((shift.requiredMinutes || 480) / 2), overtimeAfterMinutes: shift.overtimeAfterMinutes || shift.requiredMinutes || 480, workingDays: shift.workingDays, isActive: shift.isActive });
  }

  async function save(event) {
    event.preventDefault();
    try {
      const numeric = { ...form, graceMinutes: Number(form.graceMinutes), lateHalfDayAfterMinutes: Number(form.lateHalfDayAfterMinutes), requiredMinutes: Number(form.requiredMinutes), breakMinutes: Number(form.breakMinutes), halfDayMinutes: Number(form.halfDayMinutes), overtimeAfterMinutes: Number(form.overtimeAfterMinutes) };
      if (editingId) await updateShift({ id: editingId, ...numeric }).unwrap();
      else await createShift(numeric).unwrap();
      toast.success(editingId ? 'Shift updated.' : 'Shift created.');
      setEditingId(null); setForm(EMPTY);
    } catch (error) {
      toast.error(error?.data?.error?.message || 'Unable to save shift.');
    }
  }

  async function remove(shift) {
    if (!window.confirm(`Delete ${shift.name}? Assigned active employees must be moved first.`)) return;
    try { await deleteShift(shift._id).unwrap(); toast.success('Shift deleted.'); }
    catch (error) { toast.error(error?.data?.error?.message || 'Unable to delete shift.'); }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={save} className="glass-card space-y-5 p-6">
        <div className="border-b border-border pb-3">
          <h3 className="flex items-center gap-2 font-semibold"><Clock3 className="h-5 w-5 text-primary" /> {editingId ? 'Edit Shift' : 'Create Shift'}</h3>
          <p className="mt-1 text-sm text-muted-foreground">Fixed shifts follow their exact start time. Flexible shifts may complete their selected 6 or 8 hours from any start time.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Input label="Shift Name" required value={form.name} onChange={event => set('name', event.target.value)} placeholder="Night Shift" />
          <Input label="Code" required value={form.code} onChange={event => set('code', event.target.value.toUpperCase())} placeholder="NIGHT" />
          <label className="space-y-1.5 text-sm"><span className="font-medium">Shift Type</span><select value={form.shiftType} onChange={event => setShiftType(event.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3"><option value="fixed">Fixed timing</option><option value="flexible">Flexible timing</option></select></label>
          <label className="space-y-1.5 text-sm"><span className="font-medium">Flexible Duration</span><select value={form.requiredMinutes} disabled={form.shiftType !== 'flexible'} onChange={event => setFlexibleDuration(event.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 disabled:cursor-not-allowed disabled:opacity-60"><option value={480}>Flexible 8 Hours</option><option value={360}>Flexible 6 Hours</option></select></label>
          <Input label="Start" type="time" required disabled={form.shiftType === 'flexible'} value={form.startTime} onChange={event => setTime('startTime', event.target.value)} />
          <Input label="End" type="time" required disabled={form.shiftType === 'flexible'} value={form.endTime} onChange={event => setTime('endTime', event.target.value)} />
          <Input label="Grace (automatic)" type="number" readOnly value={form.graceMinutes} />
          <Input label="Late Half Day After" type="number" readOnly value={form.lateHalfDayAfterMinutes} />
          <Input label="Required Duty (automatic)" type="number" readOnly value={form.requiredMinutes} />
          <Input label="Break (minutes)" type="number" min="0" max="240" disabled={form.shiftType === 'flexible'} value={form.breakMinutes} onChange={event => setBreak(event.target.value)} />
          <Input label="Worked Half Day At" type="number" readOnly value={form.halfDayMinutes} />
          <Input label="Overtime After" type="number" readOnly value={form.overtimeAfterMinutes} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-2 text-sm text-muted-foreground">Working days:</span>
          {DAYS.map((day, index) => <button type="button" key={day} onClick={() => toggleDay(index)} className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${form.workingDays.includes(index) ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground'}`}>{day}</button>)}
          <span className="ml-auto rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">{form.shiftType === 'flexible' ? `Any start time · ${form.requiredMinutes / 60}h required` : `Duration: ${duration(form.startTime, form.endTime)}`}</span>
        </div>
        <div className="flex justify-end gap-2">
          {editingId && <Button type="button" variant="ghost" onClick={() => { setEditingId(null); setForm(EMPTY); }}>Cancel</Button>}
          <Button type="submit" disabled={creating || updating || !form.workingDays.length} className="gap-1.5"><Plus className="h-4 w-4" /> {editingId ? 'Save Shift' : 'Create Shift'}</Button>
        </div>
      </form>

      <div className="glass-card overflow-hidden">
        {isLoading ? <p className="p-8 text-center text-sm text-muted-foreground">Loading shifts...</p> : shifts.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No custom shifts yet. Employees use the General Shift until one is assigned.</p> : shifts.map(shift => (
          <div key={shift._id} className="flex flex-col gap-3 border-b border-border p-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2"><p className="font-medium">{shift.name}</p><span className="rounded bg-muted px-2 py-0.5 text-xs">{shift.code}</span><span className={`rounded-full px-2 py-0.5 text-xs ${shift.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{shift.isActive ? 'Active' : 'Inactive'}</span></div>
              <p className="mt-1 text-sm text-muted-foreground">{shift.shiftType === 'flexible' ? 'Flexible · any start time' : `${shift.startTime} – ${shift.endTime} · Window ${duration(shift.startTime, shift.endTime)}`} · Required {shift.requiredMinutes || 480}m · Worked half day {shift.halfDayMinutes || 240}m · Grace {shift.graceMinutes}m{shift.shiftType !== 'flexible' ? ` · Late half day after ${shift.lateHalfDayAfterMinutes || 150}m` : ''} · {shift.workingDays.map(day => DAYS[day]).join(', ')}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => edit(shift)} className="gap-1"><Pencil className="h-3.5 w-3.5" /> Edit</Button>
              <Button size="sm" variant="outline" onClick={() => updateShift({ id: shift._id, isActive: !shift.isActive })} className="gap-1"><Power className="h-3.5 w-3.5" /> {shift.isActive ? 'Deactivate' : 'Activate'}</Button>
              <Button size="sm" variant="outline" onClick={() => remove(shift)} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { CalendarCheck, Check, Mail, MapPin, Plus, RefreshCw, X } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { Input, Select, Textarea } from '../../../components/ui/Input';
import { toast } from '../../../utils/toast';
import { useAddManualCompanyOffMutation, useDecideHolidayMutation, useListHolidaysQuery, useSyncCanadaHolidaysMutation } from '../api/holidays.api';
import { useGetEmployeeDepartmentsQuery } from '../../employees/api/employees.api';
import { useListShiftsQuery } from '../../shifts/api/shifts.api';

const STATUS = {
  pending_hr: { label: 'HR decision required', className: 'bg-amber-100 text-amber-700' },
  confirmed: { label: 'Schedule confirmed', className: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Working day', className: 'bg-slate-100 text-slate-600' },
};

export default function HolidaySettings({ province = 'ON', onProvinceChange }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [manual, setManual] = useState({ title: '', date: '', description: '', eventType: 'full_day', effectiveTime: '', requiredMinutesOverride: '', affectedScope: 'all', affectedDepartment: '', affectedShiftId: '', isPaid: true });
  const synced = useRef(new Set());
  const { data, isLoading, isFetching } = useListHolidaysQuery({ year });
  const [syncCalendar, { isLoading: isSyncing }] = useSyncCanadaHolidaysMutation();
  const [addManualOff, { isLoading: isAddingManual }] = useAddManualCompanyOffMutation();
  const [decide, { isLoading: isDeciding }] = useDecideHolidayMutation();
  const holidays = data?.data || [];
  const { data: departmentsData } = useGetEmployeeDepartmentsQuery();
  const { data: shiftsData } = useListShiftsQuery({ active: true });
  const departments = departmentsData?.data || [];
  const shifts = shiftsData?.data || [];

  async function sync(silent = false) {
    try {
      const response = await syncCalendar(year).unwrap();
      if (!silent) toast.success(`Canada calendar synced: ${response.data.created} new holiday(s)`);
    } catch (error) {
      toast.error(error?.data?.error?.message || 'Unable to sync Canada holidays.');
    }
  }

  useEffect(() => {
    if (synced.current.has(year)) return;
    synced.current.add(year);
    sync(true);
    // Sync once per selected year; mutation identity is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  async function makeDecision(holiday, isCompanyOff) {
    const verb = isCompanyOff ? 'confirm this schedule and email affected employees' : 'mark this as a normal working day';
    if (!window.confirm(`Do you want to ${verb}?`)) return;
    try {
      const response = await decide({ id: holiday._id, isCompanyOff }).unwrap();
      const result = response.data;
      if (isCompanyOff) {
        toast.success(`Holiday confirmed. ${result.emailed} email(s) sent${result.emailFailed ? `, ${result.emailFailed} failed` : ''}.`);
      } else {
        toast.success('Holiday marked as a working day.');
      }
    } catch (error) {
      toast.error(error?.data?.error?.message || 'Unable to save the HR decision.');
    }
  }

  async function addManualHoliday(event) {
    event.preventDefault();
    try {
      const payload = { ...manual };
      if (payload.requiredMinutesOverride === '') delete payload.requiredMinutesOverride;
      if (payload.affectedScope !== 'department') delete payload.affectedDepartment;
      if (payload.affectedScope !== 'shift') delete payload.affectedShiftId;
      if (!['early_closure', 'late_opening'].includes(payload.eventType)) delete payload.effectiveTime;
      const response = await addManualOff(payload).unwrap();
      const result = response.data;
      setYear(new Date(manual.date).getUTCFullYear());
      setManual({ title: '', date: '', description: '', eventType: 'full_day', effectiveTime: '', requiredMinutesOverride: '', affectedScope: 'all', affectedDepartment: '', affectedShiftId: '', isPaid: true });
      toast.success(`Schedule updated. ${result.emailed} email(s) sent and ${result.attendanceAdjusted || 0} attendance record(s) adjusted.`);
    } catch (error) {
      toast.error(error?.data?.error?.message || 'Unable to add the manual company off.');
    }
  }

  return (
    <div className="glass-card p-6 space-y-5">
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 font-semibold"><CalendarCheck className="h-5 w-5 text-primary" /> Canada Holiday Calendar</h3>
          <p className="mt-1 text-sm text-muted-foreground">Each date requires an HR decision before it becomes a company holiday.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={year} onChange={event => setYear(Number(event.target.value))}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm">
            {[year - 1, year, year + 1].filter((item, index, values) => values.indexOf(item) === index).map(item => <option key={item}>{item}</option>)}
          </select>
          <Button size="sm" variant="outline" onClick={() => sync(false)} disabled={isSyncing} className="gap-1.5">
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} /> Sync Canada
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm sm:flex-row sm:items-center">
        <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Canada holiday region only:</span>
        <select value={province} onChange={event => onProvinceChange?.(event.target.value)}
          className="h-9 rounded-lg border border-border bg-background px-3 text-sm">
          <option value="AB">Alberta</option><option value="BC">British Columbia</option>
          <option value="MB">Manitoba</option><option value="NB">New Brunswick</option>
          <option value="NL">Newfoundland and Labrador</option><option value="NS">Nova Scotia</option>
          <option value="NT">Northwest Territories</option><option value="NU">Nunavut</option>
          <option value="ON">Ontario</option><option value="PE">Prince Edward Island</option>
          <option value="QC">Quebec</option><option value="SK">Saskatchewan</option><option value="YT">Yukon</option>
        </select>
        <span className="text-xs text-muted-foreground">Save Changes before syncing. Attendance, shifts and payroll remain Pakistan-based.</span>
      </div>

      <form onSubmit={addManualHoliday} className="space-y-4 rounded-xl border border-border bg-card p-4">
        <div>
          <h4 className="font-semibold">Emergency Office Schedule</h4>
          <p className="mt-1 text-sm text-muted-foreground">Create a full off, half day, early closure, or late opening. Saving immediately adjusts attendance and notifies affected employees.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Holiday / Off Title" required value={manual.title}
            onChange={event => setManual(previous => ({ ...previous, title: event.target.value }))} placeholder="Eid-ul-Fitr Holiday" />
          <Input label="Off Date" type="date" required value={manual.date}
            onChange={event => setManual(previous => ({ ...previous, date: event.target.value }))} />
          <Select label="Schedule Type" value={manual.eventType} onChange={event => setManual(previous => ({ ...previous, eventType: event.target.value }))}>
            <option value="full_day">Full-day closure</option><option value="half_day">Half-day schedule</option>
            <option value="early_closure">Early closure</option><option value="late_opening">Late opening</option>
          </Select>
          {['early_closure', 'late_opening'].includes(manual.eventType) && (
            <Input label={manual.eventType === 'early_closure' ? 'Closing Time' : 'Opening Time'} type="time" required value={manual.effectiveTime}
              onChange={event => setManual(previous => ({ ...previous, effectiveTime: event.target.value }))} />
          )}
          <Input label="Required Minutes Override (optional)" type="number" min="0" max="1440" value={manual.requiredMinutesOverride}
            onChange={event => setManual(previous => ({ ...previous, requiredMinutesOverride: event.target.value === '' ? '' : Number(event.target.value) }))} />
          <Select label="Affected Employees" value={manual.affectedScope} onChange={event => setManual(previous => ({ ...previous, affectedScope: event.target.value, affectedDepartment: '', affectedShiftId: '' }))}>
            <option value="all">All employees</option><option value="department">One department</option><option value="shift">One shift</option>
          </Select>
          {manual.affectedScope === 'department' && (
            <Select label="Department" required value={manual.affectedDepartment} onChange={event => setManual(previous => ({ ...previous, affectedDepartment: event.target.value }))}>
              <option value="">Select department</option>{departments.map(department => <option key={department} value={department}>{department}</option>)}
            </Select>
          )}
          {manual.affectedScope === 'shift' && (
            <Select label="Shift" required value={manual.affectedShiftId} onChange={event => setManual(previous => ({ ...previous, affectedShiftId: event.target.value }))}>
              <option value="">Select shift</option>{shifts.map(shift => <option key={shift._id} value={shift._id}>{shift.name} ({shift.startTime}–{shift.endTime})</option>)}
            </Select>
          )}
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={manual.isPaid} onChange={event => setManual(previous => ({ ...previous, isPaid: event.target.checked }))} /> Paid schedule adjustment
          </label>
          <div className="sm:col-span-2">
            <Textarea label="Message / Description" value={manual.description}
              onChange={event => setManual(previous => ({ ...previous, description: event.target.value }))}
              placeholder="Office will remain closed for Eid..." />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={isAddingManual} className="gap-1.5">
            <Plus className="h-4 w-4" /> {isAddingManual ? 'Applying...' : 'Apply Schedule & Notify'}
          </Button>
        </div>
      </form>

      {(isLoading || isFetching) && holidays.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading Canadian holidays...</p>
      ) : holidays.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No holidays found for {year}. Use Sync Canada.</p>
      ) : (
        <div className="space-y-3">
          {holidays.map(holiday => {
            const status = STATUS[holiday.status] || STATUS.pending_hr;
            return (
              <div key={holiday._id} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{holiday.title}</p>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>{status.label}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {new Date(holiday.date).toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}
                    {' · '}{holiday.jurisdiction === 'federal' ? 'Federal' : holiday.jurisdiction === 'provincial' ? `${province} calendar` : 'Company custom'}
                    {' · '}{(holiday.eventType || 'full_day').replaceAll('_', ' ')}{holiday.effectiveTime ? ` at ${holiday.effectiveTime}` : ''}
                  </p>
                  {holiday.status === 'confirmed' && holiday.employeeEmailSentAt && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600"><Mail className="h-3 w-3" /> Employee email broadcast completed</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant={holiday.status === 'confirmed' ? 'primary' : 'outline'}
                    disabled={isDeciding || (holiday.status === 'confirmed' && holiday.employeeEmailSentAt)} onClick={() => makeDecision(holiday, true)} className="gap-1">
                    <Check className="h-4 w-4" /> {holiday.status === 'confirmed' ? 'Retry Emails' : 'Company Off'}
                  </Button>
                  <Button size="sm" variant="outline" disabled={isDeciding}
                    onClick={() => makeDecision(holiday, false)} className="gap-1 text-destructive hover:text-destructive">
                    <X className="h-4 w-4" /> Working Day
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

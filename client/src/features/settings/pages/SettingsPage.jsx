/**
 * features/settings/pages/SettingsPage.jsx
 * Company settings management — office timings, grace period, weekends,
 * SMTP, public holidays link, and company profile.
 */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Building2, Clock, Mail, ShieldCheck, Save, CalendarDays, BadgeDollarSign } from 'lucide-react';
import { toast } from '../../../utils/toast';
import { Input, Select } from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import { useGetCompanySettingsQuery, useUpdateCompanySettingsMutation } from '../api/settings.api';
import HolidaySettings from '../components/HolidaySettings';
import ShiftSettings from '../components/ShiftSettings';

const ALL_LEAVE_TYPES = ['paid', 'casual', 'sick', 'annual', 'maternity', 'paternity', 'unpaid'];

const TABS = [
  { id: 'company',  label: 'Company',  icon: Building2 },
  { id: 'timing',   label: 'Timing',   icon: Clock },
  { id: 'shifts',   label: 'Shifts',   icon: Clock },
  { id: 'leave',    label: 'Leave Policy', icon: CalendarDays },
  { id: 'payroll',  label: 'Payroll Rules', icon: BadgeDollarSign },
  { id: 'holidays', label: 'Canada Holidays', icon: CalendarDays },
  { id: 'email',    label: 'Email',    icon: Mail },
  { id: 'security', label: 'Security', icon: ShieldCheck },
];

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all w-full
        ${active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}

function SectionCard({ title, children }) {
  return (
    <div className="glass-card p-6 space-y-5">
      <h3 className="font-semibold text-base border-b border-border pb-3">{title}</h3>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState(() => new URLSearchParams(window.location.search).get('tab') || 'company');
  const [saved, setSaved] = useState(false);
  const { data: settingsData, isLoading } = useGetCompanySettingsQuery();
  const [updateCompanySettings, { isLoading: isSaving }] = useUpdateCompanySettingsMutation();

  const [companyForm, setCompanyForm] = useState({
    name: 'My Company', website: '', industry: '', address: '', timezone: 'Asia/Karachi',
  });
  const [holidayForm, setHolidayForm] = useState({ country: 'CA', province: 'ON' });
  const [timingForm, setTimingForm] = useState({
    officeStart: '09:00', officeEnd: '17:00', graceMinutes: '15',
    weekendDays: ['Saturday', 'Sunday'],
  });
  const [emailForm, setEmailForm] = useState({
    smtpHost: '', smtpPort: '587', smtpUser: '', smtpPassword: '', smtpFrom: '',
    smtpSecure: false, smtpPasswordConfigured: false, smtpSource: 'none',
    enableNotifications: false, enableInApp: true, enableWhatsapp: false,
  });
  const [leaveForm, setLeaveForm] = useState({
    enabledTypes: ['paid', 'casual', 'sick', 'annual'],
    entitlements: { paid: 12, casual: 10, sick: 8, annual: 14 },
    carryForwardTypes: ['paid', 'casual', 'sick', 'annual'],
    maxCarryForward: { paid: 365, casual: 365, sick: 365, annual: 365 },
    delayedApplicationReminderDays: 3,
  });
  const [securityForm, setSecurityForm] = useState({
    sessionTimeout: '60', maxLoginAttempts: '5', passwordExpiry: '90', mfaEnabled: false,
  });
  const [payrollForm, setPayrollForm] = useState({
    lateDeductionMode: 'three_lates_half_day', latesPerHalfDay: 3, perMinuteRate: 0,
  });

  useEffect(() => {
    const settings = settingsData?.data;
    if (!settings) return;
    setCompanyForm({ timezone: 'Asia/Karachi', ...settings.company });
    setHolidayForm({ country: 'CA', province: 'ON', ...settings.holidayPolicy });
    setTimingForm({
      ...settings.timing,
      weekendDays: settings.timing.weekendDays.map((day) => DAYS[day === 0 ? 6 : day - 1]),
    });
    setLeaveForm((previous) => ({
      ...previous,
      ...settings.leavePolicy,
      enabledTypes: settings.leavePolicy?.enabledTypes?.length
        ? settings.leavePolicy.enabledTypes
        : ['paid', 'casual', 'sick', 'annual'],
      entitlements: { ...previous.entitlements, ...settings.leavePolicy?.entitlements },
      maxCarryForward: { ...previous.maxCarryForward, ...settings.leavePolicy?.maxCarryForward },
    }));
    setEmailForm({
      smtpHost: settings.smtp?.host || '',
      smtpPort: String(settings.smtp?.port || 587),
      smtpUser: settings.smtp?.user || '',
      smtpPassword: '',
      smtpFrom: settings.smtp?.from || '',
      smtpSecure: Boolean(settings.smtp?.secure),
      smtpPasswordConfigured: Boolean(settings.smtp?.passwordConfigured),
      smtpSource: settings.smtp?.source || 'none',
      enableNotifications: Boolean(settings.notifications?.emailEnabled),
      enableInApp: settings.notifications?.inAppEnabled !== false,
      enableWhatsapp: Boolean(settings.notifications?.whatsappEnabled),
    });
    setSecurityForm({
      sessionTimeout: String(settings.security?.sessionTimeoutMinutes || 60),
      maxLoginAttempts: String(settings.security?.maxLoginAttempts || 5),
      passwordExpiry: String(settings.security?.passwordExpiryDays ?? 90),
      mfaEnabled: Boolean(settings.security?.mfaEnabled),
    });
    setPayrollForm({
      lateDeductionMode: settings.payrollPolicy?.lateDeductionMode || 'three_lates_half_day',
      latesPerHalfDay: Number(settings.payrollPolicy?.latesPerHalfDay || 3),
      perMinuteRate: Number(settings.payrollPolicy?.perMinuteRate || 0),
    });
  }, [settingsData]);

  async function handleSave() {
    const dayIndexes = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
    try {
      await updateCompanySettings({
        company: companyForm,
        holidayPolicy: holidayForm,
        timing: {
          ...timingForm,
          graceMinutes: Number(timingForm.graceMinutes),
          weekendDays: timingForm.weekendDays.map((day) => dayIndexes[day]),
        },
        leavePolicy: {
          ...leaveForm,
          entitlements: Object.fromEntries(Object.entries(leaveForm.entitlements).map(([key, value]) => [key, Number(value)])),
          maxCarryForward: Object.fromEntries(Object.entries(leaveForm.maxCarryForward).map(([key, value]) => [key, Number(value)])),
          delayedApplicationReminderDays: Number(leaveForm.delayedApplicationReminderDays),
        },
        payrollPolicy: {
          lateDeductionMode: payrollForm.lateDeductionMode,
          latesPerHalfDay: Number(payrollForm.latesPerHalfDay),
          perMinuteRate: Number(payrollForm.perMinuteRate),
        },
        notifications: {
          inAppEnabled: emailForm.enableInApp,
          emailEnabled: emailForm.enableNotifications,
          whatsappEnabled: emailForm.enableWhatsapp,
        },
        smtp: {
          host: emailForm.smtpHost,
          port: Number(emailForm.smtpPort),
          secure: emailForm.smtpSecure,
          user: emailForm.smtpUser,
          password: emailForm.smtpPassword,
          from: emailForm.smtpFrom,
        },
        security: {
          sessionTimeoutMinutes: Number(securityForm.sessionTimeout),
          maxLoginAttempts: Number(securityForm.maxLoginAttempts),
          passwordExpiryDays: Number(securityForm.passwordExpiry),
          mfaEnabled: securityForm.mfaEnabled,
        },
      }).unwrap();
      setSaved(true);
      toast.success('Settings saved successfully');
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      toast.error(error?.data?.error?.message || 'Unable to save settings.');
    }
  }

  const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

  function toggleWeekend(day) {
    setTimingForm(p => ({
      ...p,
      weekendDays: p.weekendDays.includes(day)
        ? p.weekendDays.filter(d => d !== day)
        : [...p.weekendDays, day],
    }));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="h-6 w-6" /> Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Configure company settings and system preferences</p>
        </div>
        <Button variant="primary" size="sm" className="gap-1.5" onClick={handleSave} disabled={isSaving || isLoading}>
          <Save className="h-4 w-4" /> {isSaving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
        </Button>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        {/* Sidebar tabs */}
        <div className="space-y-1">
          {TABS.map(tab => (
            <TabButton key={tab.id} active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)} icon={tab.icon} label={tab.label} />
          ))}
        </div>

        {/* Content */}
        <div className="space-y-5">
          {activeTab === 'company' && (
            <motion.div key="company" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}>
              <SectionCard title="Company Information">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="col-span-2">
                    <Input label="Company Name" value={companyForm.name}
                      onChange={e => setCompanyForm(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <Input label="Website" placeholder="https://company.com" value={companyForm.website}
                    onChange={e => setCompanyForm(p => ({ ...p, website: e.target.value }))} />
                  <Input label="Industry" placeholder="Software, Healthcare..." value={companyForm.industry}
                    onChange={e => setCompanyForm(p => ({ ...p, industry: e.target.value }))} />
                  <div className="col-span-2">
                    <Input label="Office Address" value={companyForm.address}
                      onChange={e => setCompanyForm(p => ({ ...p, address: e.target.value }))}
                      placeholder="Full office address" />
                  </div>
                  <Select label="Timezone" value={companyForm.timezone}
                    onChange={e => setCompanyForm(p => ({ ...p, timezone: e.target.value }))}>
                    <option value="Asia/Karachi">Pakistan (Asia/Karachi)</option>
                    <option value="Asia/Dubai">Dubai (Asia/Dubai)</option>
                    <option value="UTC">UTC</option>
                  </Select>
                </div>
              </SectionCard>
            </motion.div>
          )}

          {activeTab === 'timing' && (
            <motion.div key="timing" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
              className="space-y-5">
              <SectionCard title="Office Hours">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Input label="Office Start Time" type="time" value={timingForm.officeStart}
                    onChange={e => setTimingForm(p => ({ ...p, officeStart: e.target.value }))} />
                  <Input label="Office End Time" type="time" value={timingForm.officeEnd}
                    onChange={e => setTimingForm(p => ({ ...p, officeEnd: e.target.value }))} />
                  <Input label="Grace Period (minutes)" type="number" value={timingForm.graceMinutes}
                    onChange={e => setTimingForm(p => ({ ...p, graceMinutes: e.target.value }))} />
                </div>
                <div className="rounded-lg bg-primary/5 border border-primary/10 px-3 py-2 text-xs text-muted-foreground">
                  Employees arriving after <span className="font-medium text-foreground">
                    {timingForm.officeStart}
                  </span> + {timingForm.graceMinutes} minutes grace period will be marked as <span className="text-amber-500 font-medium">Late</span>.
                </div>
              </SectionCard>

              <SectionCard title="Weekend Configuration">
                <p className="text-sm text-muted-foreground">Select which days are considered weekends (non-working days):</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {DAYS.map(day => (
                    <button key={day} type="button" onClick={() => toggleWeekend(day)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all
                        ${timingForm.weekendDays.includes(day)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'}`}>
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Selected: <span className="font-medium text-foreground">{timingForm.weekendDays.join(', ') || 'None'}</span>
                </p>
              </SectionCard>
            </motion.div>
          )}

          {activeTab === 'shifts' && (
            <motion.div key="shifts" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}>
              <ShiftSettings />
            </motion.div>
          )}

          {activeTab === 'leave' && (
            <motion.div key="leave" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
              className="space-y-5">
              <SectionCard title="Available Leave Types">
                <p className="text-sm text-muted-foreground">
                  Select the leave types employees can apply for. At least one type must remain enabled.
                </p>
                <div className="flex flex-wrap gap-2">
                  {ALL_LEAVE_TYPES.map((type) => {
                    const selected = leaveForm.enabledTypes.includes(type);
                    return (
                      <button key={type} type="button" onClick={() => setLeaveForm((previous) => {
                        if (selected && previous.enabledTypes.length === 1) {
                          toast.error('At least one leave type must remain enabled.');
                          return previous;
                        }
                        const enabledTypes = selected
                          ? previous.enabledTypes.filter((item) => item !== type)
                          : [...previous.enabledTypes, type];
                        return {
                          ...previous,
                          enabledTypes,
                          carryForwardTypes: previous.carryForwardTypes.filter((item) => enabledTypes.includes(item)),
                        };
                      })} className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                        selected ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'
                      }`}>
                        {type[0].toUpperCase()}{type.slice(1)}
                      </button>
                    );
                  })}
                </div>
              </SectionCard>

              <SectionCard title="Annual Leave Entitlements">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(leaveForm.entitlements).map(([type, value]) => (
                    <Input key={type} label={`${type[0].toUpperCase()}${type.slice(1)} Days`} type="number"
                      disabled={!leaveForm.enabledTypes.includes(type)}
                      value={value} onChange={(event) => setLeaveForm((previous) => ({
                        ...previous,
                        entitlements: { ...previous.entitlements, [type]: event.target.value },
                      }))} />
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Carry Forward Policy">
                <p className="text-sm text-muted-foreground">
                  Select leave types whose unused balance carries forward for everyone on January 1.
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(leaveForm.entitlements).filter((type) => leaveForm.enabledTypes.includes(type)).map((type) => {
                    const selected = leaveForm.carryForwardTypes.includes(type);
                    return (
                      <button key={type} type="button" onClick={() => setLeaveForm((previous) => ({
                        ...previous,
                        carryForwardTypes: selected
                          ? previous.carryForwardTypes.filter((item) => item !== type)
                          : [...previous.carryForwardTypes, type],
                      }))} className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                        selected ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'
                      }`}>
                        {type[0].toUpperCase()}{type.slice(1)}
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(leaveForm.maxCarryForward).filter(([type]) => leaveForm.enabledTypes.includes(type)).map(([type, value]) => (
                    <Input key={type} label={`Max ${type}`} type="number" value={value}
                      onChange={(event) => setLeaveForm((previous) => ({
                        ...previous,
                        maxCarryForward: { ...previous.maxCarryForward, [type]: event.target.value },
                      }))} />
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Delayed Application Reminder">
                <Input label="Reminder after absence (days)" type="number"
                  value={leaveForm.delayedApplicationReminderDays}
                  onChange={(event) => setLeaveForm((previous) => ({
                    ...previous,
                    delayedApplicationReminderDays: event.target.value,
                  }))} />
                <p className="text-xs text-muted-foreground">
                  Employees receive a notification when no leave application overlaps an absence by this deadline.
                </p>
              </SectionCard>
            </motion.div>
          )}

          {activeTab === 'email' && (
            <motion.div key="email" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}>
              <SectionCard title="SMTP Email Configuration">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="SMTP Host" placeholder="smtp.gmail.com" value={emailForm.smtpHost}
                    onChange={e => setEmailForm(p => ({ ...p, smtpHost: e.target.value }))} />
                  <Input label="SMTP Port" type="number" value={emailForm.smtpPort}
                    onChange={e => setEmailForm(p => ({ ...p, smtpPort: e.target.value }))} />
                  <Input label="SMTP Username" placeholder="noreply@company.com" value={emailForm.smtpUser}
                    onChange={e => setEmailForm(p => ({ ...p, smtpUser: e.target.value }))} />
                  <Input label="From Address" placeholder="HR System <hr@company.com>" value={emailForm.smtpFrom}
                    onChange={e => setEmailForm(p => ({ ...p, smtpFrom: e.target.value }))} />
                  <Input label="SMTP Password" type="password"
                    placeholder={emailForm.smtpPasswordConfigured ? 'Configured securely — leave blank to keep it' : 'Enter SMTP password'}
                    value={emailForm.smtpPassword}
                    onChange={e => setEmailForm(p => ({ ...p, smtpPassword: e.target.value }))} />
                </div>
                <div className={`rounded-lg border px-3 py-2 text-sm ${emailForm.smtpPasswordConfigured
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>
                  {emailForm.smtpPasswordConfigured
                    ? `SMTP password is securely configured${emailForm.smtpSource === 'environment' ? ' from the server environment' : ' for this company'}. It is never sent to the browser.`
                    : 'SMTP password is not configured. Add SMTP_PASS to the server environment or enter a company SMTP password here.'}
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className={`relative h-5 w-9 rounded-full transition-colors ${emailForm.enableNotifications ? 'bg-primary' : 'bg-muted'}`}
                    onClick={() => setEmailForm(p => ({ ...p, enableNotifications: !p.enableNotifications }))}>
                    <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${emailForm.enableNotifications ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-sm">Enable email notifications</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className={`relative h-5 w-9 rounded-full transition-colors ${emailForm.enableWhatsapp ? 'bg-primary' : 'bg-muted'}`}
                    onClick={() => setEmailForm(p => ({ ...p, enableWhatsapp: !p.enableWhatsapp }))}>
                    <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${emailForm.enableWhatsapp ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-sm">Enable WhatsApp notifications</span>
                </label>
              </SectionCard>
            </motion.div>
          )}

          {activeTab === 'payroll' && (
            <motion.div key="payroll" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}>
              <SectionCard title="Late Salary Deduction Rule">
                <Select label="Deduction Method" value={payrollForm.lateDeductionMode}
                  onChange={event => setPayrollForm(previous => ({ ...previous, lateDeductionMode: event.target.value }))}>
                  <option value="three_lates_half_day">Late count converts to half day</option>
                  <option value="per_minute">Per-minute deduction</option>
                </Select>
                {payrollForm.lateDeductionMode === 'three_lates_half_day' ? (
                  <Input label="Lates Per Half Day" type="number" min="1" max="30" value={payrollForm.latesPerHalfDay}
                    onChange={event => setPayrollForm(previous => ({ ...previous, latesPerHalfDay: event.target.value }))} />
                ) : (
                  <Input label="Deduction Per Late Minute (PKR)" type="number" min="0" value={payrollForm.perMinuteRate}
                    onChange={event => setPayrollForm(previous => ({ ...previous, perMinuteRate: event.target.value }))} />
                )}
                <p className="text-sm text-muted-foreground">Default rule: 3 lates = one half-day salary deduction. Overtime is disabled.</p>
              </SectionCard>
            </motion.div>
          )}

          {activeTab === 'holidays' && (
            <motion.div key="holidays" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}>
              <HolidaySettings province={holidayForm.province}
                onProvinceChange={(province) => setHolidayForm(previous => ({ ...previous, province }))} />
            </motion.div>
          )}

          {activeTab === 'security' && (
            <motion.div key="security" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}>
              <SectionCard title="Security Settings">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="Session Timeout (minutes)" type="number" value={securityForm.sessionTimeout}
                    onChange={e => setSecurityForm(p => ({ ...p, sessionTimeout: e.target.value }))} />
                  <Input label="Max Login Attempts" type="number" value={securityForm.maxLoginAttempts}
                    onChange={e => setSecurityForm(p => ({ ...p, maxLoginAttempts: e.target.value }))} />
                  <Input label="Password Expiry (days)" type="number" value={securityForm.passwordExpiry}
                    onChange={e => setSecurityForm(p => ({ ...p, passwordExpiry: e.target.value }))} />
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className={`relative h-5 w-9 rounded-full transition-colors ${securityForm.mfaEnabled ? 'bg-primary' : 'bg-muted'}`}
                    onClick={() => setSecurityForm(p => ({ ...p, mfaEnabled: !p.mfaEnabled }))}>
                    <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${securityForm.mfaEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-sm">Enable Two-Factor Authentication (2FA)</span>
                </label>
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
                  Security settings apply to all users across the company. Changes take effect on next login.
                </div>
              </SectionCard>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

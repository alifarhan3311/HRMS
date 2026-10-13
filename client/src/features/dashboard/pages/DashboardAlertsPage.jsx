import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import { useGetDashboardSummaryQuery } from '../api/dashboard.api';
import DashboardDetailsLink from '../components/DashboardDetailsLink';

const ALERTS = {
  birthdays: { key: 'birthdayAlerts', title: 'Upcoming Birthdays', description: 'Employee birthdays in the next 30 days.', dateKey: 'nextBirthday', dateLabel: 'Birthday' },
  probation: { key: 'probationAlerts', title: 'Probation Ending Alerts', description: 'Probations ending in the next 30 days, including those that ended in the last 30 days.', dateKey: 'probationEndDate', dateLabel: 'Probation ends' },
  joinings: { key: 'newJoinings', title: 'Recent Joinings', description: 'Latest employees who joined in the last 30 days.', dateKey: 'joiningDate', dateLabel: 'Joining date' },
};

export default function DashboardAlertsPage() {
  const { kind } = useParams();
  const config = Object.hasOwn(ALERTS, kind) ? ALERTS[kind] : null;
  const [search, setSearch] = useState('');
  const { data, isLoading, isError, refetch } = useGetDashboardSummaryQuery(undefined, {
    skip: !config,
    refetchOnMountOrArgChange: true,
  });
  if (!config) return <Navigate to="/dashboard" replace />;
  const summary = data?.data?.hrOverview || data?.data;
  const records = summary?.[config.key] || [];
  const visible = records.filter((employee) => [employee.fullName, employee.employeeCode, employee.department, employee.designation]
    .some((value) => String(value || '').toLowerCase().includes(search.trim().toLowerCase())));

  return (
    <div className="space-y-5">
      <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-primary hover:underline"><ArrowLeft className="h-4 w-4" />Back to dashboard</Link>
      <div><h1 className="text-2xl font-bold">{config.title}</h1><p className="mt-1 text-sm text-muted-foreground">{config.description}</p></div>
      <div className="glass-card p-5">
        <label className="mb-5 flex max-w-lg items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input aria-label="Search alert employees" className="w-full bg-transparent text-sm outline-none" placeholder="Search name, employee ID or department..." value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        {isLoading ? <p role="status">Loading details...</p> : isError ? (
          <div role="alert"><p className="text-destructive">Unable to load alert details.</p><button className="mt-2 text-primary underline" onClick={refetch}>Try again</button></div>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted-foreground">{visible.length} of {records.length} employees</p>
            <div className="space-y-3">
              {visible.map((employee) => (
                <div key={employee._id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border p-4">
                  <div className="min-w-0">
                    <Link to={`/employees?employeeId=${encodeURIComponent(employee._id)}`} className="font-semibold hover:text-primary hover:underline">{employee.fullName}</Link>
                    <p className="text-sm text-muted-foreground">{[employee.employeeCode, employee.department, employee.designation].filter(Boolean).join(' · ')}</p>
                    <p className="mt-2 text-sm">{config.dateLabel}: {employee[config.dateKey] ? new Date(employee[config.dateKey]).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not set'}</p>
                    {typeof employee.daysUntil === 'number' && <p className={`text-xs ${employee.daysUntil < 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                      {employee.daysUntil < 0 ? `Ended ${Math.abs(employee.daysUntil)} days ago` : employee.daysUntil === 0 ? 'Today' : `In ${employee.daysUntil} days`}
                    </p>}
                  </div>
                  <DashboardDetailsLink to={`/employees?employeeId=${encodeURIComponent(employee._id)}`} label="Employee Details" />
                </div>
              ))}
              {!visible.length && <p className="py-8 text-center text-muted-foreground">{search ? 'No employees match your search.' : 'No alerts for this period.'}</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

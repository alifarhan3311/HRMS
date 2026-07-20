/**
 * features/dashboard/components/EmployeeDashboard.jsx
 */
import { motion } from 'framer-motion';
import {
  Clock,
  Wallet,
  CalendarDays,
  AlertTriangle,
  Gift,
  Briefcase,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import StatCard from '../../../components/ui/StatCard';

const LEAVE_COLORS = ['#C9971F', '#E8B04B', '#B8860B', '#F0C878'];

function formatTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function EmployeeDashboard({ data }) {
  const leaveChartData = (data.leaveSummary || []).map((l) => ({
    name: l.type.charAt(0).toUpperCase() + l.type.slice(1),
    remaining: l.remaining,
    used: l.used,
  }));

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back, {data.greeting?.split(' ')[0] || 'there'}
        </h1>
        <p className="text-muted-foreground">
          {new Date().toLocaleDateString('en-PK', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
        {data.assignedShift && (
          <p className="mt-2 inline-flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
            <Clock className="h-4 w-4" /> {data.assignedShift.name}: {data.assignedShift.startTime} – {data.assignedShift.endTime}
            {data.assignedShift.endTime <= data.assignedShift.startTime ? ' (overnight)' : ''}
          </p>
        )}
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          delay={0.00}
          title="Today's Sign In"
          value={formatTime(data.todayAttendance?.signInTime)}
          subtitle={
            data.todayAttendance?.signOutTime
              ? `Out: ${formatTime(data.todayAttendance.signOutTime)}`
              : 'Not signed out yet'
          }
          icon={Clock}
        />
        <StatCard
          delay={0.06}
          title="This Month Salary"
          value={data.salary?.netSalary ? `PKR ${Number(data.salary.netSalary).toLocaleString()}` : 'Pending'}
          subtitle={data.salary?.status || 'No payslip yet'}
          icon={Wallet}
        />
        <StatCard
          delay={0.12}
          title="Late Count (Month)"
          value={data.lateCount ?? 0}
          subtitle="Every 3 lates = 1 leave deduction"
          icon={AlertTriangle}
        />
        <StatCard
          delay={0.18}
          title="Pending Leaves"
          value={data.pendingLeaveRequests?.length ?? 0}
          subtitle="Awaiting approval"
          icon={CalendarDays}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-card p-5"
        >
          <h3 className="mb-4 font-semibold">Leave Balance</h3>
          {leaveChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={leaveChartData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="remaining" radius={[6, 6, 0, 0]}>
                  {leaveChartData.map((_, i) => (
                    <Cell key={i} fill={LEAVE_COLORS[i % LEAVE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground">No leave balance data</p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(data.leaveSummary || []).map((l) => (
              <div key={l.type} className="rounded-lg bg-muted/50 px-3 py-2 text-xs">
                <div><span className="font-medium capitalize">{l.type}</span>: {l.remaining} left / {l.used} used</div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  Policy: {l.entitlement ?? l.available} days
                  {l.carriedForward > 0 ? ` + ${l.carriedForward} carried` : ''}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-card p-5"
        >
          <h3 className="mb-4 font-semibold flex items-center gap-2">
            <Gift className="h-4 w-4 text-primary" />
            Upcoming Holidays
          </h3>
          {(data.holidays || []).length > 0 ? (
            <ul className="space-y-3">
              {data.holidays.map((h) => (
                <li
                  key={h._id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <span className="font-medium">{h.title}</span>
                  <span className="text-muted-foreground">
                    {new Date(h.date).toLocaleDateString('en-PK', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No upcoming holidays configured</p>
          )}
        </motion.div>
      </div>

      {(data.projectIncentives || []).length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
          <h3 className="mb-4 font-semibold flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            Project Incentives
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.projectIncentives.map((p, i) => (
              <div key={i} className="rounded-lg border border-border p-3">
                <p className="font-medium">{p.projectName}</p>
                <p className="text-sm text-muted-foreground">
                  Pool: PKR {p.incentivePool?.toLocaleString() || 0}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

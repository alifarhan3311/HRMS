/**
 * features/dashboard/components/HRDashboard.jsx
 */
import { motion } from 'framer-motion';
import {
  UserCheck,
  Clock,
  Cake,
  UserPlus,
  Users,
  CalendarDays,
  FileWarning,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import StatCard from '../../../components/ui/StatCard';

const CHART_COLORS = ['#C9971F', '#22c55e', '#f59e0b', '#ef4444', '#8B5E34'];

export default function HRDashboard({ data }) {
  const attendanceData = Object.entries(data.attendanceSummary || {}).map(([name, value]) => ({
    name,
    value,
  }));

  const leaveData = Object.entries(data.leaveSummary || {}).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold tracking-tight">HR Dashboard</h1>
        <p className="text-muted-foreground">Team overview, approvals & alerts</p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          delay={0.00}
          title="Pending Leave Approvals"
          value={data.pendingLeaveApprovals?.length ?? 0}
          icon={UserCheck}
        />
        <StatCard
          delay={0.06}
          title="Attendance Requests"
          value={data.pendingAttendanceRequests?.length ?? 0}
          icon={Clock}
        />
        <StatCard
          delay={0.12}
          title="Birthday Alerts"
          value={data.birthdayAlerts?.length ?? 0}
          subtitle="Tomorrow"
          icon={Cake}
        />
        <StatCard
          delay={0.18}
          title="New Joinings"
          value={data.newJoinings?.length ?? 0}
          subtitle="Last 30 days"
          icon={UserPlus}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <motion.div className="glass-card p-5 lg:col-span-1">
          <h3 className="mb-4 font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" />
            Employee Statistics
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold">{data.employeeStatistics?.total ?? 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Active</span>
              <span className="font-semibold text-emerald-600">
                {data.employeeStatistics?.active ?? 0}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Inactive</span>
              <span className="font-semibold">{data.employeeStatistics?.inactive ?? 0}</span>
            </div>
          </div>
          {(data.employeeStatistics?.byDepartment || []).length > 0 && (
            <div className="mt-4 space-y-2 border-t border-border pt-4">
              <p className="text-xs font-medium text-muted-foreground">By Department</p>
              {data.employeeStatistics.byDepartment.slice(0, 5).map((d) => (
                <div key={d._id} className="flex justify-between text-xs">
                  <span>{d._id || 'Unassigned'}</span>
                  <span className="font-medium">{d.count}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div className="glass-card p-5">
          <h3 className="mb-2 font-semibold">Attendance Summary</h3>
          {attendanceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={attendanceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
                  {attendanceData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">No attendance data this month</p>
          )}
        </motion.div>

        <motion.div className="glass-card p-5">
          <h3 className="mb-2 font-semibold">Leave Summary</h3>
          {leaveData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={leaveData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
                  {leaveData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">No leave requests this month</p>
          )}
        </motion.div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <motion.div className="glass-card p-5">
          <h3 className="mb-4 font-semibold">Pending Leave Approvals</h3>
          {(data.pendingLeaveApprovals || []).length > 0 ? (
            <ul className="space-y-2">
              {data.pendingLeaveApprovals.slice(0, 6).map((leave) => (
                <li
                  key={leave._id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{leave.employeeId?.fullName || 'Employee'}</p>
                    <p className="text-xs text-muted-foreground capitalize">{leave.leaveType} leave</p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    Pending
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No pending approvals</p>
          )}
        </motion.div>

        <motion.div className="glass-card p-5">
          <h3 className="mb-4 font-semibold flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Upcoming Holidays
          </h3>
          {(data.upcomingHolidays || data.holidays || []).length > 0 ? (
            <ul className="space-y-2">
              {(data.upcomingHolidays || data.holidays).slice(0, 6).map((h) => (
                <li
                  key={h._id}
                  className="flex justify-between rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <span>{h.title}</span>
                  <span className="text-muted-foreground">
                    {new Date(h.date).toLocaleDateString('en-PK', { month: 'short', day: 'numeric' })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No holidays configured</p>
          )}
        </motion.div>
      </div>

      {(data.birthdayAlerts || []).length > 0 && (
        <motion.div className="glass-card p-5">
          <h3 className="mb-3 font-semibold flex items-center gap-2">
            <Cake className="h-4 w-4 text-pink-500" />
            Birthday Alerts (Tomorrow)
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.birthdayAlerts.map((emp) => (
              <span
                key={emp._id}
                className="rounded-full bg-pink-100 px-3 py-1 text-sm dark:bg-pink-900/30"
              >
                {emp.fullName}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      <motion.div className="glass-card p-5">
        <h3 className="mb-2 font-semibold flex items-center gap-2">
          <FileWarning className="h-4 w-4" />
          Recruitment Status
        </h3>
        <div className="grid grid-cols-3 gap-3 text-center sm:gap-4">
          <div>
            <p className="text-2xl font-bold">{data.recruitmentStatus?.openPositions ?? 0}</p>
            <p className="text-xs text-muted-foreground">Open Positions</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{data.recruitmentStatus?.inInterview ?? 0}</p>
            <p className="text-xs text-muted-foreground">In Interview</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{data.recruitmentStatus?.offersPending ?? 0}</p>
            <p className="text-xs text-muted-foreground">Offers Pending</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

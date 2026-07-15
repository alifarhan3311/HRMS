/**
 * features/dashboard/components/AdminDashboard.jsx
 */
import { motion } from 'framer-motion';
import { Wallet, Receipt, Users, Building2, CreditCard } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import StatCard from '../../../components/ui/StatCard';
import HRDashboard from './HRDashboard';

export default function AdminDashboard({ data }) {
  const expenseChartData = (data.expensesSummary || []).map((e) => ({
    name: e.status,
    amount: e.totalAmount,
    count: e.count,
  }));

  const deptData = (data.departmentReports || []).map((d) => ({
    name: d._id || 'Unassigned',
    count: d.count,
  }));

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">Company-wide overview & financials</p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Employees"
          value={data.employeeStatistics?.total ?? 0}
          subtitle={`${data.employeeStatistics?.active ?? 0} active`}
          icon={Users}
        />
        <StatCard
          title="Payroll Records"
          value={(data.payrollSummary || []).reduce((s, p) => s + p.count, 0)}
          subtitle="This month"
          icon={Wallet}
        />
        <StatCard
          title="Pending Expenses"
          value={data.pendingExpenseApprovals?.length ?? 0}
          icon={Receipt}
        />
        <StatCard
          title="Departments"
          value={deptData.length}
          icon={Building2}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <motion.div className="glass-card p-5">
          <h3 className="mb-4 font-semibold">Monthly Expenses by Status</h3>
          {expenseChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={expenseChartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => `PKR ${Number(v).toLocaleString()}`} />
                <Bar dataKey="amount" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground py-12 text-center">No expense data</p>
          )}
        </motion.div>

        <motion.div className="glass-card p-5">
          <h3 className="mb-4 font-semibold">Department Distribution</h3>
          {deptData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={deptData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground py-12 text-center">No department data</p>
          )}
        </motion.div>
      </div>

      {(data.pendingExpenseApprovals || []).length > 0 && (
        <motion.div className="glass-card p-5">
          <h3 className="mb-4 font-semibold flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Pending Expense Approvals
          </h3>
          <ul className="space-y-2">
            {data.pendingExpenseApprovals.slice(0, 8).map((exp) => (
              <li
                key={exp._id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{exp.category}</p>
                  <p className="text-xs text-muted-foreground">
                    {exp.submittedBy?.fullName || 'Unknown'} · {exp.vendorName || '—'}
                  </p>
                </div>
                <span className="font-semibold">PKR {exp.amount?.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {data.hrOverview && (
        <div className="border-t border-border pt-8">
          <HRDashboard data={data.hrOverview} />
        </div>
      )}
    </div>
  );
}

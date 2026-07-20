/**
 * features/reports/pages/ReportsPage.jsx
 * Reports hub — generates and displays attendance, leave, payroll, expense reports.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, Download, Calendar, Users, Wallet,
  Receipt, Clock, TrendingUp, FileText, Filter,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useListAttendanceQuery } from '../../attendance/api/attendance.api';
import { useListLeavesQuery } from '../../leaves/api/leaves.api';
import { useListPayrollQuery } from '../../payroll/api/payroll.api';
import { useListExpensesQuery } from '../../expenses/api/expenses.api';
import Button from '../../../components/ui/Button';
import { Input, Select } from '../../../components/ui/Input';
import StatCard from '../../../components/ui/StatCard';

const COLORS = ['#C9971F','#10b981','#E8B04B','#ef4444','#8B5E34','#B8860B'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const REPORT_TYPES = [
  { id: 'attendance', label: 'Attendance Report',  icon: Clock,      color: 'text-blue-500' },
  { id: 'leave',      label: 'Leave Report',        icon: Calendar,   color: 'text-purple-500' },
  { id: 'payroll',    label: 'Payroll Report',       icon: Wallet,     color: 'text-green-500' },
  { id: 'expense',    label: 'Expense Report',       icon: Receipt,    color: 'text-orange-500' },
  { id: 'employee',   label: 'Employee Report',      icon: Users,      color: 'text-indigo-500' },
  { id: 'sales',      label: 'Sales Report',         icon: TrendingUp, color: 'text-emerald-500' },
];

function ReportCard({ report, active, onClick }) {
  const Icon = report.icon;
  return (
    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`glass-card p-5 text-left w-full transition-all
        ${active ? 'ring-2 ring-primary shadow-glow' : 'hover:shadow-glow hover:-translate-y-0.5'}`}>
      <div className={`h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3`}>
        <Icon className={`h-5 w-5 ${report.color}`} />
      </div>
      <p className="font-semibold text-sm">{report.label}</p>
      <p className="text-xs text-muted-foreground mt-1">View & export data</p>
    </motion.button>
  );
}

export default function ReportsPage() {
  const now = new Date();
  const [activeReport, setActiveReport] = useState('attendance');
  const [filters, setFilters] = useState({
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1),
  });

  const { data: attendanceData } = useListAttendanceQuery({ limit: 200, ...filters });
  const { data: leavesData }     = useListLeavesQuery({ limit: 200, ...filters });
  const { data: leavesYearData } = useListLeavesQuery({ limit: 100, year: filters.year });
  const { data: payrollData }    = useListPayrollQuery({ limit: 200, year: filters.year });
  const { data: expensesData }   = useListExpensesQuery({ limit: 200 });

  // ── Attendance chart data ──
  const attRecords = attendanceData?.items || [];
  const attStatus = {};
  attRecords.forEach(r => { attStatus[r.status] = (attStatus[r.status] || 0) + 1; });
  const attChartData = Object.entries(attStatus).map(([name, value]) => ({ name, value }));

  // ── Leave chart data ──
  const leaveRecords = leavesData?.items || [];
  const leaveByType = {};
  leaveRecords.forEach(r => { leaveByType[r.leaveType] = (leaveByType[r.leaveType] || 0) + (r.totalDays || 0); });
  const leaveChartData = Object.entries(leaveByType).map(([name, days]) => ({ name, days }));
  const leaveByStatus = {};
  leaveRecords.forEach(r => { leaveByStatus[r.status] = (leaveByStatus[r.status] || 0) + 1; });
  const leaveStatusData = Object.entries(leaveByStatus).map(([name, value]) => ({ name, value }));
  const leaveByMonth = Object.fromEntries(MONTHS.map(month => [month, 0]));
  (leavesYearData?.items || []).forEach(r => {
    const month = MONTHS[new Date(r.startDate).getUTCMonth()];
    leaveByMonth[month] += Number(r.totalDays || 0);
  });
  const leaveTrendData = Object.entries(leaveByMonth).map(([month, days]) => ({ month, days }));

  // ── Payroll chart data ──
  const payrollRecords = payrollData?.items || [];
  const payrollByMonth = {};
  payrollRecords.forEach(r => {
    const key = MONTHS[r.month - 1];
    payrollByMonth[key] = (payrollByMonth[key] || 0) + Number(r.netSalary || 0);
  });
  const payrollChartData = Object.entries(payrollByMonth).map(([month, total]) => ({ month, total }));

  // ── Expense chart data ──
  const expenseRecords = expensesData?.items || [];
  const expByCat = {};
  expenseRecords.forEach(r => { expByCat[r.category] = (expByCat[r.category] || 0) + r.amount; });
  const expChartData = Object.entries(expByCat)
    .map(([name, amount]) => ({ name: name.replace(' Expenses','').replace(' Bills',''), amount }))
    .sort((a,b) => b.amount - a.amount).slice(0, 6);

  // ── Summary stats ──
  const totalPayroll = payrollRecords.reduce((s, r) => s + Number(r.netSalary || 0), 0);
  const totalExpenses = expenseRecords.reduce((s, r) => s + r.amount, 0);
  const totalLeaves = leaveRecords.filter(r => r.status === 'approved').reduce((s, r) => s + (r.totalDays||0), 0);

  function handleExport() {
    // In production: call backend export endpoint or generate client-side CSV
    const data = activeReport === 'attendance' ? attRecords :
                 activeReport === 'leave' ? leaveRecords :
                 activeReport === 'payroll' ? payrollRecords : expenseRecords;
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${activeReport}-report.json`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6" /> Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Analyze and export company data</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filters.month} className="w-28"
            onChange={e => setFilters(p => ({ ...p, month: e.target.value }))}>
            {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </Select>
          <Input type="number" value={filters.year} className="w-24"
            onChange={e => setFilters(p => ({ ...p, year: e.target.value }))} />
          <Button variant="primary" size="sm" className="gap-1.5" onClick={handleExport}>
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
      </motion.div>

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Attendance Records" value={attRecords.length} icon={Clock} />
        <StatCard title="Leave Days Taken"   value={totalLeaves}        icon={Calendar} />
        <StatCard title="Total Payroll"      value={`PKR ${(totalPayroll/1000).toFixed(0)}k`} icon={Wallet} />
        <StatCard title="Total Expenses"     value={`PKR ${(totalExpenses/1000).toFixed(0)}k`} icon={Receipt} />
      </div>

      {/* Report type selector */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {REPORT_TYPES.map(r => (
          <ReportCard key={r.id} report={r} active={activeReport === r.id} onClick={() => setActiveReport(r.id)} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Attendance Status Pie */}
        {(activeReport === 'attendance' || activeReport === 'employee') && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Clock className="h-4 w-4" /> Attendance by Status</h3>
            {attChartData.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">No data for selected period</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={attChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                    {attChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </motion.div>
        )}

        {/* Leave by Type */}
        {(activeReport === 'leave' || activeReport === 'attendance') && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Calendar className="h-4 w-4" /> Leave Days by Type</h3>
            {leaveChartData.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">No leave data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={leaveChartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="days" fill="#8b5cf6" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </motion.div>
        )}

        {/* Leave request status */}
        {activeReport === 'leave' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><FileText className="h-4 w-4" /> Leave Requests by Status</h3>
            {leaveStatusData.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">No leave requests for selected period</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={leaveStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45}
                    outerRadius={80} paddingAngle={3} label={({ name, value }) => `${name}: ${value}`}>
                    {leaveStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </motion.div>
        )}

        {/* Yearly leave trend */}
        {activeReport === 'leave' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 lg:col-span-2">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Leave Days Trend — {filters.year}</h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={leaveTrendData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip formatter={value => [`${value} days`, 'Leave']} />
                <Line type="monotone" dataKey="days" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* Payroll trend */}
        {(activeReport === 'payroll' || activeReport === 'sales') && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Wallet className="h-4 w-4" /> Monthly Payroll</h3>
            {payrollChartData.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">No payroll data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={payrollChartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v/1000}k`} />
                  <Tooltip formatter={v => `PKR ${Number(v).toLocaleString()}`} />
                  <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </motion.div>
        )}

        {/* Expenses by category */}
        {(activeReport === 'expense' || activeReport === 'payroll') && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Receipt className="h-4 w-4" /> Expenses by Category</h3>
            {expChartData.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">No expense data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={expChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${v/1000}k`} />
                  <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={v => `PKR ${Number(v).toLocaleString()}`} />
                  <Bar dataKey="amount" fill="#f59e0b" radius={[0,6,6,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </motion.div>
        )}
      </div>

      {/* Raw data table */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4" /> Raw Data Preview
          </h3>
          <span className="text-xs text-muted-foreground">
            Showing latest {Math.min(
              activeReport === 'attendance' ? attRecords.length :
              activeReport === 'leave' ? leaveRecords.length :
              activeReport === 'payroll' ? payrollRecords.length : expenseRecords.length, 10
            )} records
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {activeReport === 'attendance' && ['Employee','Date','Status','Sign In','Sign Out','Hours'].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
                {activeReport === 'leave' && ['Employee','Type','Start','End','Days','Status'].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
                {activeReport === 'payroll' && ['Employee','Month','Basic','Net Salary','Status'].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
                {activeReport === 'expense' && ['Category','Vendor','Amount','Date','Status'].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {activeReport === 'attendance' && attRecords.slice(0,10).map(r => (
                <tr key={r._id} className="hover:bg-accent/30 transition-colors">
                  <td className="py-2 px-3">{r.employeeId?.fullName || '—'}</td>
                  <td className="py-2 px-3 text-muted-foreground">{new Date(r.date).toLocaleDateString('en-PK')}</td>
                  <td className="py-2 px-3"><span className="capitalize">{r.status}</span></td>
                  <td className="py-2 px-3 text-muted-foreground">{r.signInTime ? new Date(r.signInTime).toLocaleTimeString('en-PK',{hour:'2-digit',minute:'2-digit'}) : '—'}</td>
                  <td className="py-2 px-3 text-muted-foreground">{r.signOutTime ? new Date(r.signOutTime).toLocaleTimeString('en-PK',{hour:'2-digit',minute:'2-digit'}) : '—'}</td>
                  <td className="py-2 px-3">{r.totalHours || 0}h</td>
                </tr>
              ))}
              {activeReport === 'leave' && leaveRecords.slice(0,10).map(r => (
                <tr key={r._id} className="hover:bg-accent/30 transition-colors">
                  <td className="py-2 px-3">{r.employeeId?.fullName || '—'}</td>
                  <td className="py-2 px-3 capitalize">{r.leaveType}</td>
                  <td className="py-2 px-3 text-muted-foreground">{new Date(r.startDate).toLocaleDateString('en-PK')}</td>
                  <td className="py-2 px-3 text-muted-foreground">{new Date(r.endDate).toLocaleDateString('en-PK')}</td>
                  <td className="py-2 px-3">{r.totalDays}d</td>
                  <td className="py-2 px-3 capitalize">{r.status}</td>
                </tr>
              ))}
              {activeReport === 'payroll' && payrollRecords.slice(0,10).map(r => (
                <tr key={r._id} className="hover:bg-accent/30 transition-colors">
                  <td className="py-2 px-3">{r.employeeId?.fullName || '—'}</td>
                  <td className="py-2 px-3">{MONTHS[r.month-1]} {r.year}</td>
                  <td className="py-2 px-3">PKR {Number(r.basicSalary||0).toLocaleString()}</td>
                  <td className="py-2 px-3 font-medium text-primary">PKR {Number(r.netSalary||0).toLocaleString()}</td>
                  <td className="py-2 px-3 capitalize">{r.status}</td>
                </tr>
              ))}
              {activeReport === 'expense' && expenseRecords.slice(0,10).map(r => (
                <tr key={r._id} className="hover:bg-accent/30 transition-colors">
                  <td className="py-2 px-3">{r.category}</td>
                  <td className="py-2 px-3 text-muted-foreground">{r.vendorName || '—'}</td>
                  <td className="py-2 px-3 font-medium">PKR {r.amount?.toLocaleString()}</td>
                  <td className="py-2 px-3 text-muted-foreground">{new Date(r.expenseDate||r.createdAt).toLocaleDateString('en-PK')}</td>
                  <td className="py-2 px-3 capitalize">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

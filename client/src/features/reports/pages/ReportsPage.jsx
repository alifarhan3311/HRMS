/**
 * features/reports/pages/ReportsPage.jsx
 * Reports hub — generates and displays attendance, leave, payroll, expense reports.
 */
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
  BarChart3, Download, Calendar, Users, Wallet,
  Receipt, Clock, TrendingUp, FileText,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useListAttendanceQuery } from '../../attendance/api/attendance.api';
import { useListLeavesQuery } from '../../leaves/api/leaves.api';
import { useGetLivePayrollQuery } from '../../payroll/api/payroll.api';
import { useListExpensesQuery } from '../../expenses/api/expenses.api';
import { useListEmployeesQuery } from '../../employees/api/employees.api';
import Button from '../../../components/ui/Button';
import { Input, Select } from '../../../components/ui/Input';
import StatCard from '../../../components/ui/StatCard';
import SensitiveValue from '../../../components/ui/SensitiveValue';
import { toast } from '../../../utils/toast';

const COLORS = ['#C9971F','#10b981','#E8B04B','#ef4444','#8B5E34','#B8860B'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const REPORT_TYPES = [
  { id: 'attendance', label: 'Attendance Report',  icon: Clock,      color: 'text-blue-500' },
  { id: 'leave',      label: 'Leave Report',        icon: Calendar,   color: 'text-purple-500' },
  { id: 'payroll',    label: 'Payroll Report',       icon: Wallet,     color: 'text-green-500' },
  { id: 'expense',    label: 'Expense Report',       icon: Receipt,    color: 'text-orange-500' },
  { id: 'employee',   label: 'Employee Report',      icon: Users,      color: 'text-indigo-500' },
];

const titleCase = value => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const dateValue = value => value ? new Date(value).toLocaleDateString('en-PK') : '';
const timeValue = value => value
  ? new Date(value).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })
  : '';
const employeeName = record => record.employeeId?.fullName || record.employeeName || '';
const employeeCode = record => record.employeeId?.employeeCode || record.employeeCode || '';
const csvCell = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
const escapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

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
  const user = useSelector(state => state.auth.user);
  const role = user?.role;
  const canViewExpenses = role === 'super_admin';
  const canViewEmployees = ['hr', 'super_admin'].includes(role);
  const canSelectAttendanceEmployee = ['team_lead', 'manager', 'hr', 'super_admin'].includes(role);
  const availableReportTypes = REPORT_TYPES.filter(report => (
    (report.id !== 'expense' || canViewExpenses)
    && (report.id !== 'employee' || canViewEmployees)
  ));
  const now = new Date();
  const [activeReport, setActiveReport] = useState('attendance');
  const [filters, setFilters] = useState({
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1),
    employeeId: '',
  });

  const attendanceParams = {
    limit: 2000,
    year: filters.year,
    month: filters.month,
    ...(filters.employeeId && { employeeId: filters.employeeId }),
  };
  const { data: attendanceData } = useListAttendanceQuery(attendanceParams);
  const { data: leavesData }     = useListLeavesQuery({ limit: 200, ...filters });
  const { data: leavesYearData } = useListLeavesQuery({ limit: 100, year: filters.year });
  const { data: livePayrollData } = useGetLivePayrollQuery({
    month: filters.month,
    year: filters.year,
  });
  const { data: expensesData } = useListExpensesQuery(
    { limit: 200 },
    { skip: !canViewExpenses },
  );
  const { data: employeesData } = useListEmployeesQuery(
    { limit: 100 },
    { skip: !canViewEmployees && !canSelectAttendanceEmployee },
  );

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
  const payrollRecords = livePayrollData?.items || [];
  const payrollByMonth = {};
  payrollRecords.forEach(r => {
    const key = MONTHS[r.month - 1];
    payrollByMonth[key] = (payrollByMonth[key] || 0) + Number(r.netPayable || 0);
  });
  const payrollChartData = Object.entries(payrollByMonth).map(([month, total]) => ({ month, total }));

  // ── Expense chart data ──
  const expenseRecords = expensesData?.items || [];
  const employeeRecords = employeesData?.items || [];
  const expByCat = {};
  expenseRecords.forEach(r => { expByCat[r.category] = (expByCat[r.category] || 0) + r.amount; });
  const expChartData = Object.entries(expByCat)
    .map(([name, amount]) => ({ name: name.replace(' Expenses','').replace(' Bills',''), amount }))
    .sort((a,b) => b.amount - a.amount).slice(0, 6);

  // ── Summary stats ──
  const totalPayroll = payrollRecords.reduce((s, r) => s + Number(r.netPayable || 0), 0);
  const totalExpenses = expenseRecords.reduce((s, r) => s + r.amount, 0);
  const totalLeaves = leaveRecords.filter(r => r.status === 'approved').reduce((s, r) => s + (r.totalDays||0), 0);

  const reportRows = {
    attendance: attRecords.map(record => ({
      'Employee Code': employeeCode(record),
      Employee: employeeName(record),
      Department: record.employeeId?.department || record.employeeDepartment || '',
      Date: dateValue(record.date),
      Status: titleCase(record.status),
      'Work Mode': record.workMode === 'wfh' ? 'WFH' : 'Office',
      'Sign In': timeValue(record.signInTime),
      'Sign Out': timeValue(record.signOutTime),
      'Worked Hours': Number(record.totalHours || 0),
      'Late Minutes': Number(record.lateMinutes || 0),
      Method: titleCase(record.method),
    })),
    leave: leaveRecords.map(record => ({
      'Employee Code': employeeCode(record),
      Employee: employeeName(record),
      Department: record.department || record.employeeId?.department || '',
      'Leave Type': titleCase(record.leaveType),
      'Start Date': dateValue(record.startDate),
      'End Date': dateValue(record.endDate),
      'Total Days': Number(record.totalDays || 0),
      Status: titleCase(record.status),
      Reason: record.reason || '',
    })),
    payroll: payrollRecords.map(record => ({
      'Employee Code': employeeCode(record),
      Employee: employeeName(record),
      Department: record.employeeId?.department || '',
      Period: `${MONTHS[Number(record.month) - 1] || record.month} ${record.year}`,
      'Monthly Salary': Number(record.monthlySalary || 0),
      'Daily Salary': Number(record.dailySalary || 0),
      'Earned Salary': Number(record.earnedSalary || 0),
      Deductions: Number(record.deductions || 0),
      'Net Payable': Number(record.netPayable || 0),
      Present: Number(record.present || 0),
      Absent: Number(record.absent || 0),
      'Half Days': Number(record.halfDay || 0),
      Late: Number(record.late || 0),
      'Paid Leaves': Number(record.paidLeave || 0),
      'Unpaid Leaves': Number(record.unpaidLeave || 0),
      'Sandwich Leaves': Number(record.sandwichLeave || 0),
    })),
    expense: expenseRecords.map(record => ({
      Date: dateValue(record.expenseDate || record.createdAt),
      Category: record.category || '',
      Product: record.productName || '',
      Vendor: record.vendorName || '',
      Quantity: Number(record.quantity || 0),
      'Unit Price': Number(record.unitPrice || 0),
      Total: Number(record.amount || 0),
      'Payment Method': titleCase(record.paymentMethod),
      Status: titleCase(record.status),
      Remarks: record.remarks || '',
    })),
    employee: employeeRecords.map(record => ({
      'Employee Code': record.employeeCode || '',
      Name: record.fullName || '',
      Department: record.department || '',
      Designation: record.designation || '',
      Role: titleCase(record.role),
      Email: record.email || '',
      'Joining Date': dateValue(record.joiningDate),
      Shift: record.shiftId?.name || 'General Shift',
      Status: titleCase(record.status),
    })),
  };

  const activeRows = reportRows[activeReport] || [];
  const activeLabel = REPORT_TYPES.find(report => report.id === activeReport)?.label || 'Report';

  function exportFileName(extension) {
    const selectedEmployee = activeReport === 'attendance'
      ? employeeRecords.find(employee => employee._id === filters.employeeId)
      : null;
    const employeePart = selectedEmployee
      ? selectedEmployee.fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      : 'all-employees';
    return `${activeReport}-report-${employeePart}-${filters.year}-${String(filters.month).padStart(2, '0')}.${extension}`;
  }

  async function handleExport(format = 'excel') {
    if (!activeRows.length) {
      toast.error(`No ${activeLabel.toLowerCase()} data available to export.`);
      return;
    }
    if (format === 'csv') {
      const headers = Object.keys(activeRows[0]);
      const csv = [
        headers,
        ...activeRows.map(row => headers.map(header => row[header])),
      ].map(row => row.map(csvCell).join(',')).join('\r\n');
      const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = exportFileName('csv');
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`${activeLabel} CSV downloaded.`);
      return;
    }
    if (format === 'print') {
      const headers = Object.keys(activeRows[0]);
      const popup = window.open('', '_blank');
      if (!popup) return toast.error('Allow pop-ups to print or save this report as PDF.');
      popup.opener = null;
      popup.document.write(`<!doctype html><html><head><title>${escapeHtml(activeLabel)}</title>
        <style>body{font-family:Arial,sans-serif;padding:24px;color:#222}h1{margin:0 0 4px}p{margin:0 0 18px;color:#555}
        table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #bbb;padding:6px;text-align:left}
        th{background:#eee}@media print{body{padding:0}}</style></head><body>
        <h1>${escapeHtml(activeLabel)}</h1>
        <p>${escapeHtml(MONTHS[Number(filters.month) - 1])} ${escapeHtml(filters.year)} · ${activeRows.length} records</p>
        <table><thead><tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
        <tbody>${activeRows.map(row => `<tr>${headers.map(header => `<td>${escapeHtml(row[header])}</td>`).join('')}</tr>`).join('')}</tbody>
        </table></body></html>`);
      popup.document.close();
      popup.focus();
      popup.print();
      return;
    }
    try {
      const XLSX = await import('xlsx');
      const heading = [
        [activeLabel],
        [`Period: ${MONTHS[Number(filters.month) - 1]} ${filters.year}`],
        [`Generated: ${new Date().toLocaleString('en-PK')}`],
        [],
      ];
      const sheet = XLSX.utils.aoa_to_sheet(heading);
      XLSX.utils.sheet_add_json(sheet, activeRows, { origin: 'A5' });
      const headers = Object.keys(activeRows[0]);
      sheet['!cols'] = headers.map(header => ({
        wch: Math.min(40, Math.max(
          header.length + 2,
          ...activeRows.map(row => String(row[header] ?? '').length + 2),
        )),
      }));
      sheet['!autofilter'] = { ref: `A5:${XLSX.utils.encode_col(headers.length - 1)}${activeRows.length + 5}` };
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, activeLabel.slice(0, 31));
      XLSX.writeFile(
        workbook,
        exportFileName('xlsx'),
      );
      toast.success(`${activeLabel} exported successfully.`);
    } catch {
      toast.error('Unable to load the Excel exporter.');
    }
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
          {activeReport === 'attendance' && canSelectAttendanceEmployee && (
            <Select value={filters.employeeId} className="min-w-48"
              onChange={e => setFilters(p => ({ ...p, employeeId: e.target.value }))}>
              <option value="">All Employees</option>
              {employeeRecords.map(employee => (
                <option key={employee._id} value={employee._id}>
                  {employee.fullName} ({employee.employeeCode})
                </option>
              ))}
            </Select>
          )}
          <Select value={filters.month} className="w-28"
            onChange={e => setFilters(p => ({ ...p, month: e.target.value }))}>
            {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </Select>
          <Input type="number" value={filters.year} className="w-24"
            onChange={e => setFilters(p => ({ ...p, year: e.target.value }))} />
          <Button variant="primary" size="sm" className="gap-1.5" onClick={() => handleExport('excel')}>
            <Download className="h-4 w-4" /> Excel
          </Button>
          <Button variant="secondary" size="sm" onClick={() => handleExport('csv')}>
            CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={() => handleExport('print')}>
            PDF / Print
          </Button>
        </div>
      </motion.div>

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Attendance Records" value={attRecords.length} icon={Clock} />
        <StatCard title="Leave Days Taken"   value={totalLeaves}        icon={Calendar} />
        <StatCard title="Total Payroll" value={<SensitiveValue value={totalPayroll} formatter={(value) => `PKR ${Number(value).toLocaleString()}`} />} icon={Wallet} />
        {canViewExpenses && (
          <StatCard title="Total Expenses" value={`PKR ${(totalExpenses/1000).toFixed(0)}k`} icon={Receipt} />
        )}
      </div>

      {/* Report type selector */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {availableReportTypes.map(r => (
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
              <ResponsiveContainer width="100%" height={Math.max(220, attChartData.length * 42)}>
                <BarChart data={attChartData} layout="vertical" margin={{ left: 12, right: 35 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.25} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis dataKey="name" type="category" width={90} tickFormatter={titleCase} />
                  <Tooltip formatter={value => [value, 'Records']} labelFormatter={titleCase} />
                  <Bar dataKey="value" name="Records" radius={[0, 6, 6, 0]}>
                    {attChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
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
        {activeReport === 'payroll' && (
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
        {canViewExpenses && (activeReport === 'expense' || activeReport === 'payroll') && (
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

      {/* Formatted data table */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4" /> {activeLabel} Preview
          </h3>
          <span className="text-xs text-muted-foreground">
            Showing latest {Math.min(activeRows.length, 10)} of {activeRows.length} records
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {activeReport === 'attendance' && ['Employee','Date','Status','Work Mode','Sign In','Sign Out','Hours'].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
                {activeReport === 'leave' && ['Employee','Type','Start','End','Days','Status'].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
                {activeReport === 'payroll' && ['Employee','Month','Monthly Salary','Net Payable','Calculation'].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
                {activeReport === 'expense' && ['Category','Vendor','Amount','Date','Status'].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
                {activeReport === 'employee' && ['Code','Name','Department','Designation','Role','Joining Date','Shift','Status'].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {activeReport === 'attendance' && attRecords.slice(0,10).map(r => (
                <tr key={r._id} className="hover:bg-accent/30 transition-colors">
                  <td className="py-2 px-3">{r.employeeName || r.employeeId?.fullName || '—'}</td>
                  <td className="py-2 px-3 text-muted-foreground">{new Date(r.date).toLocaleDateString('en-PK')}</td>
                  <td className="py-2 px-3"><span className="capitalize">{r.status}</span></td>
                  <td className="py-2 px-3">
                    <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">
                      {r.workMode === 'wfh' ? 'WFH' : 'Office'}
                    </span>
                  </td>
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
                <tr key={r._id || r.employeeId} className="hover:bg-accent/30 transition-colors">
                  <td className="py-2 px-3">{r.employeeName || r.employeeId?.fullName || '—'}</td>
                  <td className="py-2 px-3">{MONTHS[r.month-1]} {r.year}</td>
                  <td className="py-2 px-3"><SensitiveValue value={r.monthlySalary} formatter={(value) => `PKR ${Number(value || 0).toLocaleString()}`} /></td>
                  <td className="py-2 px-3 font-medium text-primary"><SensitiveValue value={r.netPayable} formatter={(value) => `PKR ${Number(value || 0).toLocaleString()}`} /></td>
                  <td className="py-2 px-3">{Number(r.deductions || 0) > 0 ? 'Deductions applied' : 'Calculated'}</td>
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
              {activeReport === 'employee' && employeeRecords.slice(0,10).map(r => (
                <tr key={r._id} className="hover:bg-accent/30 transition-colors">
                  <td className="py-2 px-3">{r.employeeCode || '—'}</td>
                  <td className="py-2 px-3">{r.fullName || '—'}</td>
                  <td className="py-2 px-3 text-muted-foreground">{r.department || '—'}</td>
                  <td className="py-2 px-3 text-muted-foreground">{r.designation || '—'}</td>
                  <td className="py-2 px-3">{titleCase(r.role)}</td>
                  <td className="py-2 px-3 text-muted-foreground">{dateValue(r.joiningDate) || '—'}</td>
                  <td className="py-2 px-3 text-muted-foreground">{r.shiftId?.name || 'General Shift'}</td>
                  <td className="py-2 px-3">{titleCase(r.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

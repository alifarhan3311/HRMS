/**
 * modules/dashboard/dashboard.service.js
 * Role-based dashboard aggregation — each role receives only the widgets
 * and metrics defined in the HRMS requirements document.
 */
const Employee = require('../employees/employees.model');
const Attendance = require('../attendance/attendance.model');
const LeaveRequest = require('../leaves/leaves.model');
const Payslip = require('../payroll/payroll.model');
const Expense = require('../expenses/expenses.model');
const Project = require('../projects/projects.model');
const Holiday = require('../holidays/holidays.model');
const settingsService = require('../companySettings/companySettings.service');

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function daysBetween(from, to) {
  const ms = to.getTime() - from.getTime();
  return {
    years: Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000)),
    months: Math.floor((ms % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000)),
    days: Math.floor((ms % (30.44 * 24 * 60 * 60 * 1000)) / (24 * 60 * 60 * 1000)),
  };
}

async function getUpcomingHolidays(companyId, limit = 5) {
  return Holiday.find({
    companyId,
    status: 'confirmed',
    date: { $gte: startOfDay() },
  })
    .sort({ date: 1 })
    .limit(limit)
    .lean();
}

async function getEmployeeDashboard(user) {
  const today = startOfDay();
  const monthStart = startOfMonth();
  const monthEnd = endOfMonth();
  const now = new Date();

  const [employee, settings] = await Promise.all([
    Employee.findById(user.id)
      .populate('shiftId', 'name code startTime endTime graceMinutes requiredMinutes breakMinutes halfDayMinutes overtimeAfterMinutes workingDays isActive')
      .lean(),
    settingsService.getPolicy(user.companyId),
  ]);
  if (!employee) return null;

  const [todayAttendance, monthPayslip, pendingLeaves, monthLateCount, projectIncentives, holidays] =
    await Promise.all([
      Attendance.findOne({
        employeeId: user.id,
        $or: [
          { signInTime: { $exists: true }, signOutTime: { $exists: false } },
          { date: { $gte: today, $lte: endOfDay() } },
        ],
      }).sort({ signInTime: -1 }).lean(),
      Payslip.findOne({
        employeeId: user.id,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      }).lean(),
      LeaveRequest.find({ employeeId: user.id, status: 'pending' })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      Attendance.countDocuments({
        employeeId: user.id,
        date: { $gte: monthStart, $lte: monthEnd },
        lateMinutes: { $gt: 0 },
      }),
      Project.find({
        companyId: user.companyId,
        status: 'active',
      })
        .select('name incentivePool status')
        .limit(5)
        .lean(),
      getUpcomingHolidays(user.companyId, 5),
    ]);

  const enabledTypes = settings.leavePolicy?.enabledTypes || ['paid', 'casual', 'sick', 'annual'];
  const leaveSummary = enabledTypes
    .filter((type) => settings.leavePolicy?.entitlements?.[type] !== undefined)
    .map((type) => {
      const entitlement = Number(settings.leavePolicy.entitlements[type] || 0);
      const joiningYear = employee.joiningDate ? new Date(employee.joiningDate).getFullYear() : Infinity;
      const processedYear = Number(employee.leaveCycle?.lastProcessedYear || 0);
      const carriedForward = employee.leaveCycle?.basis === 'calendar_year' && processedYear > joiningYear
        ? Number(employee.leaveCycle?.carriedForward?.[type] || 0)
        : 0;
      const used = Number(employee.leaveBalance?.[type]?.used || 0);
      const available = entitlement + carriedForward;
      return {
        type,
        entitlement,
        carriedForward,
        available,
        used,
        remaining: Math.max(available - used, 0),
      };
    });

  const tenure = employee.joiningDate
    ? daysBetween(new Date(employee.joiningDate), now)
    : { years: 0, months: 0, days: 0 };

  return {
    role: 'employee',
    greeting: employee.fullName,
    assignedShift: employee.shiftId || null,
    todayAttendance: todayAttendance
      ? {
          signInTime: todayAttendance.signInTime,
          signOutTime: todayAttendance.signOutTime,
          status: todayAttendance.status,
          lateMinutes: todayAttendance.lateMinutes,
        }
      : null,
    salary: monthPayslip
      ? {
          netSalary: monthPayslip.netSalary,
          basicSalary: monthPayslip.basicSalary,
          allowances: monthPayslip.allowances,
          deductions: monthPayslip.deductions,
          bonus: monthPayslip.bonus,
          incentives: monthPayslip.incentives,
          status: monthPayslip.status,
        }
      : null,
    leaveSummary,
    lateCount: monthLateCount,
    pendingLeaveRequests: pendingLeaves,
    notifications: [],
    holidays,
    projectIncentives: projectIncentives.map((p) => ({
      projectName: p.name,
      incentivePool: p.incentivePool,
      status: p.status,
    })),
    salesIncentives: [],
    tenure,
  };
}

async function getHRDashboard(user) {
  const today = startOfDay();
  const monthStart = startOfMonth();
  const monthEnd = endOfMonth();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [
    pendingLeaveApprovals,
    pendingAttendanceRequests,
    birthdayAlerts,
    newJoinings,
    employeeStats,
    attendanceSummary,
    leaveSummary,
    holidays,
    totalEmployees,
    activeEmployees,
    settings,
  ] = await Promise.all([
    LeaveRequest.find({ companyId: user.companyId, status: 'pending' })
      .populate('employeeId', 'fullName employeeCode department')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    Attendance.find({
      companyId: user.companyId,
      regularizationStatus: 'pending',
    })
      .populate('employeeId', 'fullName employeeCode')
      .limit(10)
      .lean(),
    Employee.find({
      companyId: user.companyId,
      status: 'active',
      dateOfBirth: {
        $exists: true,
        $ne: null,
      },
    })
      .select('fullName dateOfBirth department')
      .lean()
      .then((employees) =>
        employees.filter((emp) => {
          if (!emp.dateOfBirth) return false;
          const dob = new Date(emp.dateOfBirth);
          return dob.getMonth() === tomorrow.getMonth() && dob.getDate() === tomorrow.getDate();
        })
      ),
    Employee.find({
      companyId: user.companyId,
      joiningDate: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    })
      .select('fullName joiningDate department designation')
      .sort({ joiningDate: -1 })
      .limit(10)
      .lean(),
    Employee.aggregate([
      { $match: { companyId: user.companyId } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Attendance.aggregate([
      {
        $match: {
          companyId: user.companyId,
          date: { $gte: monthStart, $lte: monthEnd },
        },
      },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    LeaveRequest.aggregate([
      {
        $match: {
          companyId: user.companyId,
          createdAt: { $gte: monthStart, $lte: monthEnd },
        },
      },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    getUpcomingHolidays(user.companyId, 8),
    Employee.countDocuments({ companyId: user.companyId }),
    Employee.countDocuments({ companyId: user.companyId, status: 'active' }),
    settingsService.getPolicy(user.companyId),
  ]);

  const enabledLeaveTypes = settings.leavePolicy?.enabledTypes || ['paid', 'casual', 'sick', 'annual'];
  const leaveEntitlements = Object.fromEntries(enabledLeaveTypes
    .filter((type) => settings.leavePolicy?.entitlements?.[type] !== undefined)
    .map((type) => [type, Number(settings.leavePolicy.entitlements[type] || 0)]));

  return {
    role: 'hr',
    pendingLeaveApprovals,
    pendingAttendanceRequests,
    birthdayAlerts,
    newJoinings,
    resignationRequests: [],
    employeeStatistics: {
      total: totalEmployees,
      active: activeEmployees,
      inactive: totalEmployees - activeEmployees,
      byDepartment: employeeStats,
    },
    attendanceSummary: attendanceSummary.reduce((acc, row) => {
      acc[row._id] = row.count;
      return acc;
    }, {}),
    leaveSummary: leaveSummary.reduce((acc, row) => {
      acc[row._id] = row.count;
      return acc;
    }, {}),
    leaveEntitlements,
    upcomingHolidays: holidays,
    pendingDocuments: [],
    recruitmentStatus: { openPositions: 0, inInterview: 0, offersPending: 0 },
  };
}

async function getAdminDashboard(user) {
  const monthStart = startOfMonth();
  const monthEnd = endOfMonth();

  const [
    attendanceSummary,
    payrollSummary,
    expenseSummary,
    pendingExpenseApprovals,
    employeeStats,
    departmentReports,
  ] = await Promise.all([
    Attendance.aggregate([
      {
        $match: {
          companyId: user.companyId,
          date: { $gte: monthStart, $lte: monthEnd },
        },
      },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Payslip.aggregate([
      {
        $match: {
          companyId: user.companyId,
          month: new Date().getMonth() + 1,
          year: new Date().getFullYear(),
        },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),
    Expense.aggregate([
      {
        $match: {
          companyId: user.companyId,
          expenseDate: { $gte: monthStart, $lte: monthEnd },
        },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
    ]),
    Expense.find({ companyId: user.companyId, status: 'pending' })
      .populate('submittedBy', 'fullName employeeCode')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    Employee.aggregate([
      { $match: { companyId: user.companyId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        },
      },
    ]),
    Employee.aggregate([
      { $match: { companyId: user.companyId, status: 'active' } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  const paymentStatus = expenseSummary.reduce((acc, row) => {
    acc[row._id] = { count: row.count, amount: row.totalAmount };
    return acc;
  }, {});

  return {
    role: 'admin',
    companyAttendanceSummary: attendanceSummary.reduce((acc, row) => {
      acc[row._id] = row.count;
      return acc;
    }, {}),
    payrollSummary: payrollSummary.map((row) => ({
      status: row._id,
      count: row.count,
    })),
    expensesSummary: expenseSummary.map((row) => ({
      status: row._id,
      count: row.count,
      totalAmount: row.totalAmount,
    })),
    pendingExpenseApprovals,
    paymentStatus,
    employeeStatistics: employeeStats[0] || { total: 0, active: 0 },
    departmentReports,
    notifications: [],
    activityLogs: [],
  };
}

async function getDashboardForUser(user) {
  const role = user.role;

  if (['employee', 'team_lead'].includes(role)) {
    return getEmployeeDashboard(user);
  }

  if (['manager'].includes(role)) {
    const employeeDash = await getEmployeeDashboard(user);
    const hrDash = await getHRDashboard(user);
    return { role: 'manager', ...employeeDash, teamOverview: hrDash.employeeStatistics };
  }

  if (role === 'hr') {
    return getHRDashboard(user);
  }

  if (role === 'admin') {
    return getAdminDashboard(user);
  }

  if (role === 'super_admin') {
    const [adminDash, hrDash] = await Promise.all([
      getAdminDashboard(user),
      getHRDashboard(user),
    ]);
    return { ...adminDash, hrOverview: hrDash };
  }

  return getEmployeeDashboard(user);
}

module.exports = { getDashboardForUser };

const Attendance = require('../attendance/attendance.model');
const Leave = require('../leaves/leaves.model');
const Employee = require('../employees/employees.model');
const Payslip = require('../payroll/payroll.model');
const Notification = require('../notifications/notifications.model');
const EmployeeExit = require('../exits/exits.model');
const { BiometricPunch, BiometricSyncState } = require('../../integrations/zkteco/biometricPunch.model');

const limit = (query) => Math.min(Math.max(Number(query.limit) || 25, 1), 100);
const item = (id, title, subtitle, date, link, severity = 'warning') => ({ id, title, subtitle, date, link, severity });

async function getActionCenter(query, actor) {
  const companyId = actor.companyId;
  const max = limit(query);
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const probationStart = new Date(now);
  probationStart.setMonth(probationStart.getMonth() - 3);
  const probationEnd = new Date(probationStart);
  probationEnd.setDate(probationEnd.getDate() + 30);

  const [leaves, regularizations, missingSignOuts, biometricIssues, exits, probation, payroll, failedEmails, syncStates] = await Promise.all([
    Leave.find({ companyId, status: 'pending' }).populate('employeeId', 'fullName employeeCode').sort('createdAt').limit(max).lean(),
    Attendance.find({ companyId, regularizationStatus: 'pending' }).populate('employeeId', 'fullName employeeCode').sort('regularization.requestedAt').limit(max).lean(),
    Attendance.find({ companyId, $or: [{ missedPunchType: 'sign_out' }, { status: 'incomplete', signInTime: { $exists: true }, signOutTime: { $exists: false } }] }).populate('employeeId', 'fullName employeeCode').sort('-date').limit(max).lean(),
    BiometricPunch.find({ companyId, processingStatus: { $in: ['unmapped', 'error'] } }).sort('-punchTime').limit(max).lean(),
    EmployeeExit.find({ companyId, status: { $in: ['pending_approval', 'hr_review', 'clearance'] } }).populate('employeeId', 'fullName employeeCode').sort('createdAt').limit(max).lean(),
    Employee.find({ companyId, status: 'active', joiningDate: { $gte: probationStart, $lte: probationEnd } }).select('fullName employeeCode joiningDate department').sort('joiningDate').limit(max).lean(),
    Payslip.find({ companyId, month, year, status: { $in: ['draft', 'pending_approval'] } }).populate('employeeId', 'fullName employeeCode').sort('createdAt').limit(max).lean(),
    Notification.find({ companyId, 'delivery.email.status': 'failed' }).populate('recipientId', 'fullName employeeCode').sort('-createdAt').limit(max).lean(),
    BiometricSyncState.find({ companyId }).sort('-updatedAt').lean(),
  ]);

  const staleBefore = new Date(now.getTime() - 15 * 60 * 1000);
  const deviceAlerts = syncStates.filter((s) => !s.lastSuccessfulSync || s.lastSuccessfulSync < staleBefore);
  const groups = [
    { key: 'leaves', title: 'Pending Leaves', link: '/leaves', items: leaves.map(x => item(x._id, x.employeeId?.fullName || x.employeeName || 'Employee', `${x.leaveType} leave · ${x.totalDays} day(s)`, x.createdAt, '/leaves')) },
    { key: 'regularizations', title: 'Attendance Regularizations', link: '/attendance/approvals', items: regularizations.map(x => item(x._id, x.employeeId?.fullName || x.employeeName || 'Employee', `${x.shiftDate} · ${x.regularization?.requestType || 'time correction'}`, x.regularization?.requestedAt, '/attendance/approvals')) },
    { key: 'missing_signouts', title: 'Missing Sign-outs', link: '/attendance', items: missingSignOuts.map(x => item(x._id, x.employeeId?.fullName || x.employeeName || 'Employee', `${x.shiftDate} · Sign-out requires review`, x.date, '/attendance', 'danger')) },
    { key: 'biometric', title: 'Biometric Issues', link: '/settings', items: [
      ...biometricIssues.map(x => item(x._id, `Device user ${x.deviceUserId}`, `${x.processingStatus}: ${x.error || 'Employee mapping required'}`, x.punchTime, '/employees', 'danger')),
      ...deviceAlerts.map(x => item(x._id, `Device ${x.deviceId}`, 'Biometric sync has not completed in the last 15 minutes.', x.lastSuccessfulSync || x.updatedAt, '/settings', 'danger')),
    ].slice(0, max) },
    { key: 'exits', title: 'Resignations & Clearances', link: '/exits', items: exits.map(x => item(x._id, x.employeeId?.fullName || 'Employee', x.status.replaceAll('_', ' '), x.createdAt, '/exits')) },
    { key: 'probation', title: 'Probation Ending', link: '/employees', items: probation.map(x => { const end = new Date(x.joiningDate); end.setMonth(end.getMonth() + 3); return item(x._id, x.fullName, `${x.department} · ends ${end.toLocaleDateString('en-PK')}`, end, '/employees', 'info'); }) },
    { key: 'payroll', title: 'Payroll Pending', link: '/payroll', items: payroll.map(x => item(x._id, x.employeeId?.fullName || 'Employee', `${x.status.replaceAll('_', ' ')} · ${month}/${year}`, x.createdAt, '/payroll')) },
    { key: 'email', title: 'Failed Emails', link: '/notifications', items: failedEmails.map(x => item(x._id, x.recipientId?.fullName || 'Recipient', `${x.title}: ${x.delivery?.email?.error || 'Delivery failed'}`, x.createdAt, '/notifications', 'danger')) },
  ];
  return { generatedAt: now, total: groups.reduce((sum, g) => sum + g.items.length, 0), groups };
}

module.exports = { getActionCenter };

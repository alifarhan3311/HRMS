const Employee = require('../modules/employees/employees.model');
const Attendance = require('../modules/attendance/attendance.model');
const LeaveRequest = require('../modules/leaves/leaves.model');
const Holiday = require('../modules/holidays/holidays.model');
const notificationService = require('../modules/notifications/notifications.service');
const settingsService = require('../modules/companySettings/companySettings.service');
const logger = require('../utils/logger');
const { appliesToEmployee } = require('../modules/attendance/closurePolicy');

const DAY_MS = 24 * 60 * 60 * 1000;
const AUTOMATION_INTERVAL_MS = Number(process.env.HR_AUTOMATION_INTERVAL_MS)
  || 6 * 60 * 60 * 1000;
const LOOKBACK_DAYS = Math.min(Number(process.env.ATTENDANCE_RECONCILIATION_DAYS) || 7, 31);

const BALANCE_TYPES = ['paid', 'casual', 'sick', 'annual'];

function startOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

async function processCalendarYearLeaveCycles(now = new Date()) {
  const employees = await Employee.find({
    status: 'active',
    joiningDate: { $lte: now },
  });

  let updated = 0;
  const policyCache = new Map();
  for (const employee of employees) {
    const companyKey = String(employee.companyId);
    if (!policyCache.has(companyKey)) {
      policyCache.set(companyKey, await settingsService.getPolicy(employee.companyId));
    }
    const policy = policyCache.get(companyKey).leavePolicy;
    const year = now.getFullYear();

    // Migrate legacy joining-anniversary cycles into a clean current-year
    // baseline. Their old carry is not valid under the calendar-year policy.
    if (employee.leaveCycle?.basis !== 'calendar_year') {
      for (const type of BALANCE_TYPES) {
        employee.set(`leaveBalance.${type}.available`, policy.entitlements[type] || 0);
      }
      employee.leaveCycle = {
        basis: 'calendar_year',
        lastProcessedYear: year,
        lastProcessedAt: now,
        nextResetDate: new Date(Date.UTC(year + 1, 0, 1)),
        carriedForward: {},
      };
      await employee.save();
      updated += 1;
      continue;
    }

    if ((employee.leaveCycle?.lastProcessedYear || 0) >= year) continue;

    const carriedForward = {};
    for (const type of BALANCE_TYPES) {
      const entitlement = policy.entitlements[type] || 0;
      const balance = employee.leaveBalance?.[type] || {};
      const remaining = Math.max((balance.available || 0) - (balance.used || 0), 0);
      const eligible = policy.carryForwardTypes.includes(type);
      const carried = eligible ? Math.min(remaining, policy.maxCarryForward[type] || 0) : 0;
      carriedForward[type] = carried;
      employee.set(`leaveBalance.${type}.available`, entitlement + carried);
      employee.set(`leaveBalance.${type}.used`, 0);
    }

    employee.leaveCycle = {
      basis: 'calendar_year',
      lastProcessedYear: year,
      lastProcessedAt: now,
      nextResetDate: new Date(Date.UTC(year + 1, 0, 1)),
      carriedForward,
    };
    await employee.save();

    await notificationService.createNotification({
      recipientId: employee._id,
      companyId: employee.companyId,
      type: 'leave_balance_updated',
      title: 'Leave balance updated',
      message: 'Your unused leaves were carried forward and the new calendar-year leave cycle is now active.',
      link: '/leaves',
      metadata: { cycleYear: year, carriedForward },
      dedupeKey: `leave-calendar-year:${employee._id}:${year}`,
    });
    updated += 1;
  }

  return updated;
}

// Backwards-compatible export name for any existing callers.
const processLeaveAnniversaries = processCalendarYearLeaveCycles;

async function reconcileAttendance(now = new Date()) {
  const superAdminIds = await Employee.find({ role: 'super_admin' }).distinct('_id');
  if (superAdminIds.length) {
    const openSuperAdminRecords = await Attendance.find({
      employeeId: { $in: superAdminIds },
      signInTime: { $exists: true },
      signOutTime: { $exists: false },
      $or: [
        { scheduledEnd: { $lte: now } },
        { scheduledEnd: { $exists: false }, signInTime: { $lte: new Date(now.getTime() - DAY_MS) } },
      ],
    });
    for (const record of openSuperAdminRecords) {
      const fallbackEnd = new Date(new Date(record.signInTime).getTime() + (8 * 60 * 60 * 1000));
      const automaticSignOut = record.scheduledEnd && new Date(record.scheduledEnd) > new Date(record.signInTime)
        ? new Date(record.scheduledEnd)
        : fallbackEnd;
      const workedMinutes = Math.max(0, Math.round((automaticSignOut - new Date(record.signInTime)) / 60000));
      record.signOutTime = automaticSignOut;
      record.totalHours = Number((workedMinutes / 60).toFixed(2));
      record.workedMinutes = workedMinutes;
      record.status = 'present';
      record.lateMinutes = 0;
      record.earlyLeaveMinutes = 0;
      record.overtimeMinutes = 0;
      record.notes = `${record.notes || ''} [Attendance-exempt Super Admin shift auto-closed without penalty.]`.trim();
      await record.save();
    }
    await Promise.all([
      Employee.updateMany({ _id: { $in: superAdminIds } }, { $set: { lateCount: 0 } }),
      Attendance.updateMany({
        employeeId: { $in: superAdminIds },
        status: { $in: ['late', 'absent', 'half_day'] },
      }, {
        $set: { status: 'present', lateMinutes: 0, earlyLeaveMinutes: 0, overtimeMinutes: 0 },
        $unset: { missedPunchType: '', lateCountAppliedAt: '' },
      }),
    ]);
  }

  const employees = await Employee.find({ status: 'active', role: { $ne: 'super_admin' } })
    .select('_id companyId branchId joiningDate department shiftId');
  if (!employees.length) return 0;
  const employeeIds = employees.map((employee) => employee._id);

  const policyCache = new Map();
  for (const employee of employees) {
    const key = String(employee.companyId);
    if (!policyCache.has(key)) {
      policyCache.set(key, await settingsService.getPolicy(employee.companyId));
    }
  }

  let created = 0;
  for (let daysAgo = LOOKBACK_DAYS; daysAgo >= 1; daysAgo -= 1) {
    const date = startOfDay(new Date(now.getTime() - daysAgo * DAY_MS));
    const dayEnd = endOfDay(date);
    const [holidays, approvedLeaves] = await Promise.all([
      Holiday.find({ date: { $gte: date, $lte: dayEnd }, status: 'confirmed' })
        .select('companyId eventType affectedScope affectedDepartment affectedShiftId'),
      LeaveRequest.find({
        status: 'approved',
        startDate: { $lte: dayEnd },
        endDate: { $gte: date },
      }).select('employeeId'),
    ]);
    const employeesOnLeave = new Set(approvedLeaves.map((item) => String(item.employeeId)));

    const operations = employees
      .filter((employee) => new Date(employee.joiningDate) <= dayEnd)
      .filter((employee) => !holidays.some((holiday) => (
        String(holiday.companyId) === String(employee.companyId)
        && (!holiday.eventType || holiday.eventType === 'full_day')
        && appliesToEmployee(holiday, employee)
      )))
      .filter((employee) => {
        const settings = policyCache.get(String(employee.companyId));
        return !settings.timing.weekendDays.includes(date.getDay());
      })
      .map((employee) => {
        const onLeave = employeesOnLeave.has(String(employee._id));
        return ({
        updateOne: {
          filter: { employeeId: employee._id, date: { $gte: date, $lte: dayEnd } },
          update: {
            $setOnInsert: {
              employeeId: employee._id,
              companyId: employee.companyId,
              branchId: employee.branchId,
              date,
              status: onLeave ? 'on_leave' : 'late',
              method: 'manual',
              ...(!onLeave && { missedPunchType: 'sign_in' }),
              notes: onLeave
                ? 'Approved leave recorded by HR automation.'
                : 'Missed sign-in: automatically counted as a late violation.',
            },
          },
          upsert: true,
        },
      });
      });

    if (operations.length) {
      const result = await Attendance.bulkWrite(operations, { ordered: false });
      created += result.upsertedCount || 0;
    }

    await Attendance.updateMany({
      employeeId: { $in: employeeIds },
      date: { $gte: date, $lte: dayEnd },
      signInTime: { $exists: true },
      signOutTime: { $exists: false },
      status: { $nin: ['on_leave', 'holiday', 'weekend'] },
    }, {
      $set: {
        status: 'late',
        missedPunchType: 'sign_out',
        notes: 'Missed sign-out: automatically counted as a late violation. Submit a regularization request if needed.',
      },
    });

    const violations = await Attendance.find({
      employeeId: { $in: employeeIds },
      date: { $gte: date, $lte: dayEnd },
      missedPunchType: { $in: ['sign_in', 'sign_out'] },
      lateCountAppliedAt: { $exists: false },
    }).select('_id employeeId companyId missedPunchType date');
    for (const violation of violations) {
      const claimed = await Attendance.findOneAndUpdate(
        { _id: violation._id, lateCountAppliedAt: { $exists: false } },
        { $set: { lateCountAppliedAt: now } },
        { new: true },
      );
      if (!claimed) continue;
      await Employee.updateOne({ _id: violation.employeeId }, { $inc: { lateCount: 1 } });
      await notificationService.createNotification({
        recipientId: violation.employeeId,
        companyId: violation.companyId,
        type: 'attendance_missed_punch',
        title: violation.missedPunchType === 'sign_in' ? 'Missed sign-in counted as late' : 'Missed sign-out counted as late',
        message: `Your missed ${violation.missedPunchType === 'sign_in' ? 'sign-in' : 'sign-out'} on ${violation.date.toLocaleDateString('en-GB')} was counted as one late. You can submit a regularization request.`,
        link: '/attendance',
        metadata: { attendanceId: violation._id, missedPunchType: violation.missedPunchType },
        dedupeKey: `attendance-missed-punch:${violation._id}`,
      });
    }
  }

  return created;
}

async function sendMissingLeaveApplicationReminders(now = new Date()) {
  const scanStart = startOfDay(new Date(now.getTime() - 120 * DAY_MS));
  const employeeIds = await Employee.find({ role: { $ne: 'super_admin' } }).distinct('_id');
  const absences = await Attendance.find({
    employeeId: { $in: employeeIds },
    status: 'absent',
    date: { $gte: scanStart, $lte: endOfDay(new Date(now.getTime() - DAY_MS)) },
    leaveApplicationReminderSentAt: null,
  }).limit(2000);

  let notified = 0;
  const policyCache = new Map();
  for (const attendance of absences) {
    const companyKey = String(attendance.companyId);
    if (!policyCache.has(companyKey)) {
      policyCache.set(companyKey, await settingsService.getPolicy(attendance.companyId));
    }
    const reminderDays = policyCache.get(companyKey).leavePolicy.delayedApplicationReminderDays;
    const deadline = endOfDay(new Date(attendance.date.getTime() + reminderDays * DAY_MS));
    if (now <= deadline) continue;

    const dayStart = startOfDay(attendance.date);
    const dayEnd = endOfDay(attendance.date);
    const leaveExists = await LeaveRequest.exists({
      employeeId: attendance.employeeId,
      status: { $in: ['pending', 'approved'] },
      startDate: { $lte: dayEnd },
      endDate: { $gte: dayStart },
    });

    if (!leaveExists) {
      await notificationService.createNotification({
        recipientId: attendance.employeeId,
        companyId: attendance.companyId,
        type: 'pending_leave_application',
        title: 'Leave application pending',
        message: `You were absent on ${dayStart.toLocaleDateString('en-GB')} and have not submitted a leave application within 3 days.`,
        link: '/leaves',
        metadata: { attendanceId: attendance._id, absenceDate: dayStart },
        dedupeKey: `missing-leave:${attendance._id}`,
      });
      notified += 1;
    }

    attendance.leaveApplicationReminderSentAt = now;
    await attendance.save();
  }

  return notified;
}

async function runHrAutomation(now = new Date()) {
  const leaveCyclesUpdated = await processCalendarYearLeaveCycles(now);
  const attendanceCreated = await reconcileAttendance(now);
  const remindersSent = await sendMissingLeaveApplicationReminders(now);
  const result = { leaveCyclesUpdated, attendanceCreated, remindersSent };
  logger.info('[hr-automation] Cycle completed', result);
  return result;
}

function startHrAutomation() {
  if (process.env.HR_AUTOMATION_ENABLED === 'false') {
    logger.info('[hr-automation] Disabled by environment configuration');
    return () => {};
  }

  runHrAutomation().catch((error) => {
    logger.error('[hr-automation] Initial cycle failed', { error: error.message });
  });

  const timer = setInterval(() => {
    runHrAutomation().catch((error) => {
      logger.error('[hr-automation] Scheduled cycle failed', { error: error.message });
    });
  }, AUTOMATION_INTERVAL_MS);
  timer.unref();

  return () => clearInterval(timer);
}

module.exports = {
  processCalendarYearLeaveCycles,
  processLeaveAnniversaries,
  reconcileAttendance,
  sendMissingLeaveApplicationReminders,
  runHrAutomation,
  startHrAutomation,
};

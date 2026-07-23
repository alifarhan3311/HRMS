const Employee = require('../modules/employees/employees.model');
const Attendance = require('../modules/attendance/attendance.model');
const LeaveRequest = require('../modules/leaves/leaves.model');
const Holiday = require('../modules/holidays/holidays.model');
const notificationService = require('../modules/notifications/notifications.service');
const { sendCompanyMail } = require('../config/mailer');
const settingsService = require('../modules/companySettings/companySettings.service');
const logger = require('../utils/logger');
const { appliesToEmployee } = require('../modules/attendance/closurePolicy');

const DAY_MS = 24 * 60 * 60 * 1000;
const AUTOMATION_INTERVAL_MS = Number(process.env.HR_AUTOMATION_INTERVAL_MS)
  || 6 * 60 * 60 * 1000;
const LOOKBACK_DAYS = Math.min(Number(process.env.ATTENDANCE_RECONCILIATION_DAYS) || 7, 31);
const BIRTHDAY_CHECK_INTERVAL_MS = 60 * 1000;

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

function zonedCalendarParts(value, timeZone = 'Asia/Karachi') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value)).reduce((parts, part) => {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
    return parts;
  }, {});
}

function addCalendarDay(parts) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1, 12));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function birthdayDateContext(now, timeZone) {
  const today = zonedCalendarParts(now, timeZone);
  const tomorrow = addCalendarDay(today);
  return {
    today,
    tomorrow,
    todayKey: `${today.year}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`,
    isMidnightMinute: today.hour === 0 && today.minute === 0,
  };
}

function birthMonthDay(value) {
  const date = new Date(value);
  return { month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[char]);
}

async function createBirthdayNotification({ data, emailEnabled, email, subject, html }) {
  const notification = await notificationService.createNotification(data);
  if (!emailEnabled || !email || notification.delivery?.email?.status === 'sent') {
    return { notification, emailed: false };
  }

  notification.delivery.email = { status: 'pending' };
  await notification.save();
  try {
    await sendCompanyMail(data.companyId, { to: email, subject, html });
    notification.delivery.email = { status: 'sent', sentAt: new Date() };
    await notification.save();
    return { notification, emailed: true };
  } catch (error) {
    notification.delivery.email = { status: 'failed', error: error.message };
    await notification.save();
    logger.error('[birthday-automation] Email delivery failed', {
      recipientId: String(data.recipientId),
      type: data.type,
      error: error.message,
    });
    return { notification, emailed: false };
  }
}

async function processBirthdayNotifications(now = new Date(), { force = false } = {}) {
  const companyIds = await Employee.find({
    status: 'active',
    dateOfBirth: { $exists: true, $ne: null },
  }).distinct('companyId');
  let employeeWishes = 0;
  let hrAlerts = 0;

  for (const companyId of companyIds) {
    const settings = await settingsService.getPolicy(companyId);
    const timeZone = settings.company?.timezone || 'Asia/Karachi';
    const context = birthdayDateContext(now, timeZone);
    if (!force && !context.isMidnightMinute) continue;

    const employees = await Employee.find({
      companyId,
      status: 'active',
      dateOfBirth: { $exists: true, $ne: null },
    }).select('_id fullName email dateOfBirth');
    const todaysBirthdays = employees.filter((employee) => {
      const dob = birthMonthDay(employee.dateOfBirth);
      return dob.month === context.today.month && dob.day === context.today.day;
    });
    const tomorrowsBirthdays = employees.filter((employee) => {
      const dob = birthMonthDay(employee.dateOfBirth);
      return dob.month === context.tomorrow.month && dob.day === context.tomorrow.day;
    });

    for (const employee of todaysBirthdays) {
      const wish = `Wishing you a beautiful birthday filled with happiness, success, and wonderful moments. May the year ahead bring you endless reasons to smile. Have an amazing day!`;
      await createBirthdayNotification({
        data: {
          recipientId: employee._id,
          companyId,
          type: 'birthday_wish',
          title: `🎉 Happy Birthday, ${employee.fullName}!`,
          message: `${wish} 🎂✨`,
          link: '/notifications',
          metadata: { birthdayDate: context.todayKey },
          dedupeKey: `birthday-wish:${employee._id}:${context.today.year}`,
        },
        emailEnabled: settings.notifications?.emailEnabled === true,
        email: employee.email,
        subject: `Happy Birthday, ${employee.fullName}! 🎉`,
        html: `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#2f2a24"><h2 style="color:#d49a16">Happy Birthday, ${escapeHtml(employee.fullName)}! 🎉</h2><p>${wish}</p><p>May your special day be as wonderful as you are. 🎂✨</p><p>Warm wishes,<br><strong>HR Team</strong></p></div>`,
      });
      employeeWishes += 1;
    }

    if (tomorrowsBirthdays.length) {
      let hrRecipients = await Employee.find({
        companyId,
        role: 'hr',
        status: 'active',
      }).select('_id fullName email');
      if (!hrRecipients.length) {
        hrRecipients = await Employee.find({
          companyId,
          role: 'super_admin',
          status: 'active',
        }).select('_id fullName email');
      }
      for (const birthdayEmployee of tomorrowsBirthdays) {
        for (const hr of hrRecipients) {
          const reminder = `${birthdayEmployee.fullName}'s birthday is tomorrow. A thoughtful wish or a small celebration would make their day extra special.`;
          await createBirthdayNotification({
            data: {
              recipientId: hr._id,
              companyId,
              type: 'birthday_upcoming',
              title: '🎈 Birthday reminder for tomorrow',
              message: `${reminder} 🎂`,
              link: '/employees',
              metadata: {
                employeeId: birthdayEmployee._id,
                birthdayMonth: context.tomorrow.month,
                birthdayDay: context.tomorrow.day,
              },
              dedupeKey: `birthday-hr-reminder:${birthdayEmployee._id}:${hr._id}:${context.tomorrow.year}`,
            },
            emailEnabled: settings.notifications?.emailEnabled === true,
            email: hr.email,
            subject: `Birthday reminder: ${birthdayEmployee.fullName} 🎂`,
            html: `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#2f2a24"><h2 style="color:#d49a16">Birthday reminder for tomorrow 🎈</h2><p>Hello ${escapeHtml(hr.fullName || 'HR Team')},</p><p><strong>${escapeHtml(birthdayEmployee.fullName)}</strong>'s birthday is tomorrow.</p><p>A thoughtful wish or a small celebration would make their day extra special. 🎂</p><p>Regards,<br><strong>HRMS</strong></p></div>`,
          });
          hrAlerts += 1;
        }
      }
    }
  }
  return { employeeWishes, hrAlerts };
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
    .select('_id fullName employeeCode companyId branchId joiningDate department shiftId');
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
        $or: [
          { dutyDates: date.toISOString().slice(0, 10) },
          {
            $and: [
              { $or: [{ dutyDates: { $exists: false } }, { dutyDates: { $size: 0 } }] },
              { startDate: { $lte: dayEnd } },
              { endDate: { $gte: date } },
            ],
          },
        ],
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
              employeeName: employee.fullName,
              employeeCode: employee.employeeCode,
              companyId: employee.companyId,
              branchId: employee.branchId,
              date,
              status: onLeave ? 'on_leave' : 'absent',
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

    const expiredOpenRecords = await Attendance.find({
      employeeId: { $in: employeeIds },
      date: { $gte: date, $lte: dayEnd },
      signInTime: { $exists: true },
      signOutTime: { $exists: false },
      // Overnight and late shifts can still be legitimately open when the
      // calendar-day automation runs. Do not flag a missed sign-out until the
      // employee's own scheduled shift end has actually passed.
      $or: [
        { scheduledEnd: { $lte: now } },
        { scheduledEnd: { $exists: false } },
      ],
      status: { $nin: ['on_leave', 'holiday', 'weekend'] },
    });
    for (const record of expiredOpenRecords) {
      const automaticSignOut = record.scheduledEnd && new Date(record.scheduledEnd) > new Date(record.signInTime)
        ? new Date(record.scheduledEnd)
        : new Date(new Date(record.signInTime).getTime() + Number(record.shiftRequiredMinutes || 480) * 60000);
      const clockMinutes = Math.max(0, Math.round((automaticSignOut - new Date(record.signInTime)) / 60000));
      const workedMinutes = Math.max(0, clockMinutes - Number(record.shiftBreakMinutes || 0));
      record.signOutTime = automaticSignOut;
      record.totalHours = Number((clockMinutes / 60).toFixed(2));
      record.workedMinutes = workedMinutes;
      record.overtimeMinutes = Math.max(0, workedMinutes - Number(record.shiftOvertimeAfterMinutes || record.shiftRequiredMinutes || 480));
      record.status = Number(record.lateMinutes || 0) > 0 ? 'late' : 'present';
      record.missedPunchType = 'sign_out';
      record.notes = 'Missed sign-out: shift was automatically closed at its scheduled end. Submit a regularization request if needed.';
      await record.save();
    }

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
  processBirthdayNotifications().catch((error) => {
    logger.error('[birthday-automation] Initial check failed', { error: error.message });
  });

  const timer = setInterval(() => {
    runHrAutomation().catch((error) => {
      logger.error('[hr-automation] Scheduled cycle failed', { error: error.message });
    });
  }, AUTOMATION_INTERVAL_MS);
  timer.unref();

  const delayToNextMinute = BIRTHDAY_CHECK_INTERVAL_MS - (Date.now() % BIRTHDAY_CHECK_INTERVAL_MS);
  let birthdayTimer;
  const birthdayStartTimer = setTimeout(() => {
    processBirthdayNotifications().catch((error) => {
      logger.error('[birthday-automation] Scheduled check failed', { error: error.message });
    });
    birthdayTimer = setInterval(() => {
      processBirthdayNotifications().catch((error) => {
        logger.error('[birthday-automation] Scheduled check failed', { error: error.message });
      });
    }, BIRTHDAY_CHECK_INTERVAL_MS);
    birthdayTimer.unref();
  }, delayToNextMinute);
  birthdayStartTimer.unref();

  return () => {
    clearInterval(timer);
    clearTimeout(birthdayStartTimer);
    if (birthdayTimer) clearInterval(birthdayTimer);
  };
}

module.exports = {
  processCalendarYearLeaveCycles,
  processLeaveAnniversaries,
  reconcileAttendance,
  sendMissingLeaveApplicationReminders,
  birthdayDateContext,
  processBirthdayNotifications,
  runHrAutomation,
  startHrAutomation,
};

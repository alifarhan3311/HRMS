require('dotenv').config();
const mongoose = require('mongoose');

function dateKey(value, timeZone = 'Asia/Karachi') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value)).reduce((result, part) => {
    if (part.type !== 'literal') result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function buildSessions(punches, requiredMinutes, halfDayMinutes, timeZone) {
  const sessions = [];
  let current = null;
  for (const punch of punches) {
    const at = new Date(punch.punchTime);
    if (!current) {
      current = { shiftDate: dateKey(at, timeZone), signIn: punch };
      continue;
    }
    const elapsed = Math.round((at - new Date(current.signIn.punchTime)) / 60000);
    const sameDutyDate = dateKey(at, timeZone) === current.shiftDate;
    const withinCrossDayRecovery = elapsed <= requiredMinutes + 240;
    if (elapsed >= halfDayMinutes && (sameDutyDate || withinCrossDayRecovery)) {
      current.signOut = punch;
      sessions.push(current);
      current = null;
    }
  }
  if (current) sessions.push(current);
  return sessions;
}

async function repair() {
  const targetId = process.env.TARGET_EMPLOYEE_ID;
  if (!mongoose.isValidObjectId(targetId)) throw new Error('TARGET_EMPLOYEE_ID is required.');
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000, family: 4,
  });
  const db = mongoose.connection.db;
  const employees = db.collection('employees');
  const attendance = db.collection('attendances');
  const biometric = db.collection('biometricpunches');
  const shifts = db.collection('shifts');
  const employee = await employees.findOne({ _id: new mongoose.Types.ObjectId(targetId) });
  const shift = await shifts.findOne({ _id: employee.shiftId });
  if (!employee || shift?.shiftType !== 'flexible') throw new Error('Target must be a flexible-shift employee.');

  const records = await attendance.find({
    employeeId: employee._id, method: 'biometric',
  }).sort({ signInTime: 1 }).toArray();
  const firstPunch = records[0]?.signInTime;
  const punches = await biometric.find({
    employeeId: employee._id,
    punchTime: { $gte: firstPunch },
    processingStatus: { $in: ['processed', 'ignored'] },
  }).sort({ punchTime: 1 }).toArray();
  const required = Number(shift.requiredMinutes || 480);
  const half = Number(shift.halfDayMinutes || Math.ceil(required / 2));
  const timeZone = process.env.ZKTECO_TIMEZONE || 'Asia/Karachi';
  const sessions = buildSessions(punches, required, half, timeZone);
  if (sessions.length !== records.length) {
    throw new Error(`Safe repair stopped: ${sessions.length} audited sessions do not match ${records.length} records.`);
  }

  const plan = sessions.map((session, index) => {
    const record = records[index];
    const signIn = new Date(session.signIn.punchTime);
    const signOut = session.signOut ? new Date(session.signOut.punchTime) : null;
    const workedMinutes = signOut ? Math.round((signOut - signIn) / 60000) : 0;
    return {
      recordId: record._id,
      shiftDate: session.shiftDate,
      signIn,
      signOut,
      workedMinutes,
      status: signOut ? (workedMinutes >= required ? 'present' : workedMinutes >= half ? 'half_day' : 'absent') : 'present',
      signInPunchId: session.signIn._id,
      signOutPunchId: session.signOut?._id,
    };
  });
  console.log(JSON.stringify({ employee: employee.fullName, apply: process.env.APPLY === 'true', plan }, null, 2));
  if (process.env.APPLY !== 'true') return;

  for (const item of plan) {
    const update = {
      date: new Date(`${item.shiftDate}T12:00:00.000Z`),
      shiftDate: item.shiftDate,
      scheduledStart: item.signIn,
      scheduledEnd: new Date(item.signIn.getTime() + required * 60000),
      signInTime: item.signIn,
      workedMinutes: item.workedMinutes,
      totalHours: Number((item.workedMinutes / 60).toFixed(2)),
      status: item.status,
      autoClosedAt: null,
      missedPunchType: null,
    };
    if (item.signOut) update.signOutTime = item.signOut;
    await attendance.updateOne(
      { _id: item.recordId },
      item.signOut ? { $set: update } : { $set: update, $unset: { signOutTime: 1 } },
    );
    await biometric.updateOne(
      { _id: item.signInPunchId },
      { $set: { attendanceId: item.recordId, attendanceAction: 'sign_in', processingStatus: 'processed' } },
    );
    if (item.signOutPunchId) {
      await biometric.updateOne(
        { _id: item.signOutPunchId },
        { $set: { attendanceId: item.recordId, attendanceAction: 'sign_out', processingStatus: 'processed' } },
      );
    }
  }
  console.log(JSON.stringify({ repairedSessions: plan.length }, null, 2));
}

repair()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());

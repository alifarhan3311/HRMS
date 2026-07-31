require('dotenv').config();
const mongoose = require('mongoose');

function arrivalStatus(record) {
  const arrivalMinutes = Math.max(
    0,
    Math.floor((new Date(record.signInTime) - new Date(record.scheduledStart)) / 60000),
  );
  if (arrivalMinutes > Number(record.shiftLateHalfDayAfterMinutes || 0)) return 'half_day';
  if (arrivalMinutes > Number(record.shiftGraceMinutes || 0)) return 'late';
  return 'present';
}

function completionTolerance(record, requiredMinutes) {
  return record.shiftType === 'fixed' && requiredMinutes > 420 ? 15 : 0;
}

async function repair() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGO_URI (or MONGODB_URI) is not configured.');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, family: 4 });
  const collection = mongoose.connection.db.collection('attendances');
  const records = await collection.find({
    shiftType: 'fixed',
    signInTime: { $exists: true },
    signOutTime: { $exists: true },
    scheduledStart: { $exists: true },
    scheduledEnd: { $exists: true },
    status: { $in: ['present', 'late', 'half_day', 'incomplete'] },
  }).project({
    employeeName: 1,
    shiftDate: 1,
    status: 1,
    signInTime: 1,
    signOutTime: 1,
    scheduledStart: 1,
    scheduledEnd: 1,
    shiftGraceMinutes: 1,
    shiftLateHalfDayAfterMinutes: 1,
    shiftType: 1,
    shiftRequiredMinutes: 1,
    effectiveRequiredMinutes: 1,
    workedMinutes: 1,
  }).toArray();

  const corrections = records
    .filter((record) => {
      const requiredMinutes = Number(record.effectiveRequiredMinutes || record.shiftRequiredMinutes || 480);
      const workedMinutes = Number.isFinite(Number(record.workedMinutes))
        ? Number(record.workedMinutes)
        : Math.max(0, Math.round((new Date(record.signOutTime) - new Date(record.signInTime)) / 60000));
      return new Date(record.signOutTime) >= new Date(record.scheduledEnd)
        || workedMinutes >= requiredMinutes - completionTolerance(record, requiredMinutes);
    })
    .map((record) => ({ record, correctedStatus: arrivalStatus(record) }))
    .filter(({ record, correctedStatus }) => correctedStatus !== record.status);

  console.log(JSON.stringify({
    scannedCompletedFixedShifts: records.length,
    incorrectStatuses: corrections.length,
    apply: process.env.APPLY === 'true',
    corrections: corrections.map(({ record, correctedStatus }) => ({
      id: record._id,
      employeeName: record.employeeName,
      shiftDate: record.shiftDate,
      from: record.status,
      to: correctedStatus,
    })),
  }, null, 2));

  if (process.env.APPLY !== 'true') return;
  if (corrections.length) {
    await collection.bulkWrite(corrections.map(({ record, correctedStatus }) => ({
      updateOne: {
        filter: { _id: record._id },
        update: { $set: { status: correctedStatus } },
      },
    })), { ordered: false });
  }
  console.log(JSON.stringify({ corrected: corrections.length }, null, 2));
}

repair()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());

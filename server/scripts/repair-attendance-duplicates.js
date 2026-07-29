require('dotenv').config();
const mongoose = require('mongoose');

function dutyDate(record) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(record.shiftDate || '')) return record.shiftDate;
  return new Date(record.date).toISOString().slice(0, 10);
}

function isEmptyAutomaticAbsence(record) {
  return record.status === 'absent'
    && !record.signInTime
    && !record.signOutTime
    && (
      /automatically reconciled by hr automation/i.test(record.notes || '')
      || /missed sign-in/i.test(record.notes || '')
    );
}

async function repair() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGO_URI (or MONGODB_URI) is not configured.');

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, family: 4 });
  const collection = mongoose.connection.db.collection('attendances');
  const records = await collection.find({}).project({
    employeeId: 1,
    date: 1,
    shiftDate: 1,
    status: 1,
    signInTime: 1,
    signOutTime: 1,
    notes: 1,
  }).toArray();

  const groups = new Map();
  records.forEach((record) => {
    const key = `${record.employeeId}:${dutyDate(record)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  });

  const duplicateIds = [];
  groups.forEach((group) => {
    if (group.length < 2) return;
    const hasRealAttendance = group.some((record) => record.signInTime || record.signOutTime);
    if (!hasRealAttendance) return;
    group.filter(isEmptyAutomaticAbsence).forEach((record) => duplicateIds.push(record._id));
  });

  const duplicateSet = new Set(duplicateIds.map(String));
  const backfills = records
    .filter((record) => !duplicateSet.has(String(record._id)))
    .filter((record) => !/^\d{4}-\d{2}-\d{2}$/.test(record.shiftDate || ''))
    .map((record) => ({
      updateOne: {
        filter: { _id: record._id },
        update: { $set: { shiftDate: dutyDate(record) } },
      },
    }));

  const plan = {
    scanned: records.length,
    automaticDuplicateAbsences: duplicateIds.length,
    legacyShiftDatesToBackfill: backfills.length,
    apply: process.env.APPLY === 'true',
  };
  console.log(JSON.stringify(plan, null, 2));

  if (process.env.APPLY !== 'true') {
    console.log('Dry run only. Run with APPLY=true to apply this repair.');
    return;
  }

  if (duplicateIds.length) await collection.deleteMany({ _id: { $in: duplicateIds } });
  if (backfills.length) await collection.bulkWrite(backfills, { ordered: false });
  await collection.createIndex(
    { employeeId: 1, shiftDate: 1 },
    { unique: true, partialFilterExpression: { shiftDate: { $type: 'string' } } },
  );

  console.log(JSON.stringify({
    deletedAutomaticDuplicateAbsences: duplicateIds.length,
    backfilledShiftDates: backfills.length,
  }, null, 2));
}

repair()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());

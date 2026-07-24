require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGO_URI (or MONGODB_URI) is required.');
  await mongoose.connect(uri);

  const settingsCollection = mongoose.connection.collection('companysettings');
  const employeesCollection = mongoose.connection.collection('employees');
  const leavesCollection = mongoose.connection.collection('leaverequests');

  const settings = await settingsCollection.find({}).toArray();
  for (const record of settings) {
    const policy = record.leavePolicy || {};
    const hadCasual = (policy.enabledTypes || []).includes('casual');
    const enabledTypes = [...new Set((policy.enabledTypes || [])
      .map((type) => type === 'casual' ? 'annual' : type))];
    const carryForwardTypes = [...new Set((policy.carryForwardTypes || [])
      .map((type) => type === 'casual' ? 'annual' : type))];
    const entitlements = { ...(policy.entitlements || {}) };
    const maxCarryForward = { ...(policy.maxCarryForward || {}) };

    if (hadCasual) entitlements.annual = Number(entitlements.casual || 0);
    entitlements.casual = 0;
    if ((policy.carryForwardTypes || []).includes('casual')) {
      maxCarryForward.annual = Number(maxCarryForward.casual || 0);
    }
    maxCarryForward.casual = 0;

    await settingsCollection.updateOne({ _id: record._id }, {
      $set: {
        'leavePolicy.enabledTypes': enabledTypes,
        'leavePolicy.entitlements': entitlements,
        'leavePolicy.carryForwardTypes': carryForwardTypes,
        'leavePolicy.maxCarryForward': maxCarryForward,
      },
    });
  }

  const employees = await employeesCollection.find({}).toArray();
  for (const employee of employees) {
    const casual = employee.leaveBalance?.casual || {};
    const carriedForward = { ...(employee.leaveCycle?.carriedForward || {}) };
    const update = {
      'leaveBalance.casual.available': 0,
      'leaveBalance.casual.used': 0,
    };
    if (Number(casual.available || 0) || Number(casual.used || 0)) {
      update['leaveBalance.annual.available'] = Number(casual.available || 0);
      update['leaveBalance.annual.used'] = Number(casual.used || 0);
    }
    if (Object.prototype.hasOwnProperty.call(carriedForward, 'casual')) {
      carriedForward.annual = Number(carriedForward.casual || 0);
      delete carriedForward.casual;
      update['leaveCycle.carriedForward'] = carriedForward;
    }
    await employeesCollection.updateOne({ _id: employee._id }, { $set: update });
  }

  const leaveResult = await leavesCollection.updateMany(
    { leaveType: 'casual' },
    { $set: { leaveType: 'annual' } },
  );

  console.log(JSON.stringify({
    settingsMigrated: settings.length,
    employeesMigrated: employees.length,
    leaveRequestsMigrated: leaveResult.modifiedCount,
  }));
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});

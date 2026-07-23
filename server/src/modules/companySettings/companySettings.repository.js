const CompanySettings = require('./companySettings.model');

async function getOrCreate(companyId) {
  // Reads dominate this hot path (attendance, dashboard, settings). Avoid an
  // upsert/write lock for every read; only create when the document is absent.
  let settings = await CompanySettings.findOne({ companyId });
  if (!settings) {
    settings = await CompanySettings.findOneAndUpdate(
      { companyId },
      { $setOnInsert: { companyId } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  }
  // Earlier Canada-holiday work temporarily made the whole company timezone
  // Canadian. Operations are Pakistan-based; migrate that accidental value.
  if (settings.company?.timezone?.startsWith('America/')) {
    settings.company.timezone = 'Asia/Karachi';
    await settings.save();
  }
  return settings;
}

async function update(companyId, changes) {
  return CompanySettings.findOneAndUpdate(
    { companyId },
    { $set: changes, $setOnInsert: { companyId } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
}

async function addDepartment(companyId, name, updatedBy) {
  await getOrCreate(companyId);
  return CompanySettings.findOneAndUpdate(
    { companyId },
    {
      $addToSet: { departments: name },
      $set: { updatedBy },
    },
    { new: true, runValidators: true }
  );
}

module.exports = { getOrCreate, update, addDepartment };

const CompanySettings = require('./companySettings.model');

async function getOrCreate(companyId) {
  return CompanySettings.findOneAndUpdate(
    { companyId },
    { $setOnInsert: { companyId } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

async function update(companyId, changes) {
  return CompanySettings.findOneAndUpdate(
    { companyId },
    { $set: changes, $setOnInsert: { companyId } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
}

module.exports = { getOrCreate, update };

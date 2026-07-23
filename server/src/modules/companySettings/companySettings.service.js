const repository = require('./companySettings.repository');
const Employee = require('../employees/employees.model');

const BALANCE_TYPES = ['paid', 'casual', 'sick', 'annual'];

async function syncEmployeeEntitlements(companyId, entitlements) {
  const availableFields = Object.fromEntries(BALANCE_TYPES.map((type) => [
    `leaveBalance.${type}.available`,
    {
      $add: [
        Number(entitlements[type] || 0),
        {
          $cond: [
            {
              $and: [
                { $eq: ['$leaveCycle.basis', 'calendar_year'] },
                {
                  $gt: [
                    { $ifNull: ['$leaveCycle.lastProcessedYear', 0] },
                    { $year: '$joiningDate' },
                  ],
                },
              ],
            },
            { $ifNull: [`$leaveCycle.carriedForward.${type}`, 0] },
            0,
          ],
        },
      ],
    },
  ]));

  // A policy change affects the current entitlement of every employee in the
  // company. Keep used days and valid calendar-year carry-forward untouched.
  await Employee.updateMany(
    { companyId },
    [{ $set: availableFields }]
  );
}

function publicSettings(document) {
  const settings = document.toObject({ getters: true });
  const companyPasswordConfigured = Boolean(settings.smtp?.password);
  const environmentPasswordConfigured = Boolean(process.env.SMTP_PASS);
  const useCompanySmtp = companyPasswordConfigured;
  const environmentSmtp = {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    from: process.env.SMTP_FROM || '',
  };

  settings.smtp = {
    ...(useCompanySmtp ? settings.smtp : environmentSmtp),
    passwordConfigured: companyPasswordConfigured || environmentPasswordConfigured,
    source: useCompanySmtp ? 'company' : environmentPasswordConfigured ? 'environment' : 'none',
  };
  delete settings.smtp.password;
  delete settings.__v;
  return settings;
}

async function getSettings(companyId) {
  return publicSettings(await repository.getOrCreate(companyId));
}

async function getPolicy(companyId) {
  return repository.getOrCreate(companyId);
}

async function addDepartment(companyId, name, actorId) {
  return repository.addDepartment(companyId, name, actorId);
}

async function updateSettings(payload, actor) {
  const changes = { updatedBy: actor.id };
  for (const section of ['company', 'holidayPolicy', 'timing', 'leavePolicy', 'payrollPolicy', 'notifications', 'security']) {
    if (payload[section]) changes[section] = payload[section];
  }

  if (payload.smtp) {
    const current = await repository.getOrCreate(actor.companyId);
    const currentSmtp = current.smtp?.toObject?.({ getters: true }) || {};
    changes.smtp = {
      ...currentSmtp,
      ...payload.smtp,
    };
    if (Number(changes.smtp.port) === 465) changes.smtp.secure = true;
    if (!payload.smtp.password && currentSmtp.password) {
      changes.smtp.password = currentSmtp.password;
    } else if (!payload.smtp.password) {
      delete changes.smtp.password;
    }
  }

  const updated = await repository.update(actor.companyId, changes);
  if (payload.leavePolicy?.entitlements) {
    await syncEmployeeEntitlements(actor.companyId, payload.leavePolicy.entitlements);
  }
  return publicSettings(updated);
}

module.exports = { getSettings, getPolicy, addDepartment, updateSettings };

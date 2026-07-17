const repository = require('./companySettings.repository');

function publicSettings(document) {
  const settings = document.toObject({ getters: true });
  if (settings.smtp) {
    settings.smtp.passwordConfigured = Boolean(settings.smtp.password);
    delete settings.smtp.password;
  }
  delete settings.__v;
  return settings;
}

async function getSettings(companyId) {
  return publicSettings(await repository.getOrCreate(companyId));
}

async function getPolicy(companyId) {
  return repository.getOrCreate(companyId);
}

async function updateSettings(payload, actor) {
  const changes = { updatedBy: actor.id };
  for (const section of ['company', 'timing', 'leavePolicy', 'notifications', 'security']) {
    if (payload[section]) changes[section] = payload[section];
  }

  if (payload.smtp) {
    const current = await repository.getOrCreate(actor.companyId);
    const currentSmtp = current.smtp?.toObject?.({ getters: true }) || {};
    changes.smtp = {
      ...currentSmtp,
      ...payload.smtp,
    };
    if (!payload.smtp.password && currentSmtp.password) {
      changes.smtp.password = currentSmtp.password;
    } else if (!payload.smtp.password) {
      delete changes.smtp.password;
    }
  }

  return publicSettings(await repository.update(actor.companyId, changes));
}

module.exports = { getSettings, getPolicy, updateSettings };

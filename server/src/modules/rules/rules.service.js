const mongoose = require('mongoose');
const createHttpError = require('http-errors');
const Rule = require('./rules.model');
const { validatePayload } = require('./rules.validation');

function scope(actor) {
  if (!actor?.companyId) throw createHttpError(403, 'Company access is required.');
  return { companyId: actor.companyId, deletedAt: null };
}
function requireHR(actor) {
  if (actor?.role !== 'hr') throw createHttpError(403, 'Only HR can manage rules and regulations.');
}
function target(id, actor) {
  if (!mongoose.isObjectIdOrHexString(id)) throw createHttpError(400, 'Invalid rule ID.');
  return { ...scope(actor), _id: id };
}
async function list(actor) {
  return Rule.find(scope(actor)).sort({ createdAt: -1, _id: -1 }).lean();
}
async function create(payload, actor) {
  requireHR(actor);
  const data = validatePayload(payload, 'create');
  return Rule.create({ ...data, ...scope(actor), createdBy: actor.id, updatedBy: actor.id });
}
async function change(id, payload, actor, remove = false) {
  requireHR(actor);
  const { revision, ...data } = validatePayload(payload, remove ? 'delete' : 'update');
  const filter = target(id, actor);
  const record = await Rule.findOneAndUpdate({ ...filter, revision }, {
    $set: { ...(remove ? { deletedAt: new Date() } : data), updatedBy: actor.id },
    $inc: { revision: 1 },
  }, { new: true, runValidators: true });
  if (!record) {
    if (!await Rule.exists(filter)) throw createHttpError(404, 'Rule not found.');
    throw createHttpError(409, 'This rule has changed. Close the editor and reopen the latest version.');
  }
  return record;
}
module.exports = { list, create, change };

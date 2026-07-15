/**
 * modules/auth/auth.repository.js
 * Data-access layer — the ONLY file in this module allowed to touch the
 * Mongoose model directly. Services call this, never the model itself,
 * so persistence details can change without rippling into business logic.
 */
const Session = require('./auth.model');

async function create(data) {
  return Session.create(data);
}

async function findById(id) {
  return Session.findById(id);
}

async function findAll({ filter = {}, page = 1, limit = 20, sort = '-createdAt' } = {}) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Session.find(filter).sort(sort).skip(skip).limit(limit),
    Session.countDocuments(filter),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function updateById(id, data) {
  return Session.findByIdAndUpdate(id, data, { new: true, runValidators: true });
}

async function deleteById(id) {
  return Session.findByIdAndDelete(id);
}

module.exports = { create, findById, findAll, updateById, deleteById };

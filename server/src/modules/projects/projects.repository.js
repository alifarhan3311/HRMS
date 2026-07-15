/**
 * modules/projects/projects.repository.js
 * Data-access layer — the ONLY file in this module allowed to touch the
 * Mongoose model directly. Services call this, never the model itself,
 * so persistence details can change without rippling into business logic.
 */
const Project = require('./projects.model');

async function create(data) {
  return Project.create(data);
}

async function findById(id) {
  return Project.findById(id);
}

async function findAll({ filter = {}, page = 1, limit = 20, sort = '-createdAt' } = {}) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Project.find(filter).sort(sort).skip(skip).limit(limit),
    Project.countDocuments(filter),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function updateById(id, data) {
  return Project.findByIdAndUpdate(id, data, { new: true, runValidators: true });
}

async function deleteById(id) {
  return Project.findByIdAndDelete(id);
}

module.exports = { create, findById, findAll, updateById, deleteById };

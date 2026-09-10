/**
 * modules/fines/fines.controller.js
 */
const service = require('./fines.service');

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

const issue = asyncHandler(async (req, res) => {
  const fine = await service.issueFine(req.body, req.user);
  res.status(201).json({ success: true, data: fine });
});

const list = asyncHandler(async (req, res) => {
  const result = await service.listFines(req.query, req.user);
  res.json({ success: true, ...result });
});

const myFines = asyncHandler(async (req, res) => {
  const result = await service.getMyFines(req.query, req.user);
  res.json({ success: true, ...result });
});

const getById = asyncHandler(async (req, res) => {
  const fine = await service.getFineById(req.params.id, req.user);
  res.json({ success: true, data: fine });
});

const voidFine = asyncHandler(async (req, res) => {
  const fine = await service.voidFine(req.params.id, req.body, req.user);
  res.json({ success: true, data: fine });
});

module.exports = { issue, list, myFines, getById, voidFine };

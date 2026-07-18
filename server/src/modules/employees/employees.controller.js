/**
 * modules/employees/employees.controller.js
 * Thin HTTP layer — parses req, calls service, shapes response.
 */
const service = require('./employees.service');
const {
  createSchema,
  updateSchema,
  statusSchema,
  promotionSchema,
} = require('./employees.validation');

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function validate(schema) {
  return (req, res, next) => {
    const normalizedBody = { ...req.body };
    for (const field of ['managerId', 'teamLeadId']) {
      if (normalizedBody[field] === '') normalizedBody[field] = null;
    }
    const { error, value } = schema.validate(normalizedBody, { abortEarly: false, stripUnknown: true });
    if (error) {
      const messages = error.details.map((d) => d.message).join('; ');
      return res.status(422).json({ success: false, error: { message: messages } });
    }
    req.body = value;
    next();
  };
}

const create = [
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const record = await service.createEmployee(req.body, req.user);
    res.status(201).json({ success: true, data: record });
  }),
];

const getById = asyncHandler(async (req, res) => {
  const record = await service.getEmployeeById(req.params.id);
  res.status(200).json({ success: true, data: record });
});

const list = asyncHandler(async (req, res) => {
  const result = await service.listEmployees(req.query, req.user);
  res.status(200).json({ success: true, ...result });
});

const update = [
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const record = await service.updateEmployee(req.params.id, req.body, req.user);
    res.status(200).json({ success: true, data: record });
  }),
];

const remove = asyncHandler(async (req, res) => {
  const result = await service.deleteEmployee(req.params.id, req.user);
  res.status(200).json({ success: true, ...result });
});

const changeStatus = [
  validate(statusSchema),
  asyncHandler(async (req, res) => {
    const record = await service.changeStatus(req.params.id, req.body, req.user);
    res.status(200).json({ success: true, data: record });
  }),
];

const promote = [
  validate(promotionSchema),
  asyncHandler(async (req, res) => {
    const record = await service.promoteEmployee(req.params.id, req.body, req.user);
    res.status(200).json({ success: true, data: record });
  }),
];

const departments = asyncHandler(async (req, res) => {
  const list = await service.getDepartmentList(req.user.companyId);
  res.status(200).json({ success: true, data: list });
});

const stats = asyncHandler(async (req, res) => {
  const result = await service.getEmployeeStats(req.user.companyId);
  res.status(200).json({ success: true, data: result[0] || {} });
});

module.exports = { create, getById, list, update, remove, changeStatus, promote, departments, stats };

const Joi = require('joi');

const objectId = Joi.string().hex().length(24);
const optionalText = max => Joi.string().trim().max(max).allow('', null);
const typeSchema = Joi.object({ name: Joi.string().trim().min(2).max(100).required() });
const network = Joi.object({
  ipAddress: optionalText(64),
  macAddress: optionalText(64),
  hostname: optionalText(150),
  lastSeen: Joi.date().iso().allow(null),
  presenceStatus: Joi.string().valid('online', 'offline', 'unknown').default('unknown'),
});

const assetFields = {
  assetCode: Joi.string().trim().max(50),
  name: Joi.string().trim().max(150),
  category: Joi.string().trim().max(100),
  brand: optionalText(100),
  model: optionalText(100),
  serialNumber: optionalText(150),
  purchaseDate: Joi.date().iso().allow(null),
  purchaseCost: Joi.number().min(0).precision(2),
  vendor: optionalText(150),
  warrantyExpiryDate: Joi.date().iso().allow(null),
  department: optionalText(100),
  location: optionalText(150),
  condition: optionalText(100),
  network,
  notes: optionalText(2000),
};

const createSchema = Joi.object({
  category: assetFields.category.required(),
  employeeId: objectId.allow('', null),
  brand: assetFields.brand,
  model: assetFields.model,
  serialNumber: assetFields.serialNumber,
  purchaseDate: assetFields.purchaseDate,
  purchaseCost: assetFields.purchaseCost,
  warrantyExpiryDate: assetFields.warrantyExpiryDate,
  department: assetFields.department,
  notes: assetFields.notes,
});
const updateSchema = Joi.object(assetFields).min(1);
const assignSchema = Joi.object({
  employeeId: objectId.required(),
  assignmentDate: Joi.date().iso().required(),
  conditionAtAssignment: optionalText(100),
  notes: optionalText(1000),
});
const returnSchema = Joi.object({
  returnDate: Joi.date().iso().required(),
  conditionAtReturn: optionalText(100),
  notes: optionalText(1000),
});
const statusSchema = Joi.object({
  status: Joi.string().valid('in_stock', 'under_repair', 'lost', 'stolen', 'retired', 'disposed').required(),
  date: Joi.date().iso().default(() => new Date()),
  description: optionalText(2000),
  reason: optionalText(1000),
  notes: optionalText(1000),
});
const maintenanceSchema = Joi.object({
  issue: Joi.string().trim().max(1000).required(),
  reportedDate: Joi.date().iso().required(),
  sentForRepairDate: Joi.date().iso().allow(null),
  vendorTechnician: optionalText(200),
  repairCost: Joi.number().min(0).precision(2).default(0),
  repairDetails: optionalText(2000),
  completionDate: Joi.date().iso().allow(null),
  status: Joi.string().valid('reported', 'in_repair', 'completed', 'cancelled').default('reported'),
  notes: optionalText(1000),
});
const maintenanceUpdateSchema = maintenanceSchema.fork(['issue', 'reportedDate'], schema => schema.optional()).min(1);

module.exports = {
  typeSchema,
  createSchema, updateSchema, assignSchema, returnSchema, statusSchema,
  maintenanceSchema, maintenanceUpdateSchema,
};

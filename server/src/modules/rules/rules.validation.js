const Joi = require('joi');
const createHttpError = require('http-errors');

const content = {
  title: Joi.string().trim().max(160).required(),
  summary: Joi.string().trim().allow('').max(300).default(''),
  blocks: Joi.array().min(1).max(40).items(Joi.object({
    type: Joi.string().valid('heading', 'paragraph', 'bullets', 'numbered').required(),
    text: Joi.string().trim().max(10000).required(),
  })).required(),
};
const schemas = {
  create: Joi.object(content),
  update: Joi.object({ ...content, revision: Joi.number().integer().min(1).required() }),
  delete: Joi.object({ revision: Joi.number().integer().min(1).required() }),
};

function validatePayload(input, action) {
  const { error, value } = schemas[action].required().validate(input, { abortEarly: true, convert: true });
  if (error) throw createHttpError(400, error.details[0].message);
  for (const block of value.blocks || []) {
    if (block.type === 'heading' && block.text.length > 200) throw createHttpError(400, 'Headings can contain up to 200 characters.');
    if (['bullets', 'numbered'].includes(block.type)) {
      const items = block.text.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
      if (!items.length || items.length > 50 || items.some(item => item.length > 500)) {
        throw createHttpError(400, 'Lists need 1–50 items, with up to 500 characters per item.');
      }
      block.text = items.join('\n');
    }
  }
  return value;
}
module.exports = { validatePayload };

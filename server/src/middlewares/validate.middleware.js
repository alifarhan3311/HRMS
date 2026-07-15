/**
 * Validate a request segment with Joi and replace it with the normalized value.
 * Keeping this at the HTTP boundary prevents malformed data from reaching
 * services and gives every module the same 422 response shape.
 */
function validate(schema, property = 'body') {
  return function validationMiddleware(req, res, next) {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      convert: true,
      stripUnknown: true,
    });

    if (error) {
      return res.status(422).json({
        success: false,
        error: {
          message: error.details.map((detail) => detail.message).join('; '),
          code: 'VALIDATION_ERROR',
        },
      });
    }

    req[property] = value;
    return next();
  };
}

module.exports = validate;

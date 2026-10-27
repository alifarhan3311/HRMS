const test = require('node:test');
const assert = require('node:assert/strict');
const { voidFineSchema } = require('../src/modules/fines/fines.validation');

test('voiding a fine accepts an omitted or blank optional reason', () => {
  assert.equal(voidFineSchema.validate({}).error, undefined);
  assert.equal(voidFineSchema.validate({ voidReason: '' }).error, undefined);
  assert.equal(voidFineSchema.validate({ voidReason: 'Issued in error' }).error, undefined);
});

test('void reason rejects non-empty values that are too short or too long', () => {
  assert.ok(voidFineSchema.validate({ voidReason: 'no' }).error);
  assert.ok(voidFineSchema.validate({ voidReason: 'x'.repeat(501) }).error);
});

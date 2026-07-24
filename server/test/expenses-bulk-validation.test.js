const test = require('node:test');
const assert = require('node:assert/strict');
const { bulkCreateSchema } = require('../src/modules/expenses/expenses.validation');

test('bulk expenses accept multiple date, product, quantity and price rows', () => {
  const result = bulkCreateSchema.validate({
    rows: [
      { expenseDate: '2026-07-24', productName: 'Printer Paper', quantity: 3, unitPrice: 850 },
      { expenseDate: '2026-07-24', productName: 'Pens', quantity: 12, unitPrice: 45.5 },
    ],
  });
  assert.equal(result.error, undefined);
});

test('bulk expenses reject invalid quantities, prices and client totals', () => {
  assert.ok(bulkCreateSchema.validate({
    rows: [{ expenseDate: '2026-07-24', productName: 'Paper', quantity: 0, unitPrice: 100 }],
  }).error);
  assert.ok(bulkCreateSchema.validate({
    rows: [{ expenseDate: '2026-07-24', productName: 'Paper', quantity: 1, unitPrice: 100, total: 1 }],
  }).error);
});

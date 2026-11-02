const test = require('node:test');
const assert = require('node:assert/strict');
let buildChangedSalesEntries;
test.before(async () => {
  ({ buildChangedSalesEntries } = await import('../src/features/training/salesEditor.js'));
});
const rates = [{ slug: 'atm', unit: 'PKR', amount: 5000 }, { slug: 'digital-media', unit: 'percent', amount: 10 }];
const person = (_id, locked = false) => ({ _id, commissionLocked: locked, salesCommission: { items: [
  { slug: 'atm', quantity: 2, salesAmount: 0, unit: 'PKR' },
  { slug: 'digital-media', quantity: 3, salesAmount: 270000, unit: 'percent' },
] } });

test('only edited employees are sent; a locked neighbour does not block a different employee', () => {
  const result = buildChangedSalesEntries([person('locked', true), person('editable')], rates,
    { editable: { atm: { quantity: '1' } } });
  assert.equal(result.length, 1);
  assert.equal(result[0].employeeId, 'editable');
  assert.equal(result[0].products.atm.quantity, 1);
  assert.equal(result[0].products['digital-media'].salesAmount, 270000);
});
test('locked rows are excluded even if local inputs were tampered with', () => {
  assert.deepEqual(buildChangedSalesEntries([person('locked', true)], rates, { locked: { atm: { quantity: '1' } } }), []);
});
test('unhydrated, unchanged and reverted values never overwrite saved sales with zeros', () => {
  assert.deepEqual(buildChangedSalesEntries([person('one')], rates, {}), []);
  assert.deepEqual(buildChangedSalesEntries([person('one')], rates, { one: { atm: { quantity: '2' } } }), []);
});
test('zeroing a quantity and changing percentage sales are genuine edits', () => {
  const [result] = buildChangedSalesEntries([person('one')], rates, { one: { atm: { quantity: '' }, 'digital-media': { quantity: '3', salesAmount: '200000' } } });
  assert.equal(result.products.atm.quantity, 0);
  assert.equal(result.products['digital-media'].salesAmount, 200000);
});
test('historical percentage unit is used even after the current rate changes unit', () => {
  const [result] = buildChangedSalesEntries([person('one')], [{ slug: 'digital-media', unit: 'PKR' }], { one: { 'digital-media': { salesAmount: '100000' } } });
  assert.equal(result.products['digital-media'].salesAmount, 100000);
});

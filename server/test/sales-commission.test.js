const test = require('node:test');
const assert = require('node:assert/strict');
process.env.ENCRYPTION_MASTER_KEY ||= '00'.repeat(32);
const { shapeItems } = require('../src/modules/training/salesCommission.service');

test('monthly commission calculates fixed products from units and percentage products from sales value', () => {
  const items = shapeItems([
    { _id: 'atm-rate', slug: 'atm', name: 'ATM', amount: 5000, unit: 'PKR' },
    { _id: 'digital-rate', slug: 'digital-media', name: 'Digital Media', amount: 10, unit: 'percent' },
  ], {
    products: {
      atm: { quantity: 2 },
      'digital-media': { quantity: 3, salesAmount: 1250 },
    },
  });

  assert.equal(items[0].commissionAmount, 10000);
  assert.equal(items[1].commissionAmount, 125);
  assert.equal(items[1].quantity, 3);
  assert.equal(items[1].salesAmount, 1250);
});

test('editing historical monthly sales preserves the rate snapshot for that period', () => {
  const [item] = shapeItems([
    { _id: 'current-atm-rate', slug: 'atm', name: 'ATM', amount: 9000, unit: 'PKR' },
  ], { products: { atm: { quantity: 2 } } }, [
    { _id: 'old-atm-rate', slug: 'atm', name: 'ATM', rate: 5000, unit: 'PKR' },
  ]);

  assert.equal(item.rate, 5000);
  assert.equal(item.commissionAmount, 10000);
});

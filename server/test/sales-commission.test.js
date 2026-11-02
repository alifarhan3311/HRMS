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

test('saving commission sales preserves the prorated base of a draft payslip', async t => {
  const service = require('../src/modules/training/salesCommission.service');
  const Employee = require('../src/modules/employees/employees.model');
  const Payslip = require('../src/modules/payroll/payroll.model');
  const SalesCommission = require('../src/modules/training/salesCommission.model');
  const commissionService = require('../src/modules/training/commission.service');
  const employeeId = '507f1f77bcf86cd799439011';
  const companyId = '507f191e810c19729de860ea';
  t.mock.method(Employee, 'find', () => ({ select: () => ({ lean: async () => [{ department: 'call center' }] }) }));
  t.mock.method(commissionService, 'list', async () => [{ _id: 'rate', slug: 'atm', name: 'ATM', amount: 5000, unit: 'PKR' }]);
  const draft = { basicSalary: '25000', periodBasicSalary: '12500', deductions: 417, async save() {} };
  t.mock.method(Payslip, 'findOne', filter => filter.status === 'draft' ? Promise.resolve(draft) : { select: () => ({ lean: async () => null }) });
  t.mock.method(SalesCommission, 'find', () => ({ select: () => ({ lean: async () => [] }) }));
  t.mock.method(SalesCommission, 'findOneAndUpdate', async (filter, update) => ({ ...filter, ...update.$set }));
  await service.savePeriod({ month: 10, year: 2026, entries: [{ employeeId, products: { atm: { quantity: 2 } } }] }, { role: 'hr', id: employeeId, companyId });
  assert.equal(draft.commissionTotal, 10000);
  assert.equal(draft.grossSalary, '22500');
  assert.equal(draft.netSalary, '22083');
});

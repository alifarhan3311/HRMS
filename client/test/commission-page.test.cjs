const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { build } = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
let Page;
test.before(async () => {
  const result = await build({
    stdin: { contents: "export { default } from './src/features/training/pages/CommissionPage.jsx';", resolveDir: path.resolve(__dirname, '..') },
    bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic',
    plugins: [{ name: 'commission-fixtures', setup(builder) {
      builder.onResolve({ filter: /training\.api$|ui\/Modal$|ui\/ConfirmDialog$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path: name }) => ({ contents: name.endsWith('training.api')
        ? `const mutation = () => [() => {}, {}];
           export const useCreateTrainingCommissionMutation = mutation, useDeleteTrainingCommissionMutation = mutation,
             useSaveSalesCommissionPeriodMutation = mutation, useUpdateTrainingCommissionRecordMutation = mutation;
           export const useListTrainingCommissionsQuery = () => ({ data: { items: globalThis.testCommissionRates } });
           export const useGetSalesCommissionPeriodQuery = () => globalThis.testCommissionPeriod;`
        : name.endsWith('ConfirmDialog') ? 'export const ConfirmDialog = () => null;'
          : 'export const Modal = () => null; export const ModalFooter = () => null;' }));
    } }],
  });
  const compiled = new Module(path.join(__dirname, 'commission-fixture.cjs'), module);
  compiled.filename = path.join(__dirname, 'commission-fixture.cjs');
  compiled.paths = module.paths;
  compiled._compile(result.outputFiles[0].text, compiled.filename);
  Page = compiled.exports.default;
});
test.beforeEach(() => {
  globalThis.testCommissionRates = [{ _id: 'atm', slug: 'atm', name: 'ATM', unit: 'PKR', amount: 5000 }];
  globalThis.testCommissionPeriod = { currentData: { data: { commissions: globalThis.testCommissionRates, employees: [
    { _id: 'one', fullName: 'Locked Employee', commissionLocked: true, payrollStatus: 'approved' },
    { _id: 'two', fullName: 'Editable Employee', commissionLocked: false },
  ] } } };
});
test('only employees with their own finalized payroll have disabled commission inputs', () => {
  const html = renderToStaticMarkup(React.createElement(Page));
  assert.match(html, /<input[^>]*aria-label="Locked Employee ATM quantity"[^>]*\sdisabled=""/);
  const editable = html.match(/<input[^>]*aria-label="Editable Employee ATM quantity"[^>]*>/)[0];
  assert.ok(!/\sdisabled(?:=|[\s>])/.test(editable));
  assert.ok(html.includes('Read-only: this employee'));
  assert.ok(html.includes('Other employees can still be edited.'));
});
test('switching periods hides stale employee data until the selected period has loaded', () => {
  globalThis.testCommissionPeriod = { data: globalThis.testCommissionPeriod.currentData, isFetching: true };
  const html = renderToStaticMarkup(React.createElement(Page));
  assert.ok(html.includes('Loading employees and monthly sales'));
  assert.ok(!html.includes('Editable Employee'));
  assert.match(html, /<button[^>]*disabled[^>]*>[\s\S]*?Save changes/);
});

test('monthly sales exposes a labelled employee search and keeps the month total visible', () => {
  const html = renderToStaticMarkup(React.createElement(Page));
  assert.match(html, /Search employees by name or ID<\/span>[\s\S]*?<input type="search"/);
  assert.match(html, /2 employees/);
  assert.match(html, /Month total/);
});

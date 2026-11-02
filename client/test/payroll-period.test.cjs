const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { build } = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

let PayrollPage;
let views;
test.before(async () => {
  const result = await build({
    stdin: { contents: "export { default, LivePayrollDetailModal, PayslipDetailModal, PayrollPrintView } from './src/features/payroll/pages/PayrollListPage.jsx';", resolveDir: path.resolve(__dirname, '..') },
    bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic',
    plugins: [{ name: 'payroll-fixtures', setup(builder) {
      builder.onResolve({ filter: /react-dom$|react-redux$|payroll\.api$|employees\.api$|ui\/Modal$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path: name }) => {
        const contents = name === 'react-dom' ? 'export const createPortal = children => children;'
          : name === 'react-redux'
          ? "export const useSelector = selector => selector({ auth: { user: { id: 'hr-one', role: 'hr' } } });"
          : name.endsWith('payroll.api')
            ? `export const useListPayrollQuery = params => { globalThis.payrollQueries.saved = params; return globalThis.savedPayrollQuery; };
               export const useGetLivePayrollQuery = params => { globalThis.payrollQueries.live = params; return globalThis.livePayrollQuery; };
               const mutation = () => [() => {}, {}];
               export const useGeneratePayrollMutation = mutation, useBulkGeneratePayrollMutation = mutation,
                 useApprovePayrollMutation = mutation, useMarkPayrollPaidMutation = mutation;`
            : name.endsWith('employees.api')
              ? 'export const useListEmployeesQuery = () => ({ data: { items: [] } });'
              : 'export const Modal = ({ isOpen, children }) => isOpen ? children : null; export const ModalFooter = ({ children }) => children;';
        return { contents };
      });
    } }],
  });
  const compiled = new Module(path.join(__dirname, 'payroll-fixture.cjs'), module);
  compiled.filename = path.join(__dirname, 'payroll-fixture.cjs');
  compiled.paths = module.paths;
  compiled._compile(result.outputFiles[0].text, compiled.filename);
  PayrollPage = compiled.exports.default;
  views = compiled.exports;
});

test.beforeEach(() => {
  globalThis.payrollQueries = {};
  globalThis.savedPayrollQuery = { currentData: { items: [], total: 0 }, refetch() {} };
  globalThis.livePayrollQuery = { currentData: { items: [] }, refetch() {} };
});

function renderPeriod(period) {
  const useState = React.useState;
  React.useState = initial => useState(period && initial && typeof initial === 'object'
    && 'month' in initial && 'year' in initial && 'status' in initial ? { ...initial, ...period } : initial);
  try { return renderToStaticMarkup(React.createElement(PayrollPage)); }
  finally { React.useState = useState; }
}

test('visible month/year filter sits above the live dashboard and defaults to this month', () => {
  const html = renderPeriod();
  const now = new Date();
  assert.ok(html.includes('aria-label="Payroll month"'));
  assert.ok(html.includes('aria-label="Payroll year"'));
  assert.ok(html.indexOf('aria-label="Payroll period"') < html.indexOf('Live Salary Dashboard'));
  assert.equal(globalThis.payrollQueries.live.month, now.getMonth() + 1);
  assert.equal(globalThis.payrollQueries.live.year, now.getFullYear());
  assert.equal(Number(globalThis.payrollQueries.saved.month), now.getMonth() + 1);
});

test('October selection drives both live payroll and saved payslips from the same period', () => {
  const html = renderPeriod({ month: '10', year: '2026' });
  assert.deepEqual(globalThis.payrollQueries.live, { month: 10, year: 2026 });
  assert.equal(globalThis.payrollQueries.saved.month, '10');
  assert.equal(globalThis.payrollQueries.saved.year, '2026');
  assert.ok(html.includes('Payroll period · Oct 2026'));
  assert.ok(html.includes('Saved payslips · Oct 2026'));
});

test('previous-year selection does not fall back to the current year', () => {
  renderPeriod({ month: '12', year: '2025' });
  assert.deepEqual(globalThis.payrollQueries.live, { month: 12, year: 2025 });
  assert.equal(globalThis.payrollQueries.saved.year, '2025');
});

test('loading a different month hides stale previous-month rows and disables exports', () => {
  globalThis.livePayrollQuery = { data: { items: [{ employeeName: 'Wrong month employee' }] }, isFetching: true, refetch() {} };
  const html = renderPeriod({ month: '10', year: '2026' });
  assert.ok(html.includes('Calculating payroll for Oct 2026'));
  assert.ok(!html.includes('Wrong month employee'));
  assert.match(html, /<button[^>]*disabled[^>]*>[\s\S]*?Excel<\/button>/);
});

test('failed historical payroll query shows an error instead of an empty employee list', () => {
  globalThis.livePayrollQuery = { error: { status: 500 }, refetch() {} };
  const html = renderPeriod({ month: '10', year: '2026' });
  assert.ok(html.includes('Could not load payroll for Oct 2026'));
  assert.ok(!html.includes('No payroll employees available'));
});

const commissionEmployee = {
  employeeName: 'Test Employee', department: 'call center', month: 10, year: 2026,
  monthlySalary: 45000, dailySalary: 1500, earnedSalary: 47500, deductions: 7000, netPayable: 48000,
  commissionTotal: 10000,
  commissionItems: [{ label: 'ATM Commission', name: 'ATM', quantity: 2, rate: 5000, unit: 'PKR', amount: 10000 }],
};

function renderLive(employee) {
  return renderToStaticMarkup(React.createElement(views.LivePayrollDetailModal, { employee, isOpen: true }));
}

test('live payroll displays fixed commission and reconciles base salary, deductions and payable', () => {
  const html = renderLive(commissionEmployee);
  assert.ok(html.includes('Commission breakdown · Oct 2026'));
  assert.ok(html.includes('ATM Commission'));
  assert.ok(html.includes('2 sale(s) × PKR 5,000 per sale'));
  for (const value of ['+ PKR 10,000', 'PKR 45,000', 'PKR 7,000', 'PKR 38,000', 'PKR 48,000']) assert.ok(html.includes(value), value);
  assert.ok(html.includes('already include commission'));
  assert.ok(!html.includes('PKR 58,000'));
});

test('percentage commissions explain rate against combined sales value', () => {
  const html = renderLive({ ...commissionEmployee, commissionTotal: 27000,
    commissionItems: [{ name: 'Digital Media', unit: 'percent', rate: 10, salesAmount: 270000, quantity: 3, amount: 27000 }] });
  assert.ok(html.includes('10% of PKR 270,000 sales'));
  assert.ok(html.includes('+ PKR 27,000'));
});

test('zero commission is explicit and legacy rows can total commission items', () => {
  assert.ok(renderLive({ ...commissionEmployee, commissionTotal: 0, commissionItems: [] }).includes('No commission recorded for this payroll period.'));
  assert.ok(renderLive({ ...commissionEmployee, commissionTotal: undefined }).includes('+ PKR 10,000'));
});

test('saved payslip summary identifies commission as already included in gross', () => {
  const html = renderToStaticMarkup(React.createElement(views.PayslipDetailModal, {
    isOpen: true, revealSensitive: true,
    payslip: { ...commissionEmployee, employeeId: { fullName: 'Test Employee' }, basicSalary: 45000, grossSalary: 55000, netSalary: 48000 },
  }));
  assert.ok(html.includes('Commission (included in gross)'));
  assert.ok(html.includes('ATM Commission'));
  assert.ok(html.includes('PKR 10,000'));
});

test('PDF print view lists commission separately and uses gross earnings before deductions', () => {
  const originalDocument = globalThis.document;
  globalThis.document = { body: {} };
  try {
    const html = renderToStaticMarkup(React.createElement(views.PayrollPrintView, { payload: {
      ...commissionEmployee, grossSalary: 55000, period: 'Oct 2026',
      salaryRows: [{ label: 'Basic Salary', amount: 45000, group: 'earning' }, { label: 'ATM Commission', amount: 10000, group: 'earning' }],
    } }));
    assert.ok(html.includes('ATM Commission'));
    assert.ok(html.includes('PKR 10,000'));
    assert.ok(html.includes('PKR 55,000'));
    assert.ok(html.includes('PKR 48,000'));
    assert.ok(!html.includes('PKR 47,500'));
  } finally { globalThis.document = originalDocument; }
});

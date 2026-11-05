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
    stdin: { contents: "export { default, LivePayrollDetailModal, LivePayrollCardSalary, PayslipDetailModal, PayrollPrintView, ClearPayrollDialog, PayrollProrationNote } from './src/features/payroll/pages/PayrollListPage.jsx'; export { default as Pagination } from './src/components/ui/Pagination.jsx';", resolveDir: path.resolve(__dirname, '..') },
    bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic',
    plugins: [{ name: 'payroll-fixtures', setup(builder) {
      builder.onResolve({ filter: /react-dom$|react-redux$|payroll\.api$|employees\.api$|ui\/Modal$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path: name }) => {
        const contents = name === 'react-dom' ? 'export const createPortal = children => children;'
          : name === 'react-redux'
          ? "export const useSelector = selector => selector({ auth: { user: { id: 'hr-one', role: globalThis.testPayrollRole || 'hr' } } });"
          : name.endsWith('payroll.api')
            ? `export const useListPayrollQuery = params => { globalThis.payrollQueries.saved = params; return globalThis.savedPayrollQuery; };
               export const useGetLivePayrollQuery = params => { globalThis.payrollQueries.live = params; return globalThis.livePayrollQuery; };
               const mutation = () => [() => {}, {}];
               export const useGeneratePayrollMutation = mutation, useBulkGeneratePayrollMutation = mutation, useClearPayrollPeriodMutation = mutation,
                 useApprovePayrollMutation = mutation, useMarkPayrollPaidMutation = mutation, useSavePayrollAllowanceMutation = mutation;`
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
  globalThis.testPayrollRole = 'hr';
  globalThis.payrollQueries = {};
  globalThis.savedPayrollQuery = { currentData: { items: [], total: 0 }, refetch() {} };
  globalThis.livePayrollQuery = { currentData: { items: [] }, refetch() {} };
});

function renderPeriod(period, pagination = {}) {
  const useState = React.useState;
  React.useState = initial => useState(initial === 1 && pagination.page ? pagination.page
    : initial === 10 && pagination.pageSize ? pagination.pageSize
      : period && initial && typeof initial === 'object'
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

const joiningEmployee = {
  ...commissionEmployee, monthlySalary: 25000, periodBasicSalary: 12500,
  deductions: 417, netPayable: 12083, earnedSalary: 10417,
  commissionTotal: 0, commissionItems: [],
  salaryProration: { applied: true, periodStart: '2026-10-17', periodEnd: '2026-10-31', salaryDays: 15, eligibleDays: 15, basisDays: 30 },
};

function renderLive(employee) {
  return renderToStaticMarkup(React.createElement(views.LivePayrollDetailModal, { employee, isOpen: true }));
}

test('HR-only Call Center allowance editor is scoped to the selected month', () => {
  const employee = { ...commissionEmployee, employeeId: 'one', allowanceAmount: 2500, netPayable: 50500 };
  const html = renderToStaticMarkup(React.createElement(views.LivePayrollDetailModal, { employee, isOpen: true, canEditAllowance: true }));
  for (const text of ['Manage monthly allowance', 'Allowance · Oct 2026', 'Allowance amount (PKR)', 'Save Allowance', 'Remove', '+ PKR 2,500', 'PKR 50,500']) assert.ok(html.includes(text), text);
  assert.ok(!renderLive(employee).includes('Manage monthly allowance'));
  const otherDepartment = renderToStaticMarkup(React.createElement(views.LivePayrollDetailModal, { employee: { ...employee, department: 'accounting' }, isOpen: true, canEditAllowance: true }));
  assert.ok(!otherDepartment.includes('Manage monthly allowance'));
});

test('approved payroll shows allowance as read-only while employees still see its salary breakdown', () => {
  const employee = { ...commissionEmployee, allowanceAmount: 2500, allowanceLocked: true, allowancePayrollStatus: 'approved' };
  const html = renderToStaticMarkup(React.createElement(views.LivePayrollDetailModal, { employee, isOpen: true, canEditAllowance: true }));
  assert.ok(html.includes('payroll is approved'));
  assert.ok(!html.includes('Save Allowance'));
  assert.ok(renderLive(employee).includes('+ PKR 2,500'));
  const card = renderToStaticMarkup(React.createElement(views.LivePayrollCardSalary, { employee, visible: true }));
  assert.ok(card.includes('Allowance (included)'));
  assert.ok(card.includes('2,500'));
});

test('HR card shows selected-month net salary separately from zero commission', () => {
  const html = renderToStaticMarkup(React.createElement(views.LivePayrollCardSalary, {
    employee: { ...commissionEmployee, netPayable: 38000, commissionTotal: 0, commissionItems: [] }, visible: true,
  }));
  assert.ok(html.includes('Net Payable · Oct 2026'));
  assert.ok(html.includes('PKR 38,000'));
  assert.ok(html.includes('Monthly Salary'));
  assert.ok(html.includes('PKR 45,000'));
  assert.ok(html.includes('− PKR 7,000'));
  assert.ok(html.includes('Commission (included)'));
  assert.ok(html.includes('+ PKR 0'));
});

test('joining-month details show prorated basic pay and no full-month payable', () => {
  const html = renderLive(joiningEmployee);
  for (const text of ['Joining-month salary adjustment', '2026-10-17', '2026-10-31', '15/30 days', 'PKR 12,500', 'PKR 12,083']) assert.ok(html.includes(text), text);
  assert.ok(!html.includes('PKR 24,583'));
  const card = renderToStaticMarkup(React.createElement(views.LivePayrollCardSalary, { employee: joiningEmployee, visible: true }));
  assert.ok(card.includes('Prorated Basic Pay (15/30 days)'));
  assert.ok(card.includes('PKR 12,083'));
});

test('joining-month note masks salary values with the single salary control', () => {
  const html = renderToStaticMarkup(React.createElement(views.PayrollProrationNote, { record: joiningEmployee, visible: false }));
  assert.ok(html.includes('15/30 days'));
  assert.ok(!html.includes('25,000'));
  assert.ok(!html.includes('12,500'));
});

test('generated payslip breakdown preserves the joining-month salary basis', () => {
  const html = renderToStaticMarkup(React.createElement(views.PayslipDetailModal, {
    isOpen: true, revealSensitive: true,
    payslip: { ...joiningEmployee, basicSalary: '25000', grossSalary: '12500', netSalary: '12083', employeeId: { fullName: 'Joining employee' } },
  }));
  assert.ok(html.includes('Joining-month salary adjustment'));
  assert.ok(html.includes('Prorated Basic Salary'));
  assert.ok(html.includes('PKR 12,500'));
  assert.ok(html.includes('PKR 12,083'));
});

test('HR card uses returned net salary including commission without adding it twice', () => {
  const html = renderToStaticMarkup(React.createElement(views.LivePayrollCardSalary, { employee: commissionEmployee, visible: true }));
  assert.ok(html.includes('PKR 48,000'));
  assert.ok(html.includes('+ PKR 10,000'));
  assert.ok(!html.includes('PKR 58,000'));
});

test('HR card salary values follow the existing single Show/Hide salary control', () => {
  const html = renderToStaticMarkup(React.createElement(views.LivePayrollCardSalary, { employee: commissionEmployee, visible: false }));
  for (const amount of ['48,000', '45,000', '7,000', '10,000']) assert.ok(!html.includes(amount), amount);
  assert.ok(html.includes('PKR ••••••'));
  assert.ok(!html.includes('<button'));
});

test('HR payroll cards include selected-month net payable even before opening details', () => {
  globalThis.livePayrollQuery.currentData = { items: [{ ...commissionEmployee, employeeId: 'employee-one' }] };
  const html = renderPeriod({ month: '10', year: '2026' });
  assert.ok(html.includes('Net Payable · Oct 2026'));
  assert.ok(html.includes('Commission (included)'));
});

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

test('saved payroll requests selected page and size with stable ordering', () => {
  globalThis.savedPayrollQuery.currentData = { items: [], total: 35, totalPages: 7 };
  const html = renderPeriod({ month: '10', year: '2026' }, { page: 3, pageSize: 5 });
  assert.equal(globalThis.payrollQueries.saved.page, 3);
  assert.equal(globalThis.payrollQueries.saved.limit, 5);
  assert.equal(globalThis.payrollQueries.saved.sort, '-year -month -createdAt -_id');
  assert.ok(html.includes('Showing 11–15 of 35 payslips'));
  assert.ok(html.includes('Page 3 of 7'));
});

function paginationProps(overrides = {}) {
  return { page: 1, pageSize: 10, total: 10, totalPages: 1, onPageChange() {}, onPageSizeChange() {}, ...overrides };
}

test('pagination remains visible for one page and supports empty results', () => {
  const html = renderToStaticMarkup(React.createElement(views.Pagination, paginationProps()));
  assert.ok(html.includes('Showing 1–10 of 10 payslips'));
  assert.ok(html.includes('Page 1 of 1'));
  assert.ok(html.includes('Rows per page'));
  assert.match(html, /<button[^>]*disabled[^>]*aria-label="Next payslips page"/);
  const empty = renderToStaticMarkup(React.createElement(views.Pagination, paginationProps({ total: 0, totalPages: 0 })));
  assert.ok(empty.includes('Showing 0–0 of 0 payslips'));
});

function findElement(element, predicate) {
  if (!element || typeof element !== 'object') return undefined;
  if (predicate(element)) return element;
  for (const child of React.Children.toArray(element.props?.children)) {
    const found = findElement(child, predicate);
    if (found) return found;
  }
}

test('pagination controls send page numbers and numeric row limits to their handlers', () => {
  const changedPages = [], sizes = [];
  const tree = views.Pagination(paginationProps({ page: 2, total: 35, totalPages: 4,
    onPageChange: value => changedPages.push(value), onPageSizeChange: value => sizes.push(value) }));
  const named = name => findElement(tree, item => item.props?.['aria-label'] === name);
  named('Previous payslips page').props.onClick();
  named('Next payslips page').props.onClick();
  named('Payslips page 4').props.onClick();
  named('Payslips per page').props.onChange({ target: { value: '25' } });
  assert.deepEqual(changedPages, [1, 3, 4]);
  assert.deepEqual(sizes, [25]);
});

test('loading disables navigation and does not display a stale result count', () => {
  const tree = views.Pagination(paginationProps({ page: 2, total: 35, totalPages: 4, isLoading: true }));
  for (const label of ['Previous payslips page', 'Next payslips page', 'Payslips per page']) {
    assert.equal(findElement(tree, item => item.props?.['aria-label'] === label).props.disabled, true);
  }
  const html = renderToStaticMarkup(tree);
  assert.ok(html.includes('Loading payslips…'));
  assert.ok(!html.includes('of 35 payslips'));
});

test('only HR and Admin have the Clear Payroll action', () => {
  for (const role of ['hr', 'admin', 'super_admin', 'manager', 'employee']) {
    globalThis.testPayrollRole = role;
    assert.equal(renderPeriod().includes('Clear Payroll'), ['hr', 'admin'].includes(role), role);
  }
});

test('clear dialog explicitly targets the selected period and warns about all statuses', () => {
  const html = renderToStaticMarkup(React.createElement(views.ClearPayrollDialog, { period: { month: 10, year: 2026 } }));
  for (const text of ['Oct 2026', 'CLEAR 2026-10', 'all employees and all statuses', 'approved and paid', 'recovery copy', 'commissions and other months will not change']) assert.ok(html.includes(text), text);
  assert.match(html, /<button[^>]*disabled[^>]*>[\s\S]*?Clear this month/);
});

test('clear dialog submits only the confirmed period and blocks mismatched confirmation', () => {
  const submitted = [];
  const original = React.useState;
  try {
    const props = { period: { month: 10, year: 2026 }, onClear: value => submitted.push(value) };
    for (const text of ['', 'CLEAR 2026-11', 'CLEAR 2026-10']) {
      React.useState = () => [text, () => {}];
      const tree = views.ClearPayrollDialog(props);
      findElement(tree, item => item.type === 'form').props.onSubmit({ preventDefault() {} });
    }
    assert.deepEqual(submitted, [{ month: 10, year: 2026, confirmation: 'CLEAR 2026-10' }]);
  } finally { React.useState = original; }
});

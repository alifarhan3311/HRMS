const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { build } = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { StaticRouter } = require('react-router-dom/server');
const { Routes, Route } = require('react-router-dom');

let components;
test.before(async () => {
  const result = await build({
    stdin: {
      contents: `export { default as HRDashboard } from './src/features/dashboard/components/HRDashboard.jsx';
        export { default as DashboardAlertsPage } from './src/features/dashboard/pages/DashboardAlertsPage.jsx';`,
      resolveDir: path.resolve(__dirname, '..'),
    },
    bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic',
    plugins: [{ name: 'dashboard-fixtures', setup(builder) {
      builder.onResolve({ filter: /react-redux$/ }, () => ({ path: 'redux-fixture', namespace: 'fixture' }));
      builder.onResolve({ filter: /dashboard\.api$/ }, () => ({ path: 'query-fixture', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path: name }) => ({ contents: name === 'redux-fixture'
        ? 'export const useSelector = (selector) => selector({ auth: { user: { role: globalThis.testRole } } });'
        : 'export const useGetDashboardSummaryQuery = () => globalThis.testDashboardQuery;' }));
    } }],
  });
  const compiled = new Module(path.join(__dirname, 'dashboard-fixture.cjs'), module);
  compiled.filename = path.join(__dirname, 'dashboard-fixture.cjs');
  compiled.paths = module.paths;
  compiled._compile(result.outputFiles[0].text, compiled.filename);
  components = compiled.exports;
});

test.beforeEach(() => {
  globalThis.testRole = 'hr';
  globalThis.testDashboardQuery = { data: { data: {} } };
});

const employee = { _id: 'employee-123', fullName: 'Test Employee', department: 'Accounting', designation: 'Accountant', employeeCode: 'EMP-123', nextBirthday: '2026-10-20', probationEndDate: '2026-10-01', daysUntil: -13 };
function renderDashboard(data) {
  return renderToStaticMarkup(React.createElement(StaticRouter, { location: '/dashboard' }, React.createElement(components.HRDashboard, { data })));
}
function renderAlerts(kind) {
  return renderToStaticMarkup(React.createElement(StaticRouter, { location: `/dashboard/alerts/${kind}` },
    React.createElement(Routes, null, React.createElement(Route, { path: '/dashboard/alerts/:kind', element: React.createElement(components.DashboardAlertsPage) }))));
}

test('dashboard exposes the three alert destinations and direct employee profiles', () => {
  const html = renderDashboard({ birthdayAlerts: [employee], probationAlerts: [employee], resignationRequests: [{ _id: 'exit-1', employeeId: employee, status: 'clearance', pendingClearance: 2 }] });
  for (const destination of ['/dashboard/alerts/birthdays', '/dashboard/alerts/probation', '/exits', '/employees?employeeId=employee-123', '/leaves?status=pending', '/settings?tab=holidays', '/attendance/approvals']) {
    assert.ok(html.includes(`href="${destination}"`), destination);
  }
  assert.ok((html.match(/View Details/g) || []).length >= 9);
  assert.ok(html.includes('Next 30 days &amp; recently ended'));
});

test('manager dashboard does not expose restricted settings links', () => {
  globalThis.testRole = 'manager';
  const html = renderDashboard({});
  assert.ok(!html.includes('href="/settings'));
});

test('probation details include the scoped employee and date with a profile link', () => {
  globalThis.testDashboardQuery = { data: { data: { probationAlerts: [employee] } } };
  const html = renderAlerts('probation');
  assert.ok(html.includes('Test Employee'));
  assert.ok(html.includes('EMP-123'));
  assert.ok(html.includes('Ended 13 days ago'));
  assert.ok(html.includes('href="/employees?employeeId=employee-123"'));
  assert.ok(html.includes('Search alert employees'));
});

test('superadmin alert details read the HR overview without mixing other lists', () => {
  globalThis.testDashboardQuery = { data: { data: { hrOverview: { birthdayAlerts: [employee] }, birthdayAlerts: [{ ...employee, fullName: 'Wrong source' }] } } };
  const html = renderAlerts('birthdays');
  assert.ok(html.includes('Test Employee'));
  assert.ok(!html.includes('Wrong source'));
});

test('empty and failed details show useful states', () => {
  assert.ok(renderAlerts('joinings').includes('No alerts for this period.'));
  globalThis.testDashboardQuery = { isError: true };
  assert.ok(renderAlerts('birthdays').includes('Unable to load alert details.'));
});

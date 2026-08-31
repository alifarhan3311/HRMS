/**
 * features/payroll/pages/PayrollListPage.jsx
 * Full payroll management:
 *  - Employee: view own payslips + salary breakup
 *  - Admin: generate, approve, mark paid, lock
 *  - Payslip detail modal with full breakdown
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelector } from 'react-redux';
import {
  Wallet, Plus, CheckCircle2, Lock, CreditCard,
  RefreshCw, ChevronLeft, ChevronRight, Eye, EyeOff,
  TrendingUp, TrendingDown, Banknote, FileText, Target,
  Download, Printer, Search,
} from 'lucide-react';
import {
  useListPayrollQuery, useGetLivePayrollQuery, useGeneratePayrollMutation,
  useBulkGeneratePayrollMutation,
  useSubmitPayrollMutation, useApprovePayrollMutation,
  useMarkPayrollPaidMutation, useLockPayrollMutation,
} from '../api/payroll.api';
import { useListEmployeesQuery } from '../../employees/api/employees.api';
import { toast } from '../../../utils/toast';
import StatCard from '../../../components/ui/StatCard';
import Button from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Modal, ModalFooter } from '../../../components/ui/Modal';
import { Input, Select } from '../../../components/ui/Input';
import { Avatar } from '../../../components/ui/Avatar';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useFormDraft } from '../../../hooks/useFormDraft';
import SensitiveValue from '../../../components/ui/SensitiveValue';

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_STYLES = {
  draft:            { label: 'Draft',            variant: 'gray'   },
  pending_approval: { label: 'Pending Approval', variant: 'yellow' },
  approved:         { label: 'Approved',         variant: 'blue'   },
  paid:             { label: 'Paid',             variant: 'green'  },
  locked:           { label: 'Locked',           variant: 'purple' },
};
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtPKR(v) {
  const n = Number(v);
  if (isNaN(n)) return v || '—';
  return `PKR ${n.toLocaleString()}`;
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PK', { day:'numeric', month:'short', year:'numeric' });
}

function formatPeriodLabel(month, year) {
  return `${MONTHS[Number(month) - 1] || '—'} ${year || ''}`.trim();
}

function titleCase(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function PayrollPrintView({ payload }) {
  if (!payload) return null;
  const {
    type,
    employeeName,
    employeeCode,
    designation,
    department,
    period,
    monthlySalary,
    dailySalary,
    earnedSalary,
    netPayable,
    deductions,
    taxNumber = '',
    attendanceRows = [],
    salaryRows = [],
    attendanceSummaryRows = [],
    monthlyTargetHours,
    monthlyCompletedHours,
    monthlyRemainingHours,
    monthlyShortHours,
    monthlyCompletionPercentage,
    monthlyStatus,
    monthlyStatusLabel,
    bankName,
    accountNumber,
    accountTitle,
    paymentMode,
  } = payload;

  const earningRows = salaryRows.length
    ? salaryRows.filter((row) => !row.group || row.group === 'earning')
    : [
      { label: 'Basic', amount: monthlySalary },
      ...(earnedSalary != null ? [{ label: 'Gross', amount: earnedSalary }] : []),
    ];
  const deductionRows = salaryRows.length
    ? salaryRows.filter((row) => row.group === 'deduction')
    : [
      { label: 'Deductions', amount: deductions, negative: true },
    ];
  const netPay = netPayable != null ? netPayable : earnedSalary;

  return (
    <div className="payroll-print-root hidden print:block print:fixed print:inset-0 print:z-[9999] print:bg-white print:text-slate-900 print:origin-top print:scale-[0.78] print:transform print:transform-gpu">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col bg-white px-5 py-5">
        <div className="overflow-hidden border border-slate-300 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.12)]">
          <div className="border-b-4 border-blue-500 bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_55%,#eef5ff_100%)] px-6 py-5">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-600">Ingoude Company</p>
                <h1 className="mt-1 text-[28px] font-extrabold leading-none tracking-tight text-blue-700">
                  PAYROLL SLIP
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Employee earnings, deductions, and net pay summary for official record keeping and print.
                </p>
              </div>
              <div className="min-w-[190px] rounded-2xl border border-slate-300 bg-white px-4 py-3 text-right shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">Pay Period</p>
                <p className="mt-1 text-[22px] font-extrabold text-slate-900">{period}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 bg-white px-6 py-5">
            <div className="grid gap-5 lg:grid-cols-[1.25fr_0.95fr]">
              <div className="rounded-2xl border border-slate-300 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-xl font-black text-blue-700">
                      {String(employeeName || 'E').trim().charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xl font-extrabold text-slate-900">{employeeName}</p>
                      <p className="mt-1 text-sm font-medium text-slate-600">{designation || 'Employee'} · {department || '—'}</p>
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                        Employee ID: {employeeCode || '—'} {taxNumber ? ` · Tax #: ${taxNumber}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
                    <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">Department</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">{department || '—'}</p>
                  </div>
                </div>

                {monthlyTargetHours != null && (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-700">Monthly Target</p>
                        <p className="mt-1 text-2xl font-extrabold text-slate-900">{monthlyCompletionPercentage ?? 0}%</p>
                      </div>
                      <div className="rounded-full bg-white px-4 py-2 text-xs font-bold text-emerald-700 shadow-sm">
                        {monthlyStatusLabel || 'On Track'}
                      </div>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-white">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-amber-400"
                        style={{ width: `${Math.min(100, monthlyCompletionPercentage || 0)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-300 bg-slate-50 p-4">
                <p className="text-sm font-extrabold uppercase tracking-[0.25em] text-slate-600">Salary Summary</p>
                <div className="mt-3 grid gap-2">
                  {[
                    ['Monthly Salary', monthlySalary, 'text-slate-900'],
                    ['Daily Salary', dailySalary, 'text-slate-900'],
                    ['Earned Salary', earnedSalary, 'text-emerald-600'],
                    ['Total Deductions', deductions, 'text-red-500', true],
                    ['Net Payable', netPay, 'text-orange-600'],
                  ].map(([label, amount, tone, negative]) => (
                    <div key={label} className="flex items-center justify-between rounded-2xl border border-white bg-white px-4 py-2.5 shadow-sm">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">{label}</p>
                      </div>
                      <p className={`text-lg font-extrabold ${tone}`}>
                        {negative ? '− ' : ''}{fmtPKR(amount)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-300 bg-white p-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <p className="text-sm font-extrabold uppercase tracking-[0.25em] text-slate-600">Earnings</p>
                  <p className="text-xs text-slate-400">Amount</p>
                </div>
                <div className="divide-y divide-slate-200">
                  {earningRows.map((row) => (
                    <div key={row.label} className="grid grid-cols-[1fr_auto] items-center gap-4 py-2.5">
                      <p className="text-sm font-medium text-slate-700">{row.label}</p>
                      <p className="text-sm font-bold text-slate-900">{fmtPKR(row.amount)}</p>
                    </div>
                  ))}
                  <div className="mt-1.5 flex items-center justify-between border-t-2 border-blue-700 pt-2.5">
                    <p className="text-sm font-black text-slate-900">Total Earnings</p>
                    <p className="text-lg font-black text-slate-900">{fmtPKR(earnedSalary ?? monthlySalary)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-300 bg-white p-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <p className="text-sm font-extrabold uppercase tracking-[0.25em] text-slate-600">Deductions</p>
                  <p className="text-xs text-slate-400">Amount</p>
                </div>
                <div className="divide-y divide-slate-200">
                  {deductionRows.map((row) => (
                    <div key={row.label} className="grid grid-cols-[1fr_auto] items-center gap-4 py-2.5">
                      <p className="text-sm font-medium text-slate-700">{row.label}</p>
                      <p className="text-sm font-bold text-red-500">{row.negative ? '− ' : ''}{fmtPKR(row.amount)}</p>
                    </div>
                  ))}
                  <div className="mt-1.5 flex items-center justify-between border-t-2 border-blue-700 pt-2.5">
                    <p className="text-sm font-black text-slate-900">Total Deductions</p>
                    <p className="text-lg font-black text-red-500">− {fmtPKR(deductions)}</p>
                  </div>
                </div>
              </div>
            </div>

            {attendanceRows.length > 0 && (
              <div className="rounded-2xl border border-slate-300 bg-white p-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <p className="text-sm font-extrabold uppercase tracking-[0.25em] text-slate-600">Breakup</p>
                  <p className="text-xs text-slate-400">Salary components and attendance deductions</p>
                </div>
                <div className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                  {attendanceSummaryRows.map(([label, value, tone]) => (
                    <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">{label}</p>
                      <p className={`mt-1 text-xl font-black ${tone || 'text-slate-900'}`}>{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
                  <div className="grid grid-cols-[2fr_1fr] bg-blue-600 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.18em] text-white">
                    <span>Description</span>
                    <span className="text-right">Amount</span>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {attendanceRows.map((row) => (
                      <div key={row.label} className="grid grid-cols-[2fr_1fr] items-center px-4 py-2.5 text-sm">
                        <span className="font-medium text-slate-700">{row.label}</span>
                        <span className={`text-right font-black ${row.negative ? 'text-red-500' : row.accent || 'text-slate-900'}`}>
                          {row.negative ? '− ' : ''}{fmtPKR(row.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-end justify-between gap-6 border-t border-dashed border-slate-300 pt-3">
              <div className="w-full">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Employee Signature</p>
                <div className="mt-6 border-t border-slate-400 pt-2 text-center text-sm font-bold text-slate-800">
                  {employeeName}
                </div>
              </div>
              <div className="w-full">
                <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Employer Signature</p>
                <div className="mt-6 border-t border-slate-400 pt-2 text-center text-sm font-bold text-slate-800">
                  MH Enterprises
                </div>
              </div>
            </div>

            <div className="grid gap-4 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-4 sm:grid-cols-2">
              <div className="space-y-2 text-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Payment Details</p>
                <div className="grid grid-cols-[150px_1fr] gap-2">
                  <span className="text-slate-500">Payment Mode</span>
                  <span className="font-semibold text-slate-900">{paymentMode ? titleCase(paymentMode) : 'Bank Transfer'}</span>
                  <span className="text-slate-500">Bank / Wallet</span>
                  <span className="font-semibold text-slate-900">{bankName ? titleCase(bankName) : '—'}</span>
                  <span className="text-slate-500">Account Number</span>
                  <span className="font-semibold text-slate-900">{accountNumber || '—'}</span>
                  <span className="text-slate-500">Account Title</span>
                  <span className="font-semibold text-slate-900">{accountTitle || employeeName || '—'}</span>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Notes</p>
                <p className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-700">
                  This slip is generated from live attendance, leave, and payroll data for the selected period.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Payslip Detail Modal ─────────────────────────────────────────────────────
function PayslipDetailModal({ payslip, isOpen, onClose, onAction, onPrint, canGenerate, canApprove, isActioning, revealSensitive = false }) {
  if (!payslip) return null;
  const emp = payslip.employeeId;
  const st = STATUS_STYLES[payslip.status] || STATUS_STYLES.draft;

  const rows = [
    { label: 'Basic Salary',   amount: Number(payslip.basicSalary),  type: 'base'  },
    ...(payslip.allowanceItems||[]).map(a => ({ label: a.label, amount: a.amount, type: 'add' })),
    ...(payslip.bonus     ? [{ label: 'Bonus',       amount: payslip.bonus,      type: 'add' }] : []),
    ...(payslip.incentives? [{ label: 'Incentives',  amount: payslip.incentives, type: 'add' }] : []),
    ...(payslip.deductionItems||[]).map(d => ({ label: d.label, amount: d.amount, type: 'deduct' })),
    ...(payslip.taxDeduction ? [{ label: 'Income Tax', amount: payslip.taxDeduction, type: 'deduct' }] : []),
  ];
  const totalDeductions = Number(payslip.deductions || 0) + Number(payslip.taxDeduction || 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Payslip Details" size="lg">
      <div className="px-6 py-5 space-y-5">
        {/* Employee card */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-primary/5 border border-primary/10">
          <Avatar name={emp?.fullName} size="lg" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base">{emp?.fullName}</p>
            <p className="text-sm text-muted-foreground">{emp?.designation} · {emp?.department}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{emp?.employeeCode}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-muted-foreground">Period</p>
            <p className="font-semibold">{MONTHS[payslip.month - 1]} {payslip.year}</p>
            <Badge variant={st.variant} className="mt-1">{st.label}</Badge>
          </div>
        </div>

        {/* Attendance summary */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Working Days', val: payslip.workingDays },
            { label: 'Present', val: payslip.presentDays, cls: 'text-emerald-600' },
            { label: 'Absent',  val: payslip.absentDays,  cls: 'text-red-500' },
            { label: 'Late',    val: payslip.lateDays,    cls: 'text-amber-500' },
            { label: 'Half Days', val: payslip.halfDays, cls: 'text-orange-500' },
            { label: 'Paid Leave', val: payslip.paidLeaveDays, cls: 'text-blue-500' },
            { label: 'Unpaid Leave', val: payslip.unpaidLeaveDays, cls: 'text-red-500' },
            { label: 'Holidays', val: payslip.holidayDays, cls: 'text-violet-500' },
          ].map(({ label, val, cls }) => (
            <div key={label} className="glass-card p-3 text-center">
              <p className={`text-xl font-bold ${cls || ''}`}>{val ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Per Day', value: payslip.perDaySalary },
            { label: 'Per Hour', value: payslip.perHourSalary },
            { label: 'Gross Salary', value: payslip.grossSalary, cls: 'text-emerald-600' },
            { label: 'Total Deductions', value: totalDeductions, cls: 'text-red-500' },
          ].map(item => (
            <div key={item.label} className="rounded-xl border border-border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className={`mt-1 text-sm font-bold ${item.cls || ''}`}>
                <SensitiveValue value={item.value} formatter={fmtPKR} visible={revealSensitive} showToggle={false} />
              </p>
            </div>
          ))}
        </div>

        {/* Salary breakdown table */}
        <div className="glass-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-muted/30">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Salary Breakdown</p>
          </div>
          <div className="divide-y divide-border">
            {rows.map((row, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2">
                  {row.type === 'add'    && <TrendingUp   className="h-3.5 w-3.5 text-emerald-500" />}
                  {row.type === 'deduct' && <TrendingDown  className="h-3.5 w-3.5 text-red-500" />}
                  {row.type === 'base'   && <Banknote      className="h-3.5 w-3.5 text-primary" />}
                  <span className="text-sm">{row.label}</span>
                </div>
                <span className={`text-sm font-medium ${
                  row.type === 'add' ? 'text-emerald-600' :
                  row.type === 'deduct' ? 'text-red-500' : ''}`}>
                  {row.type === 'deduct' ? '−' : row.type === 'add' ? '+' : ''} <SensitiveValue value={row.amount} formatter={fmtPKR} visible={revealSensitive} showToggle={false} />
                </span>
              </div>
            ))}
          </div>
          <div className="space-y-2 border-t border-border bg-muted/20 px-4 py-3 text-sm">
            <div className="flex justify-between"><span>Gross Salary</span><SensitiveValue className="font-semibold text-emerald-600" value={payslip.grossSalary} formatter={fmtPKR} visible={revealSensitive} showToggle={false} /></div>
            <div className="flex justify-between"><span>Total Deductions</span><SensitiveValue className="font-semibold text-red-500" value={totalDeductions} formatter={(value) => `− ${fmtPKR(value)}`} visible={revealSensitive} showToggle={false} /></div>
          </div>
          {/* Net total */}
          <div className="flex items-center justify-between px-4 py-3 bg-primary/5 border-t-2 border-primary/20">
            <span className="font-bold">Net Salary</span>
            <SensitiveValue className="text-xl font-bold text-primary" value={payslip.netSalary} formatter={fmtPKR} visible={revealSensitive} showToggle={false} />
          </div>
        </div>

        {payslip.notes && (
          <div className="text-sm text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 italic">
            {payslip.notes}
          </div>
        )}

        {/* Action buttons */}
        {(canGenerate || canApprove) && (
          <div className="flex gap-2 flex-wrap">
            {canGenerate && payslip.status === 'draft' && (
              <Button variant="primary" size="sm" className="gap-1.5"
                onClick={() => onAction('submit', payslip._id)} disabled={isActioning}>
                <FileText className="h-4 w-4" /> Submit for Approval
              </Button>
            )}
            {canApprove && payslip.status === 'pending_approval' && (
              <Button variant="primary" size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => onAction('approve', payslip._id)} disabled={isActioning}>
                <CheckCircle2 className="h-4 w-4" /> Approve
              </Button>
            )}
            {canGenerate && payslip.status === 'approved' && (
              <Button variant="primary" size="sm" className="gap-1.5"
                onClick={() => onAction('paid', payslip._id)} disabled={isActioning}>
                <CreditCard className="h-4 w-4" /> Mark as Paid
              </Button>
            )}
            <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => onPrint?.(payslip)}>
              <Printer className="h-4 w-4" /> PDF / Print
            </Button>
            {canApprove && payslip.status === 'paid' && (
              <Button variant="secondary" size="sm" className="gap-1.5"
                onClick={() => onAction('lock', payslip._id)} disabled={isActioning}>
                <Lock className="h-4 w-4" /> Lock Payslip
              </Button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function LivePayrollDetailModal({ employee, isOpen, onClose, onPrint }) {
  if (!employee) return null;
  const monthlyMode = employee.monthlyTargetHours != null;
  const attendance = [
    ['Present', employee.present, 'text-emerald-600'],
    ['Absent', employee.absent, 'text-red-500'],
    ['Half Days', employee.halfDay, 'text-orange-500'],
    ['Paid Leave', employee.paidLeave, 'text-blue-500'],
    ['Unpaid Leave', employee.unpaidLeave, 'text-red-500'],
    ['Sandwich Leave', employee.sandwichLeave, 'text-red-600'],
    ['Late', employee.late, 'text-amber-500'],
    ['Holidays', employee.holiday, 'text-violet-500'],
    ['Working Days', employee.workingDays, ''],
  ];
  const deductions = [
    ['Absence deduction', employee.absenceDeduction],
    ['Half-day deduction', employee.halfDayDeduction],
    ['Unpaid leave deduction', employee.unpaidLeaveDeduction],
    ['Late deduction', employee.lateDeduction],
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Live Payroll Details" size="lg">
      <div className="space-y-5 px-4 py-5 sm:px-6">
        <div className="flex items-center gap-4 rounded-2xl border border-primary/15 bg-primary/5 p-4">
          <Avatar name={employee.employeeName} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold">{employee.employeeName}</p>
            <p className="truncate text-sm text-muted-foreground">{employee.designation || 'Employee'} · {employee.department || 'No department'}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{employee.employeeCode}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-muted-foreground">Payroll period</p>
            <p className="font-semibold">{MONTHS[Number(employee.month) - 1]} {employee.year}</p>
          </div>
          </div>

        {monthlyMode && (
          <section className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Monthly target</p>
                <p className="mt-1 text-2xl font-bold text-primary">{employee.monthlyCompletionPercentage ?? 0}%</p>
              </div>
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div className="mt-3 h-2 rounded-full bg-background/70">
              <div
                className="h-2 rounded-full bg-primary"
                style={{ width: `${Math.min(100, employee.monthlyCompletionPercentage || 0)}%` }}
              />
            </div>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
              <div className="rounded-xl bg-background/70 p-3">
                <p className="text-xs text-muted-foreground">Target</p>
                <p className="mt-1 font-semibold">{employee.monthlyTargetHours}h</p>
              </div>
              <div className="rounded-xl bg-background/70 p-3">
                <p className="text-xs text-muted-foreground">Completed</p>
                <p className="mt-1 font-semibold text-emerald-600">{employee.monthlyCompletedHours}h</p>
              </div>
              <div className="rounded-xl bg-background/70 p-3">
                <p className="text-xs text-muted-foreground">Remaining</p>
                <p className="mt-1 font-semibold text-primary">{employee.monthlyRemainingHours}h</p>
              </div>
              <div className="rounded-xl bg-background/70 p-3">
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="mt-1 font-semibold">{employee.monthlyStatus?.replaceAll('_', ' ') || '—'}</p>
              </div>
            </div>
          </section>
        )}

        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Salary summary</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: 'Monthly Salary', value: employee.monthlySalary, formatter: fmtPKR },
              { label: 'Daily Salary', value: employee.dailySalary, formatter: fmtPKR },
              { label: 'Earned So Far', value: employee.earnedSalary, formatter: fmtPKR, color: 'text-emerald-600' },
              { label: 'Attendance Deduction', value: employee.deductions, formatter: (value) => `− ${fmtPKR(value)}`, color: 'text-red-500' },
              { label: 'Projected Net Payable', value: employee.netPayable, formatter: fmtPKR, color: 'text-primary' },
              ...(monthlyMode
                ? [
                  { label: 'Shortfall Hours', value: employee.monthlyShortHours ?? 0, formatter: (value) => `${Number(value || 0).toFixed(2)}h`, color: 'text-orange-500' },
                  { label: 'Monthly Deduction', value: employee.monthlyAttendanceDeduction ?? 0, formatter: (value) => `− ${fmtPKR(value)}`, color: 'text-red-500' },
                ]
                : []),
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className={`mt-1 text-lg font-bold ${item.color || ''}`}>{item.formatter(item.value)}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm">
            <p className="font-semibold text-amber-600">3 Lates = 1 Full-Day Salary Deduction</p>
            <p className="mt-1 text-muted-foreground">
              {employee.late ?? 0} total late(s) · {employee.waivedLate ?? 0} covered by approved paid leave · {employee.lateDeductionDays ?? 0} deduction day(s) · {employee.unusedLates ?? 0} unused late(s)
            </p>
          </div>
        </section>

        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Attendance calculation</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {attendance.map(([label, value, color]) => (
              <div key={label} className="rounded-xl border border-border bg-background p-3 text-center">
                <p className={`text-xl font-bold ${color}`}>{value ?? 0}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-border">
          <div className="border-b border-border bg-muted/30 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Deduction breakdown</p>
          </div>
          <div className="divide-y divide-border">
            {deductions.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <span>{label}</span>
                <span className="font-semibold text-red-500">− {fmtPKR(value || 0)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between gap-4 bg-primary/5 px-4 py-4">
              <span className="font-bold">Projected payable salary</span>
              <span className="text-xl font-bold text-primary">{fmtPKR(employee.netPayable)}</span>
            </div>
          </div>
        </section>
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => onPrint?.(employee)}>
            <Printer className="h-4 w-4" /> PDF / Print
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Generate Payslip Form ────────────────────────────────────────────────────
function GenerateForm({ onSubmit, onClose, isLoading, draftKey, employees }) {
  const now = new Date();
  const [form, setForm, clearDraft] = useFormDraft(draftKey, {
    employeeId: '',
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    bonus: '', incentives: '',
    loanDeduction: '', advanceSalary: '', notes: '',
    allowanceItems: [{ label: 'House Rent', amount: '' }, { label: 'Transport', amount: '' }],
  });
  function set(k, v) { setForm(p => ({ ...p, [k]: v })); }
  function setAllowance(i, k, v) {
    setForm(p => {
      const items = [...p.allowanceItems];
      items[i] = { ...items[i], [k]: v };
      return { ...p, allowanceItems: items };
    });
  }
  function addAllowance() { setForm(p => ({ ...p, allowanceItems: [...p.allowanceItems, { label: '', amount: '' }] })); }
  function removeAllowance(i) { setForm(p => ({ ...p, allowanceItems: p.allowanceItems.filter((_, idx) => idx !== i) })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.employeeId) { toast.error('Please select an employee'); return; }
    const saved = await onSubmit({
      ...form,
      month: Number(form.month),
      year: Number(form.year),
      bonus: Number(form.bonus) || 0,
      incentives: Number(form.incentives) || 0,
      loanDeduction: Number(form.loanDeduction) || 0,
      advanceSalary: Number(form.advanceSalary) || 0,
      allowanceItems: form.allowanceItems
        .filter(a => a.label && a.amount)
        .map(a => ({ label: a.label, amount: Number(a.amount) })),
    });
    if (saved !== false) clearDraft();
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
        <Select label="Employee" required value={form.employeeId} onChange={(e) => set('employeeId', e.target.value)}>
          <option value="">Select employee</option>
          <option value="ALL" className="font-bold text-primary">✅ Bulk Generate All Employees</option>
          {employees.map(employee => (
            <option key={employee._id} value={employee._id}>
              {employee.fullName} · {employee.employeeCode} · {employee.department}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Month" value={form.month} onChange={(e) => set('month', e.target.value)}>
            {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </Select>
          <Input label="Year" type="number" value={form.year} onChange={(e) => set('year', e.target.value)} />
        </div>

        {form.employeeId !== 'ALL' && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Allowances</label>
                <button type="button" onClick={addAllowance}
                  className="text-xs text-primary hover:underline">+ Add</button>
              </div>
              {form.allowanceItems.map((a, i) => (
                <div key={i} className="flex gap-2">
                  <Input placeholder="Label (e.g. House Rent)" value={a.label}
                    onChange={(e) => setAllowance(i, 'label', e.target.value)} />
                  <Input placeholder="Amount" type="number" sensitive value={a.amount}
                    onChange={(e) => setAllowance(i, 'amount', e.target.value)} className="w-32" />
                  <button type="button" onClick={() => removeAllowance(i)}
                    className="text-muted-foreground hover:text-destructive text-xs px-1">✕</button>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Bonus (PKR)" type="number" sensitive placeholder="0" value={form.bonus} onChange={(e) => set('bonus', e.target.value)} />
              <Input label="Incentives (PKR)" type="number" sensitive placeholder="0" value={form.incentives} onChange={(e) => set('incentives', e.target.value)} />
              <Input label="Loan Deduction (PKR)" type="number" sensitive placeholder="0" value={form.loanDeduction} onChange={(e) => set('loanDeduction', e.target.value)} />
              <Input label="Advance Salary (PKR)" type="number" sensitive placeholder="0" value={form.advanceSalary} onChange={(e) => set('advanceSalary', e.target.value)} />
            </div>
            <Input label="Notes" placeholder="Optional notes..." value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </>
        )}
        
        {form.employeeId === 'ALL' && (
          <div className="p-4 bg-primary/10 text-primary rounded-lg text-sm font-medium">
            Note: Custom allowances, bonuses, and deductions are disabled during bulk generation. Payslips will be generated using base salary and attendance records only. You can edit individual payslips after generation if needed.
          </div>
        )}
      </div>
      <ModalFooter>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" size="sm" disabled={isLoading} className="gap-1.5">
          <Wallet className="h-4 w-4" /> {isLoading ? 'Generating...' : 'Generate Payslip'}
        </Button>
      </ModalFooter>
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PayrollListPage() {
  const { user } = useSelector((s) => s.auth);
  const canGenerate = ['admin', 'super_admin', 'hr'].includes(user?.role);
  const canApprove = ['admin', 'super_admin', 'hr'].includes(user?.role);
  const canViewTeamPayroll = canGenerate || canApprove;
  const now = new Date();

  const [generateOpen, setGenerateOpen] = useState(false);
  const [detailPayslip, setDetailPayslip] = useState(null);
  const [livePayrollEmployee, setLivePayrollEmployee] = useState(null);
  const [printPayload, setPrintPayload] = useState(null);
  const [salaryVisible, setSalaryVisible] = useState(false);
  const [liveSearch, setLiveSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ month: '', year: String(now.getFullYear()), status: '' });

  const { data, isLoading, isFetching, refetch } = useListPayrollQuery({ page, limit: 15, ...filters });
  const { data: liveData, isLoading: liveLoading, refetch: refetchLive } = useGetLivePayrollQuery({
    month: filters.month || now.getMonth() + 1,
    year: filters.year || now.getFullYear(),
  });
  const { data: employeesData } = useListEmployeesQuery(
    { page: 1, limit: 100, status: 'active' },
    { skip: !canGenerate }
  );
  const [generatePayroll, { isLoading: generating }] = useGeneratePayrollMutation();
  const [bulkGeneratePayroll, { isLoading: bulkGenerating }] = useBulkGeneratePayrollMutation();
  const [submitPayroll,   { isLoading: submitting }]  = useSubmitPayrollMutation();
  const [approvePayroll,  { isLoading: approving }]   = useApprovePayrollMutation();
  const [markPaid,        { isLoading: paying }]      = useMarkPayrollPaidMutation();
  const [lockPayroll,     { isLoading: locking }]     = useLockPayrollMutation();

  const isActioning = submitting || approving || paying || locking;

  const payslips   = data?.items || [];
  const total      = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const employees = employeesData?.items || [];
  const liveRows = liveData?.items || [];
  const normalizedLiveSearch = liveSearch.trim().toLowerCase();
  const visibleLiveRows = normalizedLiveSearch
    ? liveRows.filter(row => [
      row.employeeName,
      row.employeeCode,
      row.designation,
      row.department,
    ].some(value => String(value || '').toLowerCase().includes(normalizedLiveSearch)))
    : liveRows;

  function exportLiveCsv() {
    if (!liveRows.length) return toast.error('No live payroll data to export');
    const headers = ['Employee','Code','Monthly Salary','Daily Salary','Earned Salary','Present','Absent','Half Days','Paid Leave','Unpaid Leave','Sandwich Leave','Late','Deductions','Net Payable'];
    const rows = liveRows.map(row => [
      row.employeeName, row.employeeCode, row.monthlySalary, row.dailySalary, row.earnedSalary, row.present,
      row.absent, row.halfDay, row.paidLeave, row.unpaidLeave, row.sandwichLeave, row.late, row.deductions, row.netPayable,
    ]);
    const csv = [headers, ...rows].map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `payroll-${liveData.month}-${liveData.year}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // Stats
  const stats = {
    total,
    draft:    payslips.filter(p => p.status === 'draft').length,
    pending:  payslips.filter(p => p.status === 'pending_approval').length,
    approved: payslips.filter(p => p.status === 'approved').length,
    paid:     payslips.filter(p => p.status === 'paid').length,
  };

  async function handleGenerate(payload) {
    if (payload.employeeId === 'ALL') {
      try {
        const res = await bulkGeneratePayroll({ month: payload.month, year: payload.year }).unwrap();
        toast.success(`Generated ${res.data?.generatedCount || 0} payslips in bulk`);
        setGenerateOpen(false);
        return true;
      } catch (err) {
        toast.error(err?.data?.error?.message || 'Failed to bulk generate payslips');
        return false;
      }
    }

    try { await generatePayroll(payload).unwrap(); toast.success('Payslip generated'); setGenerateOpen(false); return true; }
    catch (err) { toast.error(err?.data?.error?.message || 'Failed to generate payslip'); return false; }
  }

  async function handleAction(action, id) {
    const mutations = { submit: submitPayroll, approve: approvePayroll, paid: markPaid, lock: lockPayroll };
    const labels    = { submit: 'Submitted', approve: 'Approved', paid: 'Marked as Paid', lock: 'Locked' };
    try {
      await mutations[action](id).unwrap();
      toast.success(`Payslip ${labels[action]}`);
      setDetailPayslip(null);
    } catch (err) { toast.error(err?.data?.error?.message || `Failed to ${action}`); }
  }

  function handlePrint(source) {
    if (!source) return;
    const isLive = Boolean(source.employeeName);
    const payload = isLive
      ? {
        type: 'live',
        employeeName: source.employeeName,
        employeeCode: source.employeeCode,
        designation: source.designation,
        department: source.department,
        period: formatPeriodLabel(source.month, source.year),
        bankName: source.bankName,
        accountNumber: source.accountNumber,
        accountTitle: source.accountTitle,
        paymentMode: source.paymentMode,
        monthlySalary: source.monthlySalary,
        dailySalary: source.dailySalary,
        earnedSalary: source.earnedSalary,
        netPayable: source.netPayable,
        deductions: source.deductions,
        monthlyTargetHours: source.monthlyTargetHours,
        monthlyCompletedHours: source.monthlyCompletedHours,
        monthlyRemainingHours: source.monthlyRemainingHours,
        monthlyShortHours: source.monthlyShortHours,
        monthlyCompletionPercentage: source.monthlyCompletionPercentage,
        monthlyStatus: source.monthlyStatus,
        monthlyStatusLabel: source.monthlyStatus
          ? String(source.monthlyStatus).replaceAll('_', ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase())
          : 'Processed',
        attendanceRows: [
          { label: 'Absence Deduction', amount: source.absenceDeduction, negative: true },
          { label: 'Half Day Deduction', amount: source.halfDayDeduction, negative: true },
          { label: 'Unpaid Leave Deduction', amount: source.unpaidLeaveDeduction, negative: true },
          { label: 'Late Deduction', amount: source.lateDeduction, negative: true },
        ],
        attendanceSummaryRows: [
          ['Present', source.present ?? 0, 'text-emerald-600'],
          ['Absent', source.absent ?? 0, 'text-red-500'],
          ['Late', source.late ?? 0, 'text-amber-500'],
          ['Half Days', source.halfDay ?? 0, 'text-orange-500'],
        ],
      }
      : {
        type: 'payslip',
        employeeName: source.employeeId?.fullName,
        employeeCode: source.employeeId?.employeeCode,
        designation: source.employeeId?.designation,
        department: source.employeeId?.department,
        period: formatPeriodLabel(source.month, source.year),
        bankName: source.employeeId?.salaryPaymentMethod,
        accountNumber: source.employeeId?.salaryAccountNumber,
        accountTitle: source.employeeId?.salaryAccountTitle,
        paymentMode: source.employeeId?.salaryPaymentMethod,
        monthlySalary: source.basicSalary,
        dailySalary: source.perDaySalary,
        earnedSalary: source.grossSalary,
        netPayable: source.netSalary,
        deductions: Number(source.deductions || 0) + Number(source.taxDeduction || 0),
        attendanceRows: [
          { label: 'Basic Salary', amount: source.basicSalary, accent: 'text-slate-900' },
          ...(source.allowanceItems || []).map((item) => ({ label: item.label, amount: item.amount, accent: 'text-emerald-600' })),
          ...(source.bonus ? [{ label: 'Bonus', amount: source.bonus, accent: 'text-emerald-600' }] : []),
          ...(source.incentives ? [{ label: 'Incentives', amount: source.incentives, accent: 'text-emerald-600' }] : []),
          ...(source.deductionItems || []).map((item) => ({ label: item.label, amount: item.amount, accent: 'text-red-500', negative: true })),
          ...(source.taxDeduction ? [{ label: 'Income Tax', amount: source.taxDeduction, accent: 'text-red-500', negative: true }] : []),
        ],
        attendanceSummaryRows: [
          ['Working Days', source.workingDays ?? 0, 'text-slate-900'],
          ['Present', source.presentDays ?? 0, 'text-emerald-600'],
          ['Absent', source.absentDays ?? 0, 'text-red-500'],
          ['Late', source.lateDays ?? 0, 'text-amber-500'],
        ],
      };

    setPrintPayload(payload);
    setTimeout(() => window.print(), 50);
  }

  useEffect(() => {
    const handleAfterPrint = () => setPrintPayload(null);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  return (
    <>
      <div className="space-y-6 print:hidden">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Payroll</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage salary, payslips and disbursements</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" className="gap-1.5"
              onClick={() => { refetch(); refetchLive(); }} disabled={isFetching}>
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="secondary" size="sm" className="gap-1.5" onClick={exportLiveCsv}>
              <Download className="h-3.5 w-3.5" /> Excel
            </Button>
            <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => {
              if (detailPayslip) return handlePrint(detailPayslip);
              if (livePayrollEmployee) return handlePrint(livePayrollEmployee);
              if (visibleLiveRows.length > 0) return handlePrint(visibleLiveRows[0]);
              if (payslips.length > 0) return handlePrint(payslips[0]);
              toast.info('No payroll record available to print.');
            }}>
              <Printer className="h-3.5 w-3.5" /> PDF / Print
            </Button>
            {canGenerate && (
              <Button variant="primary" size="sm" className="gap-1.5" onClick={() => setGenerateOpen(true)}>
                <Plus className="h-4 w-4" /> Generate Payslip
              </Button>
            )}
          </div>
        </motion.div>

        <div className="glass-card overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">Live Salary Dashboard</h2>
                <p className="text-xs text-muted-foreground">Attendance aur leave change hote hi earned salary aur deductions automatically update hotay hain.</p>
              </div>
              <div className="flex flex-col gap-2 sm:items-end">
                <button
                  type="button"
                  onClick={() => setSalaryVisible((current) => !current)}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
                  aria-label={salaryVisible ? 'Hide salary values' : 'Show salary values'}
                  title={salaryVisible ? 'Hide salary values' : 'Show salary values'}
                >
                  {salaryVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {salaryVisible ? 'Hide salary' : 'Show salary'}
                </button>
                {user?.role === 'hr' && liveRows.length > 0 && (
                  <label className="relative block w-full sm:w-72">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="search"
                      value={liveSearch}
                      onChange={(event) => setLiveSearch(event.target.value)}
                      placeholder="Search employee..."
                      aria-label="Search payroll employees"
                      className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                  </label>
                )}
              </div>
            </div>
          {liveLoading ? <div className="p-8 text-center text-sm text-muted-foreground">Calculating live payroll...</div> : liveRows.length === 0 ? (
            <div className="p-10 text-center"><p className="font-medium">No payroll employees available</p><p className="mt-1 text-sm text-muted-foreground">Aapki profile ya reporting team active honi chahiye. Monthly salary missing ho to Employees module se configure karein.</p></div>
          ) : user?.role === 'hr' ? (
            visibleLiveRows.length === 0 ? (
              <div className="p-10 text-center">
                <Search className="mx-auto mb-3 h-9 w-9 text-muted-foreground" />
                <p className="font-medium">No matching employee found</p>
                <p className="mt-1 text-sm text-muted-foreground">Try a different name, code, designation or department.</p>
              </div>
            ) : (
            <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {visibleLiveRows.map((row, index) => (
                <motion.button
                  key={row.employeeId}
                  type="button"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  onClick={() => setLivePayrollEmployee(row)}
                  className="group rounded-2xl border border-border bg-background p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={row.employeeName} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{row.employeeName}</p>
                      <p className="truncate text-xs text-muted-foreground">{row.employeeCode} · {row.designation}</p>
                      {row.monthlyTargetHours != null && (
                        <p className="mt-1 text-[11px] text-primary">
                          184-hour target: {row.monthlyCompletedHours ?? 0}h completed
                          {row.monthlyRemainingHours != null ? ` · ${row.monthlyRemainingHours}h remaining` : ''}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
                    <div><p className="font-bold text-emerald-600">{row.present ?? 0}</p><p className="text-[11px] text-muted-foreground">Present</p></div>
                    <div><p className="font-bold text-red-500">{row.absent ?? 0}</p><p className="text-[11px] text-muted-foreground">Absent</p></div>
                    <div><p className="font-bold text-amber-500">{row.late ?? 0}</p><p className="text-[11px] text-muted-foreground">Late</p></div>
                  </div>
                  <p className="mt-3 text-center text-xs font-medium text-primary">Click to view complete payroll</p>
                </motion.button>
              ))}
            </div>
            )
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1150px] text-sm">
                <thead className="bg-muted/30 text-xs uppercase text-muted-foreground"><tr>
                  {['Employee','Monthly','Daily','Earned','Present','Absent','Half Day','Paid Leave','Unpaid Leave','Sandwich','Late','Attendance Deduction','Net Payable'].map(label => <th key={label} className="px-4 py-3 text-left">{label}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-border">{liveRows.map(row => (
                  <tr key={row.employeeId} className="hover:bg-accent/30">
                    <td className="px-4 py-3"><p className="font-medium">{row.employeeName}</p><p className="text-xs text-muted-foreground">{row.employeeCode} · {row.designation}</p></td>
                    <td className="px-4 py-3"><SensitiveValue value={row.monthlySalary} formatter={fmtPKR} visible={salaryVisible} showToggle={false} /></td>
                    <td className="px-4 py-3"><SensitiveValue value={row.dailySalary} formatter={fmtPKR} visible={salaryVisible} showToggle={false} /></td>
                    <td className="px-4 py-3 font-medium text-emerald-600"><SensitiveValue value={row.earnedSalary} formatter={fmtPKR} visible={salaryVisible} showToggle={false} /></td>
                    <td className="px-4 py-3 text-emerald-600">{row.present}</td>
                    <td className="px-4 py-3 text-red-500">{row.absent}</td>
                    <td className="px-4 py-3 text-orange-500">{row.halfDay}</td>
                    <td className="px-4 py-3">{row.paidLeave}</td>
                    <td className="px-4 py-3 text-red-500">{row.unpaidLeave}</td>
                    <td className="px-4 py-3 text-red-600">{row.sandwichLeave}</td>
                    <td className="px-4 py-3 text-amber-500">{row.late}</td>
                    <td className="px-4 py-3 text-red-500"><SensitiveValue value={row.deductions} formatter={(value) => `− ${fmtPKR(value)}`} visible={salaryVisible} showToggle={false} /></td>
                    <td className="px-4 py-3 font-bold text-primary"><SensitiveValue value={row.netPayable} formatter={fmtPKR} visible={salaryVisible} showToggle={false} /></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>

        {/* Stats */}
        {canViewTeamPayroll && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total Payslips" value={total} icon={Wallet} />
            <StatCard title="Pending Approval" value={stats.pending} icon={FileText}
              trend={{ label: 'Needs review', positive: false }} />
            <StatCard title="Approved" value={stats.approved} icon={CheckCircle2}
              trend={{ label: 'Ready to disburse', positive: true }} />
            <StatCard title="Paid" value={stats.paid} icon={CreditCard}
              trend={{ label: 'Disbursed', positive: true }} />
          </div>
        )}

        {/* Filters + Table */}
        <div className="glass-card overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center flex-wrap gap-3 px-5 py-3 border-b border-border">
            <Select value={filters.month} onChange={(e) => { setFilters(p => ({ ...p, month: e.target.value })); setPage(1); }}
              className="w-32">
              <option value="">All Months</option>
              {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </Select>
            <Input type="number" placeholder="Year" value={filters.year}
              onChange={(e) => { setFilters(p => ({ ...p, year: e.target.value })); setPage(1); }}
              className="w-24" />
            <select className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              value={filters.status} onChange={(e) => { setFilters(p => ({ ...p, status: e.target.value })); setPage(1); }}>
              <option value="">All Status</option>
              {Object.entries(STATUS_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <span className="text-xs text-muted-foreground ml-auto">{total} payslips</span>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex gap-4 items-center py-2">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-8 rounded-lg" />
                </div>
              ))}
            </div>
          ) : payslips.length === 0 ? (
            <div className="py-16 text-center">
              <Wallet className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium">No payslips found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {canGenerate ? 'Generate payslips using the button above.' : 'No payslips available for your account yet.'}
              </p>
            </div>
          ) : (
            <>
              {/* Header row */}
              <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_60px] gap-3 px-5 py-2.5 border-b border-border bg-muted/30">
                {['Employee','Period','Gross','Deductions','Net Salary','Status','Generated',''].map(h => (
                  <span key={h} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</span>
                ))}
              </div>

              <div className="divide-y divide-border">
                {payslips.map((p, i) => {
                  const st = STATUS_STYLES[p.status] || STATUS_STYLES.draft;
                  return (
                    <motion.div key={p._id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.025 }}
                      className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_60px] gap-3 px-5 py-3.5 hover:bg-accent/30 transition-colors cursor-pointer group"
                      onClick={() => setDetailPayslip(p)}>
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar name={p.employeeId?.fullName} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{p.employeeId?.fullName}</p>
                          <p className="text-xs text-muted-foreground truncate">{p.employeeId?.department}</p>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <span className="text-sm">{MONTHS[p.month - 1]} {p.year}</span>
                      </div>
                      <div className="flex items-center">
                        <SensitiveValue className="text-sm" value={p.grossSalary} formatter={fmtPKR} visible={salaryVisible} showToggle={false} />
                      </div>
                      <div className="flex items-center">
                        <SensitiveValue className="text-sm text-red-500" value={Number(p.deductions || 0) + Number(p.taxDeduction || 0)} formatter={(value) => `− ${fmtPKR(value)}`} visible={salaryVisible} showToggle={false} />
                      </div>
                      <div className="flex items-center">
                        <SensitiveValue className="text-sm font-semibold text-primary" value={p.netSalary} formatter={fmtPKR} visible={salaryVisible} showToggle={false} />
                      </div>
                      <div className="flex items-center">
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </div>
                      <div className="flex items-center">
                        <span className="text-xs text-muted-foreground">{fmtDate(p.createdAt)}</span>
                      </div>
                      <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"
                          onClick={(e) => { e.stopPropagation(); setDetailPayslip(p); }}>
                          <FileText className="h-4 w-4" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-border">
              <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
              <div className="flex gap-1">
                <Button variant="secondary" size="sm" className="px-2"
                  onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="secondary" size="sm" className="px-2"
                  onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Generate Modal */}
        <Modal isOpen={generateOpen} onClose={() => setGenerateOpen(false)} title="Generate Payslip" size="lg">
          <GenerateForm onSubmit={handleGenerate} onClose={() => setGenerateOpen(false)} isLoading={generating || bulkGenerating}
            employees={employees}
            draftKey={`hrms:draft:payroll:create:${user?.id || 'user'}`} />
        </Modal>

        {/* Detail Modal */}
        <PayslipDetailModal
          payslip={detailPayslip}
          isOpen={!!detailPayslip}
          onClose={() => setDetailPayslip(null)}
          onAction={handleAction}
          onPrint={handlePrint}
          canGenerate={canGenerate}
          canApprove={canApprove}
          isActioning={isActioning}
          revealSensitive={salaryVisible}
        />

        <LivePayrollDetailModal
          employee={livePayrollEmployee}
          isOpen={Boolean(livePayrollEmployee)}
          onClose={() => setLivePayrollEmployee(null)}
          onPrint={handlePrint}
        />
      </div>

      <PayrollPrintView payload={printPayload} />
    </>
  );
}

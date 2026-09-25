function numberToWords(num) {
  if (num === 0) return 'Zero';
  const a = ['','One ','Two ','Three ','Four ', 'Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
  const b = ['', '', 'Twenty','Thirty','Forty','Fifty', 'Sixty','Seventy','Eighty','Ninety'];
  if ((num = num.toString()).length > 9) return 'overflow';
  const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return;
  let str = '';
  str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
  str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
  str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
  str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
  str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
  return str.trim() ? str.trim() : '';
}

function PayrollPrintView({ payload }) {
  if (!payload) return null;
  const {
    employeeName,
    employeeCode,
    designation,
    department,
    period,
    monthlySalary,
    earnedSalary,
    netPayable,
    deductions,
    taxNumber = '',
    salaryRows = [],
    bankName,
    accountNumber,
    attendanceSummaryRows = [],
  } = payload;

  const earningRows = salaryRows.length
    ? salaryRows.filter((row) => !row.group || row.group === 'earning')
    : [
      { label: 'Basic Salary', amount: monthlySalary },
      ...(earnedSalary != null && earnedSalary !== monthlySalary ? [{ label: 'Earned Adjustments', amount: earnedSalary - monthlySalary }] : []),
    ];
  const deductionRows = salaryRows.length
    ? salaryRows.filter((row) => row.group === 'deduction')
    : [
      { label: 'Deductions', amount: deductions, negative: true },
    ];
    
  const netPay = netPayable != null ? netPayable : earnedSalary;
  const grossPay = earnedSalary != null ? earnedSalary : monthlySalary;
  const totalDeductions = deductions || 0;
  
  const workingDays = attendanceSummaryRows.find(r => r[0] === 'Working Days')?.[1] || 30;
  const paidDays = attendanceSummaryRows.find(r => r[0] === 'Present')?.[1] || 30; // Using Present as Paid days approximation

  return (
    <div className="payroll-print-root hidden print:block print:fixed print:inset-0 print:z-[9999] print:bg-white print:text-slate-900 print:origin-top print:scale-[0.9] print:transform print:transform-gpu">
      <div className="mx-auto max-w-5xl bg-white px-8 py-10 font-sans text-[13px]">
        
        {/* Header section */}
        <div className="flex items-center gap-6 mb-6">
          <div className="h-16 w-16 shrink-0 border border-slate-400 flex items-center justify-center text-xl font-bold text-slate-700">
            MH
          </div>
          <div className="flex-1 text-center">
            <h1 className="text-2xl font-bold text-slate-800 tracking-wide">MH ENTERPRISES</h1>
            <p className="text-slate-600 mt-1">Office #12, Corporate Tower, Business District</p>
            <p className="text-slate-600">Phone: +92 123 4567890 | Email: hr@mhenterprises.com</p>
            <p className="text-slate-600">NTN: 1234567-8</p>
          </div>
          <div className="h-16 w-16 shrink-0"></div> {/* Spacer for centering */}
        </div>

        <div className="flex justify-center mb-6">
          <div className="border border-slate-400 px-6 py-2 uppercase font-bold tracking-wider">
            FOR {period}
          </div>
        </div>

        {/* Employee Details Grid */}
        <div className="border border-slate-400 mb-6">
          <div className="grid grid-cols-2 divide-x divide-slate-400">
            <div className="grid grid-cols-[120px_auto] gap-x-2 gap-y-1 p-3">
              <div className="font-bold">Employee ID</div><div>: {employeeCode || '—'}</div>
              <div className="font-bold">Employee Name</div><div>: {employeeName || '—'}</div>
              <div className="font-bold">Designation</div><div>: {designation || '—'}</div>
              <div className="font-bold">Department</div><div>: {department || '—'}</div>
              <div className="font-bold">Date of Joining</div><div>: —</div>
              <div className="font-bold">Bank Name</div><div>: {bankName || '—'}</div>
            </div>
            <div className="grid grid-cols-[120px_auto] gap-x-2 gap-y-1 p-3">
              <div className="font-bold">PAN/NTN</div><div>: {taxNumber || '—'}</div>
              <div className="font-bold">PF Number</div><div>: —</div>
              <div className="font-bold\">ESI Number</div><div>: —</div>
              <div className="font-bold">Account Number</div><div>: {accountNumber || '—'}</div>
              <div className="font-bold">Pay Days</div><div>: {workingDays}</div>
              <div className="font-bold\">Paid Days</div><div>: {paidDays}</div>
            </div>
          </div>
        </div>

        {/* Earnings & Deductions Table */}
        <div className="border border-slate-400 mb-6">
          <div className="grid grid-cols-4 border-b border-slate-400 font-bold bg-slate-50 divide-x divide-slate-400">
            <div className="p-2 text-center uppercase text-blue-900">Earnings</div>
            <div className="p-2 text-center uppercase text-blue-900">Amount</div>
            <div className="p-2 text-center uppercase text-blue-900\">Deductions</div>
            <div className="p-2 text-center uppercase text-blue-900">Amount</div>
          </div>
          
          <div className="grid grid-cols-4 divide-x divide-slate-400 min-h-[150px]">
            <div className="p-2 space-y-1">
              {earningRows.map((r, i) => <div key={i}>{r.label}</div>)}
            </div>
            <div className="p-2 space-y-1 text-right">
              {earningRows.map((r, i) => <div key={i}>{r.amount.toLocaleString()}</div>)}
            </div>
            <div className="p-2 space-y-1">
              {deductionRows.map((r, i) => <div key={i}>{r.label}</div>)}
            </div>
            <div className="p-2 space-y-1 text-right">
              {deductionRows.map((r, i) => <div key={i}>{r.amount.toLocaleString()}</div>)}
            </div>
          </div>

          <div className="grid grid-cols-4 border-t border-slate-400 font-bold bg-slate-50 divide-x divide-slate-400">
            <div className="p-2 uppercase">Total Earnings</div>
            <div className="p-2 text-right">{grossPay.toLocaleString()}</div>
            <div className="p-2 uppercase">Total Deductions</div>
            <div className="p-2 text-right">{totalDeductions.toLocaleString()}</div>
          </div>
        </div>

        {/* Net Salary Section */}
        <div className="border border-slate-400 mb-4 divide-y divide-slate-400">
          <div className="grid grid-cols-2 divide-x divide-slate-400">
            <div className="p-3 font-bold uppercase">Gross Salary (A)</div>
            <div className="p-3 text-right font-bold">{grossPay.toLocaleString()}</div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-slate-400">
            <div className="p-3 font-bold uppercase">Total Deductions (B)</div>
            <div className="p-3 text-right font-bold">{totalDeductions.toLocaleString()}</div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-slate-400 bg-slate-50">
            <div className="p-3 font-bold uppercase text-[15px]">Net Salary (A - B)</div>
            <div className="p-3 text-right font-bold text-[15px]">{netPay.toLocaleString()}</div>
          </div>
        </div>

        <div className="mb-10 text-sm font-semibold italic">
          Amount in Words: {numberToWords(netPay)} Rupees Only
        </div>

        {/* YTD Box */}
        <div className="border border-slate-400 mb-20">
          <div className="border-b border-slate-400 bg-slate-50 p-2 text-center font-bold uppercase">
            Year To Date
          </div>
          <div className="grid grid-cols-4 divide-x divide-slate-400 text-center">
            <div className="p-3">
              <div className="text-xs font-bold text-slate-500 uppercase mb-1">YTD Gross Pay</div>
              <div className="font-bold\">{(grossPay * 3).toLocaleString()}</div>
            </div>
            <div className="p-3">
              <div className="text-xs font-bold text-slate-500 uppercase mb-1\">YTD Total Deductions</div>
              <div className="font-bold\">{(totalDeductions * 3).toLocaleString()}</div>
            </div>
            <div className="p-3\">
              <div className="text-xs font-bold text-slate-500 uppercase mb-1\">YTD Taxable Pay</div>
              <div className="font-bold\">{(grossPay * 3).toLocaleString()}</div>
            </div>
            <div className="p-3\">
              <div className="text-xs font-bold text-slate-500 uppercase mb-1\">YTD Income Tax</div>
              <div className="font-bold\">0.00</div>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center text-xs text-slate-500 pt-4 border-t border-slate-300">
          <div>This is a computer generated payslip and does not require a signature.</div>
          <div>Generated On: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
        </div>
      </div>
    </div>
  );
}

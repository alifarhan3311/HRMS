const fs = require('fs');
let code = fs.readFileSync('client/src/features/attendance/pages/AttendanceListPage.jsx', 'utf8');

const replacement = `  useEffect(() => {
    if (!employeePickerOpen) return undefined;
    const closeOutside = (event) => {
      if (!employeePickerRef.current?.contains(event.target)) setEmployeePickerOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setEmployeePickerOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [employeePickerOpen]);

  function prevMonth() {
    setReportRange((prev) => {
      const currentMonthStart = new Date(prev.dateFrom);
      const nextDate = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() - 1, 1);
      return {
        preset: 'month',
        dateFrom: inputDate(nextDate),
        dateTo: inputDate(new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0)),
      };
    });
    setPage(1);
  }

  function nextMonth() {
    setReportRange((prev) => {
      const currentMonthStart = new Date(prev.dateFrom);
      const nextDate = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() + 1, 1);
      return {
        preset: 'month',
        dateFrom: inputDate(nextDate),
        dateTo: inputDate(new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0)),
      };
    });
    setPage(1);
  }`;

const startIndex = code.indexOf('      });\r\n      return next;\r\n    });');
if (startIndex === -1) {
    console.log("Could not find start index");
}

const endIndex = code.indexOf('  function applyPreset(preset)');
if (startIndex !== -1 && endIndex !== -1) {
  code = code.substring(0, startIndex) + replacement + '\r\n\r\n' + code.substring(endIndex);
  fs.writeFileSync('client/src/features/attendance/pages/AttendanceListPage.jsx', code);
  console.log('Fixed successfully.');
} else {
  console.log('Could not find boundaries.');
}

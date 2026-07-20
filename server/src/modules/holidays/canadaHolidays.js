function utcDate(year, month, day) {
  return new Date(Date.UTC(year, month, day, 12));
}

function nthWeekday(year, month, weekday, occurrence) {
  const first = utcDate(year, month, 1);
  const day = 1 + ((7 + weekday - first.getUTCDay()) % 7) + ((occurrence - 1) * 7);
  return utcDate(year, month, day);
}

function mondayBefore(year, month, day) {
  const date = utcDate(year, month, day);
  const distance = date.getUTCDay() === 1 ? 7 : (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - distance);
  return date;
}

// Anonymous Gregorian algorithm; only used to derive Good Friday.
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utcDate(year, month, day);
}

function canadaHolidays(year, province = 'ON') {
  const easter = easterSunday(year);
  const goodFriday = new Date(easter);
  goodFriday.setUTCDate(goodFriday.getUTCDate() - 2);

  const holidays = [
    ['New Year\'s Day', utcDate(year, 0, 1), 'federal'],
    ['Good Friday', goodFriday, 'federal'],
    ['Victoria Day', mondayBefore(year, 4, 25), 'federal'],
    ['Canada Day', utcDate(year, 6, 1), 'federal'],
    ['Labour Day', nthWeekday(year, 8, 1, 1), 'federal'],
    ['National Day for Truth and Reconciliation', utcDate(year, 8, 30), 'federal'],
    ['Thanksgiving Day', nthWeekday(year, 9, 1, 2), 'federal'],
    ['Remembrance Day', utcDate(year, 10, 11), 'federal'],
    ['Christmas Day', utcDate(year, 11, 25), 'federal'],
    ['Boxing Day', utcDate(year, 11, 26), 'federal'],
  ];

  const familyDayNames = {
    AB: 'Family Day', BC: 'Family Day', SK: 'Family Day', ON: 'Family Day',
    NB: 'Family Day', PE: 'Islander Day', NS: 'Heritage Day', MB: 'Louis Riel Day',
  };
  if (familyDayNames[province]) {
    holidays.push([familyDayNames[province], nthWeekday(year, 1, 1, 3), 'provincial']);
  }
  if (province === 'QC') holidays.push(['Saint-Jean-Baptiste Day', utcDate(year, 5, 24), 'provincial']);
  if (province === 'NL') holidays.push(['Orangemen\'s Day', nthWeekday(year, 6, 1, 2), 'provincial']);
  if (['ON', 'AB', 'BC', 'SK', 'MB', 'NB', 'NS', 'PE', 'NT', 'NU'].includes(province)) {
    holidays.push(['Civic Holiday', nthWeekday(year, 7, 1, 1), 'provincial']);
  }
  return holidays
    .map(([title, date, jurisdiction]) => ({ title, date, jurisdiction, country: 'CA', province }))
    .sort((a, b) => a.date - b.date);
}

module.exports = { canadaHolidays };

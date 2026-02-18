/**
 * Colombian Workdays Utility
 * Handles Colombian holidays and workday calculations
 */

/**
 * Get Colombian holidays for a given year
 * Includes fixed holidays and Ley Emiliani (moved to Monday)
 */
function getColombianHolidays(year) {
  const holidays = [];

  // Fixed holidays
  holidays.push(new Date(year, 0, 1));   // Año Nuevo - January 1
  holidays.push(new Date(year, 4, 1));   // Día del Trabajo - May 1
  holidays.push(new Date(year, 6, 20));  // Independencia - July 20
  holidays.push(new Date(year, 7, 7));   // Batalla de Boyacá - August 7
  holidays.push(new Date(year, 11, 8));  // Inmaculada Concepción - December 8
  holidays.push(new Date(year, 11, 25)); // Navidad - December 25

  // Ley Emiliani holidays (moved to Monday)
  // These are calculated based on their original dates and moved to the following Monday
  const emilianiHolidays = [
    { month: 0, day: 6 },   // Reyes Magos - January 6
    { month: 2, day: 19 },  // San José - March 19
    { month: 5, day: 29 },  // San Pedro y San Pablo - June 29
    { month: 7, day: 15 },  // Asunción de la Virgen - August 15
    { month: 9, day: 12 },  // Día de la Raza - October 12
    { month: 10, day: 1 },  // Todos los Santos - November 1
    { month: 10, day: 11 }, // Independencia de Cartagena - November 11
  ];

  emilianiHolidays.forEach(({ month, day }) => {
    const originalDate = new Date(year, month, day);
    holidays.push(moveToMonday(originalDate));
  });

  // Easter-based holidays (variable)
  const easter = calculateEaster(year);

  // Jueves Santo - Thursday before Easter
  const juevesSanto = new Date(easter);
  juevesSanto.setDate(easter.getDate() - 3);
  holidays.push(juevesSanto);

  // Viernes Santo - Friday before Easter
  const viernesSanto = new Date(easter);
  viernesSanto.setDate(easter.getDate() - 2);
  holidays.push(viernesSanto);

  // Ascensión del Señor - 43 days after Easter (moved to Monday)
  const ascension = new Date(easter);
  ascension.setDate(easter.getDate() + 43);
  holidays.push(moveToMonday(ascension));

  // Corpus Christi - 64 days after Easter (moved to Monday)
  const corpusChristi = new Date(easter);
  corpusChristi.setDate(easter.getDate() + 64);
  holidays.push(moveToMonday(corpusChristi));

  // Sagrado Corazón - 71 days after Easter (moved to Monday)
  const sagradoCorazon = new Date(easter);
  sagradoCorazon.setDate(easter.getDate() + 71);
  holidays.push(moveToMonday(sagradoCorazon));

  return holidays;
}

/**
 * Calculate Easter Sunday for a given year
 * Using the Anonymous Gregorian algorithm
 */
function calculateEaster(year) {
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

  return new Date(year, month, day);
}

/**
 * Move a date to the following Monday (Ley Emiliani)
 * If the date is already Monday, keep it
 */
function moveToMonday(date) {
  const day = date.getDay();
  if (day === 1) return new Date(date); // Already Monday

  const daysToAdd = day === 0 ? 1 : (8 - day);
  const monday = new Date(date);
  monday.setDate(date.getDate() + daysToAdd);
  return monday;
}

/**
 * Check if a date is a holiday
 */
function isHoliday(date, holidays) {
  const dateStr = date.toDateString();
  return holidays.some(h => h.toDateString() === dateStr);
}

/**
 * Check if a date is a weekend (Saturday or Sunday)
 */
function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Check if a date is a workday (not weekend and not holiday)
 */
function isWorkday(date, holidays = null) {
  if (isWeekend(date)) return false;
  if (!holidays) {
    holidays = getColombianHolidays(date.getFullYear());
  }
  return !isHoliday(date, holidays);
}

/**
 * Add workdays to a date
 */
function addWorkdays(startDate, count, holidays = null) {
  const date = new Date(startDate);
  let added = 0;

  // Get holidays for the years we might need
  const startYear = date.getFullYear();
  const endYear = startYear + 1; // Assume we won't need more than 1 year ahead
  const allHolidays = [
    ...getColombianHolidays(startYear),
    ...getColombianHolidays(endYear)
  ];

  while (added < count) {
    date.setDate(date.getDate() + 1);
    if (isWorkday(date, allHolidays)) {
      added++;
    }
  }

  return date;
}

/**
 * Subtract workdays from a date
 */
function subtractWorkdays(startDate, count, holidays = null) {
  const date = new Date(startDate);
  let subtracted = 0;

  // Get holidays for the years we might need
  const startYear = date.getFullYear();
  const prevYear = startYear - 1;
  const allHolidays = [
    ...getColombianHolidays(prevYear),
    ...getColombianHolidays(startYear)
  ];

  while (subtracted < count) {
    date.setDate(date.getDate() - 1);
    if (isWorkday(date, allHolidays)) {
      subtracted++;
    }
  }

  return date;
}

/**
 * Get the number of workdays between two dates
 */
function getWorkdaysBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end < start) {
    return -getWorkdaysBetween(endDate, startDate);
  }

  // Get holidays for all years in the range
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  let allHolidays = [];
  for (let year = startYear; year <= endYear; year++) {
    allHolidays = [...allHolidays, ...getColombianHolidays(year)];
  }

  let count = 0;
  const current = new Date(start);

  while (current <= end) {
    if (isWorkday(current, allHolidays)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Get next workday (if date is not a workday, find the next one)
 */
function getNextWorkday(date) {
  const d = new Date(date);
  const holidays = getColombianHolidays(d.getFullYear());

  while (!isWorkday(d, holidays)) {
    d.setDate(d.getDate() + 1);
    // If we crossed into a new year, reload holidays
    if (d.getMonth() === 0 && d.getDate() === 1) {
      holidays.push(...getColombianHolidays(d.getFullYear()));
    }
  }

  return d;
}

/**
 * Calculate end date based on start date and duration in workdays
 */
function calculateEndDate(startDate, durationWorkdays) {
  const start = getNextWorkday(new Date(startDate));
  return addWorkdays(start, durationWorkdays - 1);
}

/**
 * Get holiday list for display purposes
 */
function getHolidayList(year) {
  const holidays = getColombianHolidays(year);

  const holidayNames = {
    'January 1': 'Año Nuevo',
    'May 1': 'Día del Trabajo',
    'July 20': 'Independencia de Colombia',
    'August 7': 'Batalla de Boyacá',
    'December 8': 'Inmaculada Concepción',
    'December 25': 'Navidad'
  };

  return holidays.map(h => {
    const key = h.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    return {
      fecha: h,
      nombre: holidayNames[key] || `Festivo (${h.toLocaleDateString('es-CO')})`
    };
  }).sort((a, b) => a.fecha - b.fecha);
}

module.exports = {
  getColombianHolidays,
  calculateEaster,
  moveToMonday,
  isHoliday,
  isWeekend,
  isWorkday,
  addWorkdays,
  subtractWorkdays,
  getWorkdaysBetween,
  getNextWorkday,
  calculateEndDate,
  getHolidayList
};

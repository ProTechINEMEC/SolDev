/**
 * Frontend workday utility (lightweight)
 * Uses holidays array from API instead of computing them locally
 */

/**
 * Check if a date is a non-workday (weekend or holiday)
 * @param {Date} date
 * @param {string[]} holidays - Array of 'YYYY-MM-DD' strings
 */
export function isNonWorkday(date, holidays = []) {
  const day = date.getDay()
  if (day === 0 || day === 6) return true
  const dateStr = date.toISOString().split('T')[0]
  return holidays.includes(dateStr)
}

/**
 * Add workdays to a date, skipping weekends and holidays
 * @param {Date} startDate
 * @param {number} count - Number of workdays to add
 * @param {string[]} holidays - Array of 'YYYY-MM-DD' strings
 * @returns {Date}
 */
export function addWorkdaysFE(startDate, count, holidays = []) {
  const date = new Date(startDate)
  let added = 0

  while (added < count) {
    date.setDate(date.getDate() + 1)
    if (!isNonWorkday(date, holidays)) {
      added++
    }
  }

  return date
}

/**
 * Get the number of workdays between two dates (inclusive of start, exclusive of end)
 * @param {Date} start
 * @param {Date} end
 * @param {string[]} holidays
 * @returns {number}
 */
export function getWorkdaysBetweenFE(start, end, holidays = []) {
  const s = new Date(start)
  const e = new Date(end)
  let count = 0
  const current = new Date(s)

  while (current <= e) {
    if (!isNonWorkday(current, holidays)) count++
    current.setDate(current.getDate() + 1)
  }

  return count
}

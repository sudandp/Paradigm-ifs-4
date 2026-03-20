// Weekly off utility functions

/**
 * Check if a date is a weekly off day
 * @param date Date to check
 * @param weeklyOffDays Array of day numbers (0=Sunday, 1=Monday, ..., 6=Saturday)
 * @returns true if the date is a weekly off day
 */
export function isWeeklyOff(date: Date, weeklyOffDays?: number[]): boolean {
  if (!weeklyOffDays || weeklyOffDays.length === 0) {
    return false;
  }
  
  const dayOfWeek = date.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  return weeklyOffDays.includes(dayOfWeek);
}

/**
 * Get the name of the day from day number
 * @param dayNumber 0-6 (0=Sunday)
 * @returns Day name
 */
export function getDayName(dayNumber: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayNumber] || 'Unknown';
}

/**
 * Count weekly offs in a given month
 * @param year Year
 * @param month Month (1-12)
 * @param weeklyOffDays Array of day numbers
 * @returns Count of weekly off days in the month
 */
export function countWeeklyOffsInMonth(
  year: number,
  month: number,
  weeklyOffDays?: number[]
): number {
  if (!weeklyOffDays || weeklyOffDays.length === 0) {
    return 0;
  }

  let count = 0;
  const date = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    date.setDate(day);
    if (isWeeklyOff(date, weeklyOffDays)) {
      count++;
    }
  }

  return count;
}

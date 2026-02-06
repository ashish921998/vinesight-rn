/**
 * Date utility functions for safe date parsing across timezones
 */

/**
 * Parse a 'YYYY-MM-DD' string into a local Date object.
 * Uses local-time constructor to avoid UTC midnight off-by-one errors
 * that occur with new Date('YYYY-MM-DD') in non-UTC timezones.
 *
 * @param dateStr - Date string in 'YYYY-MM-DD' format
 * @returns Date object in local time
 */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Format a Date object to 'YYYY-MM-DD' string
 */
export function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

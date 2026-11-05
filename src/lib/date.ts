/**
 * Date helpers to avoid timezone day-shift bugs.
 *
 * When parsing a plain date string (YYYY-MM-DD), browsers interpret it as UTC midnight,
 * which can render as the previous day in GMT-3. This parses it as a local date.
 */

export const isPlainDateString = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

export const parseLocalDate = (value: string): Date => {
  if (isPlainDateString(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  // Fallback for timestamps/ISO strings (keeps existing behavior where time is meaningful)
  return new Date(value);
};

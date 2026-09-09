import {
  format,
  parseISO,
  isValid,
  getDaysInMonth,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isBefore,
  isAfter,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns';

/**
 * Returns today's date string in YYYY-MM-DD
 */
export function getTodayDateString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/**
 * Formats a YYYY-MM-DD or ISO string into a display date (e.g. "10 Sep 2026" or "10/09/2026")
 */
export function formatDisplayDate(dateStr?: string, pattern: string = 'dd MMM yyyy'): string {
  if (!dateStr) return '—';
  try {
    const d = parseISO(dateStr);
    if (!isValid(d)) return dateStr;
    return format(d, pattern);
  } catch {
    return dateStr;
  }
}

/**
 * Formats Month and Year (e.g. "September 2026")
 */
export function formatMonthYear(year: number, month: number): string {
  const d = new Date(year, month - 1, 1);
  return format(d, 'MMMM yyyy');
}

/**
 * Gets the short month name (e.g. "Sep")
 */
export function formatShortMonth(month: number): string {
  const d = new Date(2026, month - 1, 1);
  return format(d, 'MMM');
}

/**
 * Returns all date strings (YYYY-MM-DD) for a given month and year
 */
export function getDatesInMonth(year: number, month: number): string[] {
  const start = startOfMonth(new Date(year, month - 1, 1));
  const end = endOfMonth(new Date(year, month - 1, 1));
  const days = eachDayOfInterval({ start, end });
  return days.map(d => format(d, 'yyyy-MM-dd'));
}

/**
 * Checks if a date string is a Sunday (Day 0)
 */
export function isSunday(dateStr: string): boolean {
  try {
    const d = parseISO(dateStr);
    return getDay(d) === 0;
  } catch {
    return false;
  }
}

/**
 * Checks if a date is a Saturday (Day 6)
 */
export function isSaturday(dateStr: string): boolean {
  try {
    const d = parseISO(dateStr);
    return getDay(d) === 6;
  } catch {
    return false;
  }
}

/**
 * Returns Day of week name (e.g. "Mon", "Tue")
 */
export function getDayName(dateStr: string): string {
  try {
    const d = parseISO(dateStr);
    return format(d, 'EEE');
  } catch {
    return '';
  }
}

/**
 * Returns Day number from date string (e.g. 15 from "2026-09-15")
 */
export function getDayNumber(dateStr: string): number {
  try {
    const d = parseISO(dateStr);
    return d.getDate();
  } catch {
    return 1;
  }
}

/**
 * Safe compare: is date1 < date2 (strictly before)
 */
export function isDateStrictlyBefore(d1Str: string, d2Str: string): boolean {
  return d1Str < d2Str;
}

/**
 * Safe compare: is date1 > date2 (strictly after)
 */
export function isDateStrictlyAfter(d1Str: string, d2Str: string): boolean {
  return d1Str > d2Str;
}

/**
 * Navigation helpers for Month/Year
 */
export function getPrevMonthYear(year: number, month: number): { year: number; month: number } {
  const current = new Date(year, month - 1, 1);
  const prev = subMonths(current, 1);
  return {
    year: prev.getFullYear(),
    month: prev.getMonth() + 1,
  };
}

export function getNextMonthYear(year: number, month: number): { year: number; month: number } {
  const current = new Date(year, month - 1, 1);
  const next = addMonths(current, 1);
  return {
    year: next.getFullYear(),
    month: next.getMonth() + 1,
  };
}

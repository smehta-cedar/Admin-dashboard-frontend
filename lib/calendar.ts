/*
 * Month-grid arithmetic for the HR calendar, on "YYYY-MM-DD" strings so the
 * server and the browser agree whatever their timezones (the same rule as
 * formatLicenceDate). Plain functions, client-safe. No calendar library.
 */

/** A month as the calendar shows it; `month` is 1–12. */
export type YearMonth = { year: number; month: number };

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const pad = (value: number) => String(value).padStart(2, "0");

/** "2026-09-03" from its parts. */
export const isoDate = (year: number, month: number, day: number) =>
  `${year}-${pad(month)}-${pad(day)}`;

/** The month a "YYYY-MM-DD" (or "YYYY-MM") string falls in. */
export function yearMonthOf(date: string): YearMonth {
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) };
}

/** "September 2026". */
export const monthLabel = ({ year, month }: YearMonth) => `${MONTH_NAMES[month - 1]} ${year}`;

/** "2026-09", for keys and `<time dateTime>`. */
export const monthKey = ({ year, month }: YearMonth) => `${year}-${pad(month)}`;

export function addMonths({ year, month }: YearMonth, count: number): YearMonth {
  const index = year * 12 + (month - 1) + count;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** One cell of the grid: an in-month day, or null for the padding before and after. */
export type CalendarCell = { date: string; day: number; weekday: number } | null;

/**
 * The month as weeks of seven cells, Sunday first, padded with nulls so every
 * week is full. Days are worked out in UTC so no DST shift moves a date.
 */
export function monthGrid({ year, month }: YearMonth): CalendarCell[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: CalendarCell[] = Array.from({ length: first.getUTCDay() }, () => null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: isoDate(year, month, day), day, weekday: (first.getUTCDay() + day - 1) % 7 });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: CalendarCell[][] = [];
  for (let start = 0; start < cells.length; start += 7) weeks.push(cells.slice(start, start + 7));
  return weeks;
}

/** Inclusive: start ≤ date ≤ end, all "YYYY-MM-DD". */
export const dateInRange = (date: string, start: string, end: string) => start <= date && date <= end;

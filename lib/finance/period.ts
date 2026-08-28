// Financial month (R5). Dates are plain YYYY-MM-DD strings, handled with
// integer arithmetic only — never a Date object with a time-of-day or
// timezone, per CLAUDE.md § Dates.

export interface DateParts {
  year: number;
  month: number; // 1-indexed
  day: number;
}

export interface FinancialMonth {
  /** YYYY-MM-DD, inclusive */
  start: string;
  /** YYYY-MM-DD, exclusive */
  end: string;
  /** e.g. "Agosto 2026" */
  label: string;
}

const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function parseDateParts(date: string): DateParts {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

export function formatDateParts({ year, month, day }: DateParts): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isValidMonthStartDay(day: number): boolean {
  return Number.isInteger(day) && day >= 1 && day <= 28;
}

export function addMonths(
  { year, month }: { year: number; month: number },
  delta: number
): { year: number; month: number } {
  const zeroIndexed = month - 1 + delta;
  const year2 = year + Math.floor(zeroIndexed / 12);
  const month2 = ((zeroIndexed % 12) + 12) % 12;
  return { year: year2, month: month2 + 1 };
}

/**
 * Resolves the financial month a given competence date belongs to, per
 * `Settings.monthStartDay`. The month's label is the label of its start.
 */
export function getFinancialMonth(date: string, monthStartDay: number): FinancialMonth {
  const parts = parseDateParts(date);
  const belongsToPreviousCalendarMonth = parts.day < monthStartDay;

  const startCalendar = belongsToPreviousCalendarMonth
    ? addMonths(parts, -1)
    : { year: parts.year, month: parts.month };

  const endCalendar = addMonths(startCalendar, 1);

  const start = formatDateParts({ ...startCalendar, day: monthStartDay });
  const end = formatDateParts({ ...endCalendar, day: monthStartDay });
  const label = `${MONTH_LABELS[startCalendar.month - 1]} ${startCalendar.year}`;

  return { start, end, label };
}

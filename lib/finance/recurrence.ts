// R6 — recurrence occurrences.
import { addDays, formatDateParts, parseDateParts, type DateParts } from "./period";
import type { Frequency, PaymentMethod, RuleStatus } from "./types";

export interface RecurrenceRuleInput {
  frequency: Frequency;
  /** MONTHLY / YEARLY */
  dayOfMonth?: number | null;
  /** WEEKLY, 0=Sunday..6=Saturday */
  weekday?: number | null;
  /** YEARLY */
  monthOfYear?: number | null;
  startDate: string;
  endDate?: string | null;
  status: RuleStatus;
  /** Occurrences up to and including this date were already confirmed (on time or early) — never regenerated. */
  confirmedThroughDate?: string | null;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function inRange(date: string, rule: RecurrenceRuleInput, rangeStart: string, rangeEnd: string): boolean {
  if (date < rangeStart || date > rangeEnd) return false;
  if (date < rule.startDate) return false;
  if (rule.endDate && date > rule.endDate) return false;
  if (rule.confirmedThroughDate && date <= rule.confirmedThroughDate) return false;
  return true;
}

function monthlyOccurrences(rule: RecurrenceRuleInput, rangeStart: string, rangeEnd: string): string[] {
  const dayOfMonth = rule.dayOfMonth ?? 1;
  const start = parseDateParts(rangeStart);
  const end = parseDateParts(rangeEnd);
  const dates: string[] = [];

  let year = start.year;
  let month = start.month;

  while (year < end.year || (year === end.year && month <= end.month)) {
    // Short months truncate to their last valid day (R6 — day 31 in Feb → 28/29).
    const day = Math.min(dayOfMonth, daysInMonth(year, month));
    const date = formatDateParts({ year, month, day } as DateParts);
    if (inRange(date, rule, rangeStart, rangeEnd)) dates.push(date);

    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return dates;
}

function yearlyOccurrences(rule: RecurrenceRuleInput, rangeStart: string, rangeEnd: string): string[] {
  const monthOfYear = rule.monthOfYear ?? 1;
  const dayOfMonth = rule.dayOfMonth ?? 1;
  const start = parseDateParts(rangeStart);
  const end = parseDateParts(rangeEnd);
  const dates: string[] = [];

  for (let year = start.year; year <= end.year; year++) {
    const day = Math.min(dayOfMonth, daysInMonth(year, monthOfYear));
    const date = formatDateParts({ year, month: monthOfYear, day } as DateParts);
    if (inRange(date, rule, rangeStart, rangeEnd)) dates.push(date);
  }

  return dates;
}

function weeklyOccurrences(rule: RecurrenceRuleInput, rangeStart: string, rangeEnd: string): string[] {
  const weekday = rule.weekday ?? 0;
  const dates: string[] = [];

  const cursorStart = rangeStart > rule.startDate ? rangeStart : rule.startDate;
  let cursor = new Date(`${cursorStart}T00:00:00Z`);
  const endDate = new Date(`${rangeEnd}T00:00:00Z`);

  // Advance to the first matching weekday.
  while (cursor.getUTCDay() !== weekday) {
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }

  while (cursor <= endDate) {
    const date = cursor.toISOString().slice(0, 10);
    if (inRange(date, rule, rangeStart, rangeEnd)) dates.push(date);
    cursor = new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  return dates;
}

/** Occurrence dates within [rangeStart, rangeEnd]. PAUSED/ENDED rules generate nothing. */
export function generateOccurrences(
  rule: RecurrenceRuleInput,
  rangeStart: string,
  rangeEnd: string
): string[] {
  if (rule.status !== "ACTIVE") return [];

  switch (rule.frequency) {
    case "MONTHLY":
      return monthlyOccurrences(rule, rangeStart, rangeEnd);
    case "YEARLY":
      return yearlyOccurrences(rule, rangeStart, rangeEnd);
    case "WEEKLY":
      return weeklyOccurrences(rule, rangeStart, rangeEnd);
  }
}

/**
 * The next not-yet-confirmed occurrence, regardless of whether it's still ahead
 * or already due — the caller (confirmRecurrenceNow) decides what "now" means.
 * null once the rule is exhausted (endDate passed before the next slot, or
 * status isn't ACTIVE).
 */
export function nextOccurrenceDate(rule: RecurrenceRuleInput): string | null {
  const rangeStart =
    rule.confirmedThroughDate && rule.confirmedThroughDate >= rule.startDate
      ? addDays(rule.confirmedThroughDate, 1)
      : rule.startDate;
  // 2-year horizon covers the worst case (YEARLY) with room to spare.
  const rangeEnd = addDays(rangeStart, 731);
  return generateOccurrences(rule, rangeStart, rangeEnd)[0] ?? null;
}

/** A past occurrence with no matching transaction is "pending" — shown as to-confirm, not realized (R6). */
export function isOccurrencePending(occurrenceDate: string, today: string, hasTransaction: boolean): boolean {
  return occurrenceDate <= today && !hasTransaction;
}

/** method=CARD occurrences land on the invoice, not as an account outflow (R6). */
export function occurrenceTarget(method: PaymentMethod): "ACCOUNT" | "INVOICE" {
  return method === "CARD" ? "INVOICE" : "ACCOUNT";
}

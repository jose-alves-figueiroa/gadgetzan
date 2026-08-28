// R3 — card invoice: when the purchase lands and when the money leaves.
import { addMonths, formatDateParts, parseDateParts, type DateParts } from "./period";

export interface InvoiceAssignment {
  /** Calendar month the invoice closes in. */
  closingMonth: { year: number; month: number };
  closingDate: string;
  /** Invoice.referenceMonth — the due month. */
  referenceMonth: { year: number; month: number };
  dueDate: string;
}

/**
 * Assigns a card purchase to the invoice it lands on: closing this month if
 * the purchase date is on/before closingDay, otherwise closing next month.
 * The due date — and so the invoice's referenceMonth — falls in the same
 * month as closing unless dueDay < closingDay, in which case it rolls to
 * the following month.
 */
export function assignInvoice(
  purchaseDate: string,
  closingDay: number,
  dueDay: number
): InvoiceAssignment {
  const purchase = parseDateParts(purchaseDate);
  const closingMonth =
    purchase.day <= closingDay
      ? { year: purchase.year, month: purchase.month }
      : addMonths(purchase, 1);

  const referenceMonth = dueDay >= closingDay ? closingMonth : addMonths(closingMonth, 1);

  const closingDate = formatDateParts({ ...closingMonth, day: closingDay } as DateParts);
  const dueDate = formatDateParts({ ...referenceMonth, day: dueDay } as DateParts);

  return { closingMonth, closingDate, referenceMonth, dueDate };
}

/**
 * Closing date/month for a given reference (due) month — the inverse of
 * assignInvoice's referenceMonth derivation. Used when an installment plan
 * already knows which month it lands on and needs the matching invoice's
 * closing date to find-or-create that Invoice row.
 */
export function closingForReferenceMonth(
  referenceMonth: { year: number; month: number },
  closingDay: number,
  dueDay: number
): { closingMonth: { year: number; month: number }; closingDate: string } {
  const closingMonth = dueDay >= closingDay ? referenceMonth : addMonths(referenceMonth, -1);
  const closingDate = formatDateParts({ ...closingMonth, day: closingDay } as DateParts);
  return { closingMonth, closingDate };
}

export interface CardLimitInput {
  limitCents: number;
  /** Sum of amountCents for every transaction tied to an unpaid invoice — open, closed-unpaid, or future (R3). */
  unpaidInvoiceTotalCents: number;
}

export interface CardLimitResult {
  availableCents: number;
  utilizationPercent: number;
}

/** Remainder left open after a partial payment (R3) — never negative. */
export function calculateOutstandingBalance(invoiceTotalCents: number, paidCents: number | null): number {
  return Math.max(0, invoiceTotalCents - (paidCents ?? 0));
}

export function calculateAvailableLimit({
  limitCents,
  unpaidInvoiceTotalCents,
}: CardLimitInput): CardLimitResult {
  return {
    availableCents: limitCents - unpaidInvoiceTotalCents,
    utilizationPercent: limitCents === 0 ? 0 : (unpaidInvoiceTotalCents / limitCents) * 100,
  };
}

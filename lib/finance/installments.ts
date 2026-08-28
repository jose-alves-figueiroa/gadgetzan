// R4 — installments.
import { addMonths, formatDateParts, type DateParts } from "./period";
import { assignInvoice } from "./invoice";

export interface InstallmentPlanItem {
  installmentNo: number;
  amountCents: number;
  referenceMonth: { year: number; month: number };
  dueDate: string;
}

/** floor(total/n) per installment, remainder into the last one. */
export function splitInstallments(totalCents: number, count: number): number[] {
  const base = Math.floor(totalCents / count);
  const amounts = new Array(count).fill(base);
  amounts[count - 1] += totalCents - base * count;
  return amounts;
}

/** Builds the full installment plan, one invoice per month starting from the purchase's own invoice (R3). */
export function buildInstallmentPlan(
  totalCents: number,
  count: number,
  purchaseDate: string,
  closingDay: number,
  dueDay: number
): InstallmentPlanItem[] {
  const amounts = splitInstallments(totalCents, count);
  const first = assignInvoice(purchaseDate, closingDay, dueDay);

  return amounts.map((amountCents, index) => {
    const referenceMonth = addMonths(first.referenceMonth, index);
    const dueDate = formatDateParts({ ...referenceMonth, day: dueDay } as DateParts);
    return { installmentNo: index + 1, amountCents, referenceMonth, dueDate };
  });
}

export interface PaidInstallment {
  installmentNo: number;
  amountCents: number;
  referenceMonth: { year: number; month: number };
  dueDate: string;
}

/**
 * Recomputes only the installments not yet paid: paid ones are frozen as-is
 * (R4 — "installments in an already-paid invoice don't change"); the new
 * total minus what's already been paid is split across the remaining slots,
 * continuing the month sequence right after the last paid installment.
 */
export function recalculateInstallments(
  paidInstallments: PaidInstallment[],
  newTotalCents: number,
  newCount: number,
  purchaseDate: string,
  closingDay: number,
  dueDay: number
): InstallmentPlanItem[] {
  const paidCount = paidInstallments.length;
  const paidTotal = paidInstallments.reduce((sum, i) => sum + i.amountCents, 0);
  const remainingCount = newCount - paidCount;

  if (remainingCount <= 0) return paidInstallments;

  const first = assignInvoice(purchaseDate, closingDay, dueDay);
  const remainingAmounts = splitInstallments(newTotalCents - paidTotal, remainingCount);

  const remainingPlan = remainingAmounts.map((amountCents, index) => {
    const installmentNo = paidCount + index + 1;
    const referenceMonth = addMonths(first.referenceMonth, installmentNo - 1);
    const dueDate = formatDateParts({ ...referenceMonth, day: dueDay } as DateParts);
    return { installmentNo, amountCents, referenceMonth, dueDate };
  });

  return [...paidInstallments, ...remainingPlan];
}

/** Deleting a purchase removes its future installments and keeps the already-paid ones (R4). */
export function installmentsToDelete(
  allInstallments: InstallmentPlanItem[],
  paidInstallmentNos: ReadonlySet<number>
): InstallmentPlanItem[] {
  return allInstallments.filter((i) => !paidInstallmentNos.has(i.installmentNo));
}

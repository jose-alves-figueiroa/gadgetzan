import { prisma } from "@/lib/db";
import { closingForReferenceMonth } from "@/lib/finance/invoice";
import { formatDateParts } from "@/lib/finance/period";
import { toPrismaDate } from "./clock";
import type { Card } from "@prisma/client";

/** Finds the Invoice for a card+referenceMonth, creating it if this is the first transaction to land there. */
export async function findOrCreateInvoice(
  userId: string,
  card: Card,
  referenceMonth: { year: number; month: number },
  dueDate: string
) {
  const referenceMonthDate = toPrismaDate(formatDateParts({ ...referenceMonth, day: 1 }));

  const existing = await prisma.invoice.findUnique({
    where: { cardId_referenceMonth: { cardId: card.id, referenceMonth: referenceMonthDate } },
  });
  if (existing) return existing;

  const { closingDate } = closingForReferenceMonth(referenceMonth, card.closingDay, card.dueDay);

  return prisma.invoice.create({
    data: {
      userId,
      cardId: card.id,
      referenceMonth: referenceMonthDate,
      closingDate: toPrismaDate(closingDate),
      dueDate: toPrismaDate(dueDate),
    },
  });
}

/**
 * Sum of every unpaid invoice's total for a card, for available-limit
 * purposes (R3). A manually-entered past invoice (`enterPastInvoice`,
 * `Invoice.manualTotalCents`) has no linked transactions, so it must
 * override the transaction sum here exactly like it does everywhere else
 * an invoice total is computed (card detail page, sumInvoiceChargeCents
 * callers) — otherwise it silently doesn't commit any of the card's limit.
 */
export async function getUnpaidInvoiceTotalCents(userId: string, cardId: string): Promise<number> {
  const invoices = await prisma.invoice.findMany({
    where: { userId, cardId, paidAt: null },
    include: {
      transactions: { where: { kind: { in: ["EXPENSE", "CARD_ADJUSTMENT"] } }, select: { amountCents: true } },
    },
  });

  return invoices.reduce((sum, invoice) => {
    const total = invoice.manualTotalCents ?? invoice.transactions.reduce((s, t) => s + t.amountCents, 0);
    return sum + total;
  }, 0);
}

import { prisma } from "@/lib/db";
import { closingForReferenceMonth } from "@/lib/finance/invoice";
import { formatDateParts } from "@/lib/finance/period";
import { toPrismaDate } from "./clock";
import type { Card, Invoice } from "@prisma/client";

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
  if (existing) return absorbManualTotal(userId, existing);

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
 * A manual total (`enterPastInvoice`) stands in for itemized charges that
 * don't exist yet — every place that computes an invoice total treats
 * `manualTotalCents` and real EXPENSE/CARD_ADJUSTMENT transactions as
 * mutually exclusive (`manualTotalCents ?? sum(transactions)`), so a manual
 * invoice is assumed to have no linked charges. The moment a real charge is
 * about to land on that invoice (a card purchase made this same invoice
 * period), that assumption breaks — the new charge would silently vanish
 * from the total. Absorb the manual total into an equivalent EXPENSE first,
 * so the invoice total becomes the sum of everything again and the invoice
 * can still be paid (and re-paid, if paid off and then charged again) as a
 * normal transaction-backed invoice from here on.
 */
async function absorbManualTotal(userId: string, invoice: Invoice): Promise<Invoice> {
  if (invoice.manualTotalCents === null) return invoice;

  const [, updated] = await prisma.$transaction([
    prisma.transaction.create({
      data: {
        userId,
        kind: "EXPENSE",
        description: "Fatura (total lançado manualmente)",
        amountCents: invoice.manualTotalCents,
        competenceDate: invoice.closingDate,
        method: "CARD",
        cardId: invoice.cardId,
        invoiceId: invoice.id,
      },
    }),
    prisma.invoice.update({ where: { id: invoice.id }, data: { manualTotalCents: null } }),
  ]);
  return updated;
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

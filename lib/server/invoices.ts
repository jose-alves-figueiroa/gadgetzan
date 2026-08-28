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

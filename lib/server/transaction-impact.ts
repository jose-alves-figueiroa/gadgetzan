"use server";

import { prisma } from "@/lib/db";
import { requireUserId } from "./session";
import { assignInvoice, calculateAvailableLimit } from "@/lib/finance/invoice";
import { buildInstallmentPlan, type InstallmentPlanItem } from "@/lib/finance/installments";
import { formatDateParts } from "@/lib/finance/period";
import { toPrismaDate } from "./clock";

export interface CardImpactPreview {
  installmentPlan: InstallmentPlanItem[];
  currentInvoiceBeforeCents: number;
  currentInvoiceAfterCents: number;
  nextInvoiceBeforeCents: number;
  nextInvoiceAfterCents: number;
  availableBeforeCents: number;
  availableAfterCents: number;
  utilizationBeforePercent: number;
  utilizationAfterPercent: number;
}

/** "Impacto ao salvar" (1j) — invoice and limit before/after for a card purchase, computed against the real data. */
export async function getCardImpactPreview(
  cardId: string,
  amountCents: number,
  installments: number,
  purchaseDate: string
): Promise<CardImpactPreview | null> {
  const userId = await requireUserId();
  if (!cardId || !amountCents || !purchaseDate) return null;

  const card = await prisma.card.findFirst({ where: { id: cardId, userId } });
  if (!card) return null;

  const installmentPlan = buildInstallmentPlan(amountCents, installments, purchaseDate, card.closingDay, card.dueDay);

  const assignment = assignInvoice(purchaseDate, card.closingDay, card.dueDay);
  const currentMonthDate = formatDateParts({ ...assignment.referenceMonth, day: 1 });
  const nextMonthDate = formatDateParts({
    ...(assignment.referenceMonth.month === 12
      ? { year: assignment.referenceMonth.year + 1, month: 1 }
      : { year: assignment.referenceMonth.year, month: assignment.referenceMonth.month + 1 }),
    day: 1,
  });

  const [currentInvoice, nextInvoice, unpaidAgg] = await Promise.all([
    prisma.invoice.findUnique({
      where: { cardId_referenceMonth: { cardId, referenceMonth: toPrismaDate(currentMonthDate) } },
      include: { transactions: true },
    }),
    prisma.invoice.findUnique({
      where: { cardId_referenceMonth: { cardId, referenceMonth: toPrismaDate(nextMonthDate) } },
      include: { transactions: true },
    }),
    prisma.transaction.aggregate({
      where: { userId, cardId, invoice: { paidAt: null } },
      _sum: { amountCents: true },
    }),
  ]);

  const currentInvoiceBeforeCents = currentInvoice?.transactions.reduce((s, t) => s + t.amountCents, 0) ?? 0;
  const nextInvoiceBeforeCents = nextInvoice?.transactions.reduce((s, t) => s + t.amountCents, 0) ?? 0;

  const currentMonthKey = `${assignment.referenceMonth.year}-${assignment.referenceMonth.month}`;
  const nextMonthParts =
    assignment.referenceMonth.month === 12
      ? { year: assignment.referenceMonth.year + 1, month: 1 }
      : { year: assignment.referenceMonth.year, month: assignment.referenceMonth.month + 1 };
  const nextMonthKey = `${nextMonthParts.year}-${nextMonthParts.month}`;

  const currentAdd = installmentPlan
    .filter((p) => `${p.referenceMonth.year}-${p.referenceMonth.month}` === currentMonthKey)
    .reduce((s, p) => s + p.amountCents, 0);
  const nextAdd = installmentPlan
    .filter((p) => `${p.referenceMonth.year}-${p.referenceMonth.month}` === nextMonthKey)
    .reduce((s, p) => s + p.amountCents, 0);

  const unpaidBefore = unpaidAgg._sum.amountCents ?? 0;
  const before = calculateAvailableLimit({ limitCents: card.limitCents, unpaidInvoiceTotalCents: unpaidBefore });
  const after = calculateAvailableLimit({
    limitCents: card.limitCents,
    unpaidInvoiceTotalCents: unpaidBefore + amountCents,
  });

  return {
    installmentPlan,
    currentInvoiceBeforeCents,
    currentInvoiceAfterCents: currentInvoiceBeforeCents + currentAdd,
    nextInvoiceBeforeCents,
    nextInvoiceAfterCents: nextInvoiceBeforeCents + nextAdd,
    availableBeforeCents: before.availableCents,
    availableAfterCents: after.availableCents,
    utilizationBeforePercent: before.utilizationPercent,
    utilizationAfterPercent: after.utilizationPercent,
  };
}

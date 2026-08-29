"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUserId } from "./session";
import { todayDateString } from "./clock";
import { centsPositive } from "@/lib/validation/money";
import { assignInvoice } from "@/lib/finance/invoice";
import { addMonths } from "@/lib/finance/period";
import { simulatePurchase, type SimulationCardState, type SimulationCategoryLimitState, type SimulationResult } from "@/lib/finance/simulate";
import { isExpense } from "@/lib/finance/transactions";
import { calculateAccountBalance } from "@/lib/finance/accounts";
import { getUpcomingMonths } from "./future";
import { createTransaction } from "./transactions";
import type { FinanceTransaction } from "@/lib/finance/types";

const SimulateInput = z.object({
  description: z.string().min(1, "Descrição obrigatória."),
  amountCents: centsPositive,
  categoryId: z.string().min(1, "Categoria obrigatória."),
  method: z.enum(["ACCOUNT", "CARD"]),
  cardId: z.string().nullable().optional(),
  accountId: z.string().nullable().optional(),
  installments: z.number().int().min(1).max(48).default(1),
  purchaseDate: z.string().min(1, "Data obrigatória."),
});

export type SimulateData = z.input<typeof SimulateInput>;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

async function invoiceExpenseTotal(cardId: string, referenceMonth: { year: number; month: number }) {
  const referenceMonthDate = new Date(Date.UTC(referenceMonth.year, referenceMonth.month - 1, 1));
  const invoice = await prisma.invoice.findUnique({
    where: { cardId_referenceMonth: { cardId, referenceMonth: referenceMonthDate } },
    include: { transactions: true },
  });
  if (!invoice) return 0;
  return invoice.transactions.filter((t) => isExpense(t.kind)).reduce((s, t) => s + t.amountCents, 0);
}

/** R10 — pure simulation, gathered against real data. Writes nothing. */
export async function runSimulation(input: SimulateData): Promise<SimulationResult> {
  const userId = await requireUserId();
  const data = SimulateInput.parse(input);
  const today = todayDateString();

  const [settings, accounts, allTransactions, upcoming] = await Promise.all([
    prisma.settings.findUniqueOrThrow({ where: { userId } }),
    prisma.account.findMany({ where: { userId, archivedAt: null, includeInTotals: true } }),
    prisma.transaction.findMany({ where: { userId } }),
    getUpcomingMonths(),
  ]);

  const financeTx: FinanceTransaction[] = allTransactions.map((t) => ({
    id: t.id,
    kind: t.kind,
    amountCents: t.amountCents,
    competenceDate: t.competenceDate.toISOString().slice(0, 10),
    categoryId: t.categoryId,
    accountId: t.accountId,
    toAccountId: t.toAccountId,
    cardId: t.cardId,
    method: t.method,
  }));

  const todayBalanceCents = accounts.reduce(
    (s, a) => s + calculateAccountBalance(a.id, a.openingBalance, financeTx, today),
    0
  );

  const futureMonths = upcoming.months.map((m) => ({
    monthKey: `${m.year}-${pad(m.month)}`,
    expectedIncomeCents: m.incomeCents,
    expectedAccountExpensesCents: m.expensesCents,
    invoicesDueCents: m.invoicesCents,
    scheduledContributionsCents: 0,
  }));

  let card: SimulationCardState | undefined;
  let cardClosingDay = 0;
  let cardDueDay = 0;
  if (data.method === "CARD" && data.cardId) {
    const cardRow = await prisma.card.findFirst({ where: { id: data.cardId, userId } });
    if (!cardRow) throw new Error("Cartão não encontrado.");
    cardClosingDay = cardRow.closingDay;
    cardDueDay = cardRow.dueDay;
    const assignment = assignInvoice(data.purchaseDate, cardRow.closingDay, cardRow.dueDay);
    const nextMonth = addMonths(assignment.referenceMonth, 1);

    const [currentInvoiceTotal, nextInvoiceTotal, unpaidAgg] = await Promise.all([
      invoiceExpenseTotal(cardRow.id, assignment.referenceMonth),
      invoiceExpenseTotal(cardRow.id, nextMonth),
      prisma.transaction.aggregate({
        where: { userId, cardId: cardRow.id, invoice: { paidAt: null }, kind: { in: ["EXPENSE", "CARD_ADJUSTMENT"] } },
        _sum: { amountCents: true },
      }),
    ]);

    card = {
      closingDay: cardRow.closingDay,
      dueDay: cardRow.dueDay,
      limitCents: cardRow.limitCents,
      unpaidInvoiceTotalBeforeCents: unpaidAgg._sum.amountCents ?? 0,
      utilizationTargetPercent: cardRow.utilizationTarget ?? settings.cardUtilizationTarget,
      currentInvoiceMonthKey: `${assignment.referenceMonth.year}-${pad(assignment.referenceMonth.month)}`,
      nextInvoiceMonthKey: `${nextMonth.year}-${pad(nextMonth.month)}`,
      currentInvoiceTotalBeforeCents: currentInvoiceTotal,
      nextInvoiceTotalBeforeCents: nextInvoiceTotal,
    };
  }

  let categoryLimit: SimulationCategoryLimitState | undefined;
  const limit = await prisma.limit.findFirst({
    where: { userId, scope: "CATEGORY", categoryId: data.categoryId, archivedAt: null },
  });
  if (limit?.amountCents) {
    const spentBeforeByMonth: Record<string, number> = {};
    if (data.method === "CARD" && card) {
      const assignment = assignInvoice(data.purchaseDate, cardClosingDay, cardDueDay);
      for (let i = 0; i < data.installments; i++) {
        const m = addMonths(assignment.referenceMonth, i);
        const key = `${m.year}-${pad(m.month)}`;
        const rangeStart = `${key}-01`;
        const rangeEndCal = addMonths(m, 1);
        const rangeEnd = `${rangeEndCal.year}-${pad(rangeEndCal.month)}-01`;
        spentBeforeByMonth[key] = financeTx
          .filter((t) => isExpense(t.kind) && t.categoryId === data.categoryId)
          .filter((t) => t.competenceDate >= rangeStart && t.competenceDate < rangeEnd)
          .reduce((s, t) => s + t.amountCents, 0);
      }
    }
    categoryLimit = { amountCents: limit.amountCents, spentBeforeByMonth };
  }

  return simulatePurchase({
    amountCents: data.amountCents,
    categoryId: data.categoryId,
    method: data.method,
    installments: data.installments,
    purchaseDate: data.purchaseDate,
    card,
    categoryLimit,
    todayBalanceCents,
    futureMonths,
    minCashCents: settings.minCashCents,
  });
}

/** "Registrar a compra real" — records the simulated purchase with the exact same parameters (R10). */
export async function recordSimulatedPurchase(input: SimulateData) {
  const data = SimulateInput.parse(input);
  // data.amountCents is already parsed to integer cents — createTransaction's
  // schema expects a pt-BR reais string (it re-parses via toCents), so convert back.
  const amountReaisString = (data.amountCents / 100).toFixed(2).replace(".", ",");
  await createTransaction({
    kind: "EXPENSE",
    description: data.description,
    amountCents: amountReaisString,
    competenceDate: data.purchaseDate,
    categoryId: data.categoryId,
    method: data.method,
    accountId: data.method === "ACCOUNT" ? data.accountId : null,
    cardId: data.method === "CARD" ? data.cardId : null,
    installments: data.method === "CARD" ? data.installments : 1,
    isFixed: false,
    note: null,
  });
}

import { prisma } from "@/lib/db";
import { requireUserId } from "./session";
import { getFinancialMonth, addMonths, parseDateParts } from "@/lib/finance/period";
import { calculateSavingsRate } from "@/lib/finance/savings";
import { isExpense } from "@/lib/finance/transactions";
import { toPrismaDate, todayDateString } from "./clock";
import type { FinanceTransaction } from "@/lib/finance/types";

export async function getMonthData(monthOffset: number) {
  const userId = await requireUserId();
  const settings = await prisma.settings.findUniqueOrThrow({ where: { userId } });

  const today = todayDateString();
  const anchor = addMonths(parseDateParts(today), monthOffset);
  const anchorDate = `${anchor.year}-${String(anchor.month).padStart(2, "0")}-15`;
  const month = getFinancialMonth(anchorDate, settings.monthStartDay);
  const previousMonth = getFinancialMonth(
    `${addMonths(parseDateParts(month.start), -1).year}-${String(addMonths(parseDateParts(month.start), -1).month).padStart(2, "0")}-15`,
    settings.monthStartDay
  );

  const [transactions, previousTransactions, categories, limits] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, competenceDate: { gte: toPrismaDate(month.start), lt: toPrismaDate(month.end) } },
      include: { category: true },
    }),
    prisma.transaction.findMany({
      where: {
        userId,
        competenceDate: { gte: toPrismaDate(previousMonth.start), lt: toPrismaDate(previousMonth.end) },
      },
    }),
    prisma.category.findMany({ where: { userId } }),
    prisma.limit.findMany({ where: { userId, archivedAt: null } }),
  ]);

  const toFinance = (t: (typeof previousTransactions)[number]): FinanceTransaction => ({
    id: t.id,
    kind: t.kind,
    amountCents: t.amountCents,
    competenceDate: t.competenceDate.toISOString().slice(0, 10),
    categoryId: t.categoryId,
    accountId: t.accountId,
    toAccountId: t.toAccountId,
    cardId: t.cardId,
    method: t.method,
  });

  const current = calculateSavingsRate(transactions.map(toFinance));
  const previous = calculateSavingsRate(previousTransactions.map(toFinance));

  const expensesByCategory = new Map<string, { name: string; amountCents: number; nature: string }>();
  for (const t of transactions) {
    if (!isExpense(t.kind) || !t.category) continue;
    const existing = expensesByCategory.get(t.category.id);
    expensesByCategory.set(t.category.id, {
      name: t.category.name,
      nature: t.category.nature,
      amountCents: (existing?.amountCents ?? 0) + t.amountCents,
    });
  }

  return {
    month,
    current,
    previous,
    expensesByCategory: [...expensesByCategory.values()].sort((a, b) => b.amountCents - a.amountCents),
    limits,
    categories,
  };
}

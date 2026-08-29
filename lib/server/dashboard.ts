import { prisma } from "@/lib/db";
import { requireUserId } from "./session";
import { getFinancialMonth } from "@/lib/finance/period";
import { calculateSavingsRate } from "@/lib/finance/savings";
import { calculateAccountBalance } from "@/lib/finance/accounts";
import { calculateNetWorth } from "@/lib/finance/networth";
import { calculateAvailableLimit } from "@/lib/finance/invoice";
import { categoryLimitAlert, type Alert } from "@/lib/finance/alerts";
import { calculateLimitUtilization } from "@/lib/finance/limits";
import { isExpense } from "@/lib/finance/transactions";
import { toPrismaDate, todayDateString } from "./clock";
import type { FinanceTransaction } from "@/lib/finance/types";

export async function getDashboardData() {
  const userId = await requireUserId();
  const today = todayDateString();

  const [settings, accounts, investments, allTransactions, cards, limits] = await Promise.all([
    prisma.settings.findUniqueOrThrow({ where: { userId } }),
    prisma.account.findMany({ where: { userId, archivedAt: null } }),
    prisma.investment.findMany({ where: { userId, archivedAt: null } }),
    prisma.transaction.findMany({ where: { userId }, include: { category: true } }),
    prisma.card.findMany({ where: { userId, archivedAt: null } }),
    prisma.limit.findMany({ where: { userId, archivedAt: null }, include: { category: true } }),
  ]);

  const toFinance = (t: (typeof allTransactions)[number]): FinanceTransaction => ({
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

  const financeTransactions = allTransactions.map(toFinance);

  const accountBalances = accounts
    .filter((a) => a.includeInTotals)
    .map((a) => calculateAccountBalance(a.id, a.openingBalance, financeTransactions, today));
  const availableBalance = accountBalances.reduce((s, b) => s + b, 0);

  const netWorth = calculateNetWorth({
    accountBalances,
    investmentValues: investments.map((i) => i.currentCents),
    subtractOpenInvoices: settings.netWorthSubtractsOpenInvoices,
  });

  const month = getFinancialMonth(today, settings.monthStartDay);
  const monthTransactions = financeTransactions.filter(
    (t) => t.competenceDate >= month.start && t.competenceDate < month.end
  );
  const monthSavings = calculateSavingsRate(monthTransactions);

  const cardsWithLimit = await Promise.all(
    cards.map(async (card) => {
      const unpaidAgg = await prisma.transaction.aggregate({
        where: { userId, cardId: card.id, invoice: { paidAt: null } },
        _sum: { amountCents: true },
      });
      const { availableCents, utilizationPercent } = calculateAvailableLimit({
        limitCents: card.limitCents,
        unpaidInvoiceTotalCents: unpaidAgg._sum.amountCents ?? 0,
      });
      return { card, availableCents, utilizationPercent };
    })
  );

  const alerts: Alert[] = [];
  for (const limit of limits) {
    if (limit.scope !== "CATEGORY" || !limit.categoryId || !limit.amountCents) continue;
    const spent = monthTransactions
      .filter((t) => isExpense(t.kind) && t.categoryId === limit.categoryId)
      .reduce((s, t) => s + t.amountCents, 0);
    const utilization = calculateLimitUtilization(spent, limit.amountCents, limit.warnAtPercent);
    const daysRemaining = Math.max(
      0,
      Math.ceil((new Date(month.end).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24))
    );
    const alert = categoryLimitAlert({
      categoryId: limit.categoryId,
      categoryName: limit.category?.name ?? "categoria",
      spentCents: spent,
      amountCents: limit.amountCents,
      warnAtPercent: limit.warnAtPercent,
      daysRemaining,
      consecutiveMonthsExceeded: utilization.status === "exceeded" ? 1 : 0,
    });
    if (alert) alerts.push(alert);
  }

  return {
    netWorth,
    availableBalance,
    monthLabel: month.label,
    monthSavings,
    cards: cardsWithLimit,
    alerts,
    hasAnyData: accounts.length > 0,
  };
}

import { prisma } from "@/lib/db";
import { requireUserId } from "./session";
import { getFinancialMonth } from "@/lib/finance/period";
import { calculateSavingsRate } from "@/lib/finance/savings";
import { calculateAccountBalance } from "@/lib/finance/accounts";
import { calculateNetWorth } from "@/lib/finance/networth";
import { calculateAvailableLimit } from "@/lib/finance/invoice";
import { selectDashboardAlerts } from "@/lib/finance/alerts";
import { todayDateString } from "./clock";
import { getAllAlerts } from "./alerts";
import type { FinanceTransaction } from "@/lib/finance/types";

export async function getDashboardData() {
  const userId = await requireUserId();
  const today = todayDateString();

  const [settings, accounts, investments, allTransactions, cards, alerts] = await Promise.all([
    prisma.settings.findUniqueOrThrow({ where: { userId } }),
    prisma.account.findMany({ where: { userId, archivedAt: null } }),
    prisma.investment.findMany({ where: { userId, archivedAt: null } }),
    prisma.transaction.findMany({ where: { userId }, include: { category: true } }),
    prisma.card.findMany({ where: { userId, archivedAt: null } }),
    getAllAlerts(),
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
        where: { userId, cardId: card.id, invoice: { paidAt: null }, kind: { in: ["EXPENSE", "CARD_ADJUSTMENT"] } },
        _sum: { amountCents: true },
      });
      const { availableCents, utilizationPercent } = calculateAvailableLimit({
        limitCents: card.limitCents,
        unpaidInvoiceTotalCents: unpaidAgg._sum.amountCents ?? 0,
      });
      return { card, availableCents, utilizationPercent };
    })
  );

  return {
    netWorth,
    availableBalance,
    monthLabel: month.label,
    monthSavings,
    cards: cardsWithLimit,
    alerts: selectDashboardAlerts(alerts),
    hasAnyData: accounts.length > 0,
  };
}

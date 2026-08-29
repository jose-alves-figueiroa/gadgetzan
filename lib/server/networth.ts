import { prisma } from "@/lib/db";
import { requireUserId } from "./session";
import { todayDateString } from "./clock";
import { addDays, addMonths, formatDateParts, getFinancialMonth, parseDateParts } from "@/lib/finance/period";
import { calculateAccountBalance } from "@/lib/finance/accounts";
import { calculateNetWorth } from "@/lib/finance/networth";
import type { FinanceTransaction } from "@/lib/finance/types";

export type NetWorthRange = "6M" | "12M" | "ALL";

export interface NetWorthPoint {
  year: number;
  month: number;
  label: string;
  accountsCents: number;
  investedCents: number;
  netWorthCents: number;
  isCurrent: boolean;
  isProjection: boolean;
}

/**
 * Net worth history, reconstructed at read time (R11 explicitly allows this
 * over a stored snapshot). Past accounts balances replay exactly from
 * stored transactions. Past invested totals reverse INVESTMENT_IN/OUT moves
 * off today's currentCents — accurate for contributions/withdrawals, but
 * assumes flat market value between snapshots since the schema has no
 * valuation-history table (Stage 2 flagged this as a data-access deferral).
 * The next month is a single outline-only projection point (screen 1x).
 */
export async function getNetWorthHistory(range: NetWorthRange = "6M") {
  const userId = await requireUserId();
  const settings = await prisma.settings.findUniqueOrThrow({ where: { userId } });
  const today = todayDateString();

  const [accounts, investments, rawTransactions] = await Promise.all([
    prisma.account.findMany({ where: { userId, archivedAt: null, includeInTotals: true } }),
    prisma.investment.findMany({ where: { userId, archivedAt: null } }),
    prisma.transaction.findMany({ where: { userId } }),
  ]);

  const financeTx: FinanceTransaction[] = rawTransactions.map((t) => ({
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

  const monthStartDay = settings.monthStartDay;
  const currentMonth = getFinancialMonth(today, monthStartDay);

  const earliestTrackedDate = accounts.reduce((min, a) => {
    const d = a.openingDate.toISOString().slice(0, 10);
    return d < min ? d : min;
  }, today);

  const monthsBack = range === "6M" ? 6 : range === "12M" ? 12 : 60;

  function investedAsOf(asOf: string): number {
    return investments.reduce((sum, inv) => {
      const movesAfter = rawTransactions.filter((t) => t.investmentId === inv.id && t.competenceDate.toISOString().slice(0, 10) > asOf);
      const reversal = movesAfter.reduce(
        (s, t) => s + (t.kind === "INVESTMENT_IN" ? -t.amountCents : t.kind === "INVESTMENT_OUT" ? t.amountCents : 0),
        0
      );
      return sum + inv.currentCents + reversal;
    }, 0);
  }

  const points: NetWorthPoint[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const cal = addMonths(parseDateParts(currentMonth.start), -i);
    const anchorDate = formatDateParts({ ...cal, day: 15 });
    const fm = getFinancialMonth(anchorDate, monthStartDay);
    const isCurrent = fm.start === currentMonth.start;
    if (fm.start < earliestTrackedDate && !isCurrent) continue;

    const asOf = isCurrent ? today : addDays(fm.end, -1);
    const accountsCents = accounts.reduce(
      (s, a) => s + calculateAccountBalance(a.id, a.openingBalance, financeTx, asOf),
      0
    );
    const investedCents = investedAsOf(asOf);
    const netWorthCents = calculateNetWorth({
      accountBalances: [accountsCents],
      investmentValues: [investedCents],
      subtractOpenInvoices: settings.netWorthSubtractsOpenInvoices,
    });

    const fmStartParts = parseDateParts(fm.start);
    points.push({
      year: fmStartParts.year,
      month: fmStartParts.month,
      label: fm.label,
      accountsCents,
      investedCents,
      netWorthCents,
      isCurrent,
      isProjection: false,
    });
  }

  // Next month — outline-only projection: accounts extrapolated flat from
  // today's balance (no committed-flow projection wired here yet), invested
  // held at today's value.
  const nextCal = addMonths(parseDateParts(currentMonth.start), 1);
  const nextLabel = getFinancialMonth(formatDateParts({ ...nextCal, day: 15 }), monthStartDay).label;
  const todayAccountsCents = accounts.reduce((s, a) => s + calculateAccountBalance(a.id, a.openingBalance, financeTx, today), 0);
  const todayInvestedCents = investedAsOf(today);
  points.push({
    year: nextCal.year,
    month: nextCal.month,
    label: nextLabel,
    accountsCents: todayAccountsCents,
    investedCents: todayInvestedCents,
    netWorthCents: calculateNetWorth({
      accountBalances: [todayAccountsCents],
      investmentValues: [todayInvestedCents],
      subtractOpenInvoices: settings.netWorthSubtractsOpenInvoices,
    }),
    isCurrent: false,
    isProjection: true,
  });

  const first = points[0];
  const last = points[points.length - 2] ?? first;
  const changeCents = last.netWorthCents - first.netWorthCents;

  return { points, changeCents };
}

import { prisma } from "@/lib/db";
import { requireUserId } from "./session";
import { todayDateString } from "./clock";
import { addMonths, formatDateParts, getFinancialMonth, parseDateParts } from "@/lib/finance/period";
import { isExpense } from "@/lib/finance/transactions";
import type { FinanceTransaction } from "@/lib/finance/types";

export type AnalysisDimension = "category" | "card" | "account";

export interface AnalysisRow {
  id: string;
  name: string;
  nature?: string;
  valueCents: number;
  percentOfTotal: number;
  changePercent: number | null;
  limitCents: number | null;
}

export async function getAnalysisData(dimension: AnalysisDimension, monthOffset = 0) {
  const userId = await requireUserId();

  const [settings, categories, cards, accounts, limits, transactions] = await Promise.all([
    prisma.settings.findUniqueOrThrow({ where: { userId } }),
    prisma.category.findMany({ where: { userId } }),
    prisma.card.findMany({ where: { userId, archivedAt: null } }),
    prisma.account.findMany({ where: { userId, archivedAt: null } }),
    prisma.limit.findMany({ where: { userId, archivedAt: null, scope: "CATEGORY" } }),
    prisma.transaction.findMany({ where: { userId } }),
  ]);

  const financeTx: FinanceTransaction[] = transactions.map((t) => ({
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

  const today = todayDateString();
  const anchor = addMonths(parseDateParts(today), monthOffset);
  const anchorDate = formatDateParts({ ...anchor, day: 15 });
  const month = getFinancialMonth(anchorDate, settings.monthStartDay);
  const previousMonth = getFinancialMonth(
    formatDateParts({ ...addMonths(parseDateParts(month.start), -1), day: 15 }),
    settings.monthStartDay
  );

  const monthTx = financeTx.filter((t) => isExpense(t.kind) && t.competenceDate >= month.start && t.competenceDate < month.end);
  const previousTx = financeTx.filter(
    (t) => isExpense(t.kind) && t.competenceDate >= previousMonth.start && t.competenceDate < previousMonth.end
  );

  const groupKey = dimension === "category" ? "categoryId" : dimension === "card" ? "cardId" : "accountId";
  const entities: { id: string; name: string; nature?: string }[] =
    dimension === "category"
      ? categories.map((c) => ({ id: c.id, name: c.name, nature: c.nature as string }))
      : dimension === "card"
        ? cards.map((c) => ({ id: c.id, name: c.name }))
        : accounts.map((a) => ({ id: a.id, name: a.nickname }));

  const limitByCategory = new Map(limits.filter((l) => l.categoryId).map((l) => [l.categoryId as string, l.amountCents]));

  const totalCents = monthTx.reduce((s, t) => s + t.amountCents, 0);

  const rows: AnalysisRow[] = entities
    .map((entity) => {
      const value = monthTx
        .filter((t) => (t as unknown as Record<string, string | null>)[groupKey] === entity.id)
        .reduce((s, t) => s + t.amountCents, 0);
      const previousValue = previousTx
        .filter((t) => (t as unknown as Record<string, string | null>)[groupKey] === entity.id)
        .reduce((s, t) => s + t.amountCents, 0);
      const changePercent = previousValue === 0 ? null : ((value - previousValue) / previousValue) * 100;

      return {
        id: entity.id,
        name: entity.name,
        nature: entity.nature,
        valueCents: value,
        percentOfTotal: totalCents === 0 ? 0 : (value / totalCents) * 100,
        changePercent,
        limitCents: dimension === "category" ? (limitByCategory.get(entity.id) ?? null) : null,
      };
    })
    .filter((r) => r.valueCents > 0)
    .sort((a, b) => b.valueCents - a.valueCents);

  const natureById = new Map(categories.map((c) => [c.id, c.nature]));
  const natureBreakdown = { FIXED: 0, VARIABLE: 0, COMMITMENT: 0 };
  for (const t of monthTx) {
    const nature = t.categoryId ? natureById.get(t.categoryId) : undefined;
    if (nature === "FIXED" || nature === "VARIABLE" || nature === "COMMITMENT") natureBreakdown[nature] += t.amountCents;
  }

  const monthlyBars: { label: string; valueCents: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const cal = addMonths(parseDateParts(month.start), -i);
    const barAnchor = formatDateParts({ ...cal, day: 15 });
    const fm = getFinancialMonth(barAnchor, settings.monthStartDay);
    const value = financeTx
      .filter((t) => isExpense(t.kind) && t.competenceDate >= fm.start && t.competenceDate < fm.end)
      .reduce((s, t) => s + t.amountCents, 0);
    monthlyBars.push({ label: fm.label, valueCents: value });
  }

  const topVariance = rows
    .filter((r) => r.changePercent !== null)
    .sort((a, b) => Math.abs(b.changePercent ?? 0) - Math.abs(a.changePercent ?? 0))[0];

  return { month, rows, totalCents, natureBreakdown, monthlyBars, topVariance: topVariance ?? null };
}

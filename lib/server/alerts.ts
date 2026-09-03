"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserId } from "./session";
import { toPrismaDate, todayDateString } from "./clock";
import { addMonths, formatDateParts, getFinancialMonth, parseDateParts } from "@/lib/finance/period";
import { calculateLimitUtilization } from "@/lib/finance/limits";
import { calculateAvailableLimit, assignInvoice } from "@/lib/finance/invoice";
import { calculateVariableProjection } from "@/lib/finance/projection";
import { isExpense } from "@/lib/finance/transactions";
import { getUnpaidInvoiceTotalCents } from "./invoices";
import {
  categoryLimitAlert,
  cardUtilizationAlert,
  invoiceSpikeAlert,
  negativeProjectedBalanceAlert,
  goalBehindPaceAlert,
  variableCategoryAboveAverageAlert,
  variableCategoryBelowAverageAlert,
  sortBySeverity,
  type Alert,
} from "@/lib/finance/alerts";
import { getUpcomingMonths } from "./future";
import { listGoalsWithProgress } from "./goals";
import type { FinanceTransaction } from "@/lib/finance/types";

async function invoiceTotal(cardId: string, referenceMonth: { year: number; month: number }) {
  const referenceMonthDate = toPrismaDate(formatDateParts({ ...referenceMonth, day: 1 }));
  const invoice = await prisma.invoice.findUnique({
    where: { cardId_referenceMonth: { cardId, referenceMonth: referenceMonthDate } },
    include: { transactions: true },
  });
  if (!invoice) return { totalCents: 0, descriptions: [] as string[] };
  const expenseTx = invoice.transactions.filter((t) => isExpense(t.kind));
  const totalCents = expenseTx.reduce((s, t) => s + t.amountCents, 0);
  const descriptions = [...new Set(expenseTx.map((t) => t.description.replace(/\s*\(\d+\/\d+\)$/, "")))];
  return { totalCents, descriptions };
}

/** Every R13 trigger, ordered by severity. Alerts dismissed earlier this same financial month are excluded. */
export async function getAllAlerts(): Promise<Alert[]> {
  const userId = await requireUserId();
  const today = todayDateString();

  const [settings, categories, limits, cards, transactions, dismissed, upcoming, goalsData] = await Promise.all([
    prisma.settings.findUniqueOrThrow({ where: { userId } }),
    prisma.category.findMany({ where: { userId } }),
    prisma.limit.findMany({ where: { userId, archivedAt: null }, include: { category: true } }),
    prisma.card.findMany({ where: { userId, archivedAt: null } }),
    prisma.transaction.findMany({ where: { userId } }),
    prisma.alertState.findMany({ where: { userId } }),
    getUpcomingMonths(),
    listGoalsWithProgress(),
  ]);

  const month = getFinancialMonth(today, settings.monthStartDay);
  const dismissedKeys = new Set(
    dismissed.filter((d) => d.dismissedAt && d.dismissedAt.toISOString().slice(0, 10) >= month.start).map((d) => d.alertKey)
  );

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
  const monthTx = financeTx.filter((t) => t.competenceDate >= month.start && t.competenceDate < month.end);

  const alerts: Alert[] = [];

  // Category limits (R13).
  for (const limit of limits) {
    if (limit.scope !== "CATEGORY" || !limit.categoryId || !limit.amountCents) continue;
    const spent = monthTx
      .filter((t) => isExpense(t.kind) && t.categoryId === limit.categoryId)
      .reduce((s, t) => s + t.amountCents, 0);
    const utilization = calculateLimitUtilization(spent, limit.amountCents, limit.warnAtPercent);
    const daysRemaining = Math.max(
      0,
      Math.ceil((new Date(`${month.end}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86400000)
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

  // Card utilization + invoice spike.
  for (const card of cards) {
    const unpaidInvoiceTotalCents = await getUnpaidInvoiceTotalCents(userId, card.id);
    const { utilizationPercent } = calculateAvailableLimit({
      limitCents: card.limitCents,
      unpaidInvoiceTotalCents,
    });
    const cardAlert = cardUtilizationAlert({
      cardId: card.id,
      cardName: card.name,
      utilizationPercent,
      targetPercent: card.utilizationTarget ?? settings.cardUtilizationTarget,
    });
    if (cardAlert) alerts.push(cardAlert);

    const openMonth = assignInvoice(today, card.closingDay, card.dueDay).referenceMonth;
    const previousMonth = addMonths(openMonth, -1);
    const [current, previous] = await Promise.all([invoiceTotal(card.id, openMonth), invoiceTotal(card.id, previousMonth)]);
    const spike = invoiceSpikeAlert({
      cardId: card.id,
      month: formatDateParts({ ...openMonth, day: 1 }).slice(0, 7),
      previousCents: previous.totalCents,
      currentCents: current.totalCents,
      causeDescriptions: current.descriptions,
    });
    if (spike) alerts.push(spike);
  }

  // Next month's projected balance.
  const nextMonth = upcoming.months[0];
  if (nextMonth) {
    const negBalance = negativeProjectedBalanceAlert({
      month: nextMonth.label,
      projectedBalanceCents: nextMonth.projectedBalanceCents,
    });
    if (negBalance) alerts.push(negBalance);
  }

  // Goals behind pace.
  for (const goal of goalsData.goals) {
    if (!goal.pace || goal.pace.status !== "behind_pace") continue;
    const alert = goalBehindPaceAlert({ goalId: goal.id, goalName: goal.name, behindByCents: goal.pace.behindByCents });
    if (alert) alerts.push(alert);
  }

  // Variable categories vs. their historical average.
  const variableCategories = categories.filter((c) => c.nature === "VARIABLE");
  for (const category of variableCategories) {
    const currentCents = monthTx
      .filter((t) => isExpense(t.kind) && t.categoryId === category.id)
      .reduce((s, t) => s + t.amountCents, 0);

    const closedTotals: number[] = [];
    let anchor: { year: number; month: number } = parseDateParts(month.start);
    for (let i = 0; i < settings.variableLookback; i++) {
      anchor = addMonths(anchor, -1);
      const anchorDate = formatDateParts({ ...anchor, day: 15 });
      const closedMonth = getFinancialMonth(anchorDate, settings.monthStartDay);
      const total = financeTx
        .filter((t) => isExpense(t.kind) && t.categoryId === category.id)
        .filter((t) => t.competenceDate >= closedMonth.start && t.competenceDate < closedMonth.end)
        .reduce((s, t) => s + t.amountCents, 0);
      closedTotals.unshift(total);
    }
    const averageCents = calculateVariableProjection(closedTotals, settings.variableLookback);
    if (averageCents === null) continue;

    const above = variableCategoryAboveAverageAlert({ categoryId: category.id, categoryName: category.name, currentCents, averageCents });
    if (above) alerts.push(above);
    const below = variableCategoryBelowAverageAlert({ categoryId: category.id, categoryName: category.name, currentCents, averageCents });
    if (below) alerts.push(below);
  }

  // alertKey must be stable and unique (R13) — de-dupe defensively in case two
  // Limit rows (or other sources) ever target the same underlying entity.
  const seenKeys = new Set<string>();
  const deduped = alerts.filter((a) => {
    if (seenKeys.has(a.alertKey)) return false;
    seenKeys.add(a.alertKey);
    return true;
  });

  const active = deduped.filter((a) => !dismissedKeys.has(a.alertKey));
  return sortBySeverity(active);
}

export async function dismissAlert(alertKey: string) {
  const userId = await requireUserId();
  await prisma.alertState.upsert({
    where: { userId_alertKey: { userId, alertKey } },
    create: { userId, alertKey, dismissedAt: toPrismaDate(todayDateString()) },
    update: { dismissedAt: toPrismaDate(todayDateString()) },
  });
  revalidatePath("/alerts");
  revalidatePath("/");
}

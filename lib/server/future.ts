import { prisma } from "@/lib/db";
import { requireUserId } from "./session";
import { todayDateString } from "./clock";
import { addDays, addMonths, formatDateParts, getFinancialMonth, parseDateParts } from "@/lib/finance/period";
import { generateOccurrences, type RecurrenceRuleInput } from "@/lib/finance/recurrence";
import { assignInvoice } from "@/lib/finance/invoice";
import { calculateProjectedBalanceSeries, calculateVariableProjection } from "@/lib/finance/projection";
import { calculateAccountBalance } from "@/lib/finance/accounts";
import { isExpense, isIncome } from "@/lib/finance/transactions";
import type { Confidence, FinanceTransaction } from "@/lib/finance/types";

export interface MonthForecast {
  year: number;
  month: number;
  label: string;
  incomeCents: number;
  expensesCents: number;
  invoicesCents: number;
  resultCents: number;
  projectedBalanceCents: number;
  /** Composition of expenses+invoices for the stacked "committed spend" bar (1d). */
  breakdown: Record<Confidence, number>;
  lowConfidence: boolean;
}

export interface UpcomingMonthsResult {
  months: MonthForecast[];
  currentBalanceCents: number;
}

function ruleToInput(rule: {
  frequency: "MONTHLY" | "WEEKLY" | "YEARLY";
  dayOfMonth: number | null;
  weekday: number | null;
  monthOfYear: number | null;
  startDate: Date;
  endDate: Date | null;
  status: "ACTIVE" | "PAUSED" | "ENDED";
}): RecurrenceRuleInput {
  return {
    frequency: rule.frequency,
    dayOfMonth: rule.dayOfMonth,
    weekday: rule.weekday,
    monthOfYear: rule.monthOfYear,
    startDate: rule.startDate.toISOString().slice(0, 10),
    endDate: rule.endDate ? rule.endDate.toISOString().slice(0, 10) : null,
    status: rule.status,
  };
}

/**
 * Forecast for the next `Settings.projectionMonths` financial months (1d,
 * and the dashboard's "Próximo mês previsto"/"Faturas projetadas" boxes).
 * Combines: RECURRING (generated, not yet materialized occurrences),
 * CONFIRMED (already-stored future transactions/installments), and — for
 * VARIABLE categories only — a PROJECTED average of closed months (R8).
 * Card invoices deliberately never receive a PROJECTED component: future
 * one-off card purchases aren't estimated (R8's explicit caveat, screen 1e).
 */
export async function getUpcomingMonths(): Promise<UpcomingMonthsResult> {
  const userId = await requireUserId();
  const today = todayDateString();

  const [settings, accounts, allTransactions, cards, rules, categories, invoices] = await Promise.all([
    prisma.settings.findUniqueOrThrow({ where: { userId } }),
    prisma.account.findMany({ where: { userId, archivedAt: null } }),
    prisma.transaction.findMany({ where: { userId } }),
    prisma.card.findMany({ where: { userId, archivedAt: null } }),
    prisma.recurrenceRule.findMany({ where: { userId, status: "ACTIVE" } }),
    prisma.category.findMany({ where: { userId } }),
    prisma.invoice.findMany({ where: { userId }, select: { id: true, referenceMonth: true } }),
  ]);

  const categoryNature = new Map(categories.map((c) => [c.id, c.nature]));
  const cardById = new Map(cards.map((c) => [c.id, c]));
  // A stored card transaction's real month is its Invoice's referenceMonth —
  // never re-derived from competenceDate, which stays the ORIGINAL purchase
  // date on every installment row regardless of which future month it lands on.
  const invoiceMonthById = new Map(
    invoices.map((inv) => {
      const d = inv.referenceMonth.toISOString().slice(0, 10);
      return [inv.id, { year: Number(d.slice(0, 4)), month: Number(d.slice(5, 7)) }];
    })
  );

  const financeTx: FinanceTransaction[] = allTransactions.map((t) => ({
    id: t.id,
    kind: t.kind,
    amountCents: t.amountCents,
    competenceDate: t.competenceDate.toISOString().slice(0, 10),
    categoryId: t.categoryId,
    accountId: t.accountId,
    toAccountId: t.toAccountId,
    cardId: t.cardId,
    invoiceId: t.invoiceId,
    method: t.method,
  }));

  const currentBalanceCents = accounts
    .filter((a) => a.includeInTotals)
    .reduce((sum, a) => sum + calculateAccountBalance(a.id, a.openingBalance, financeTx, today), 0);

  const monthStartDay = settings.monthStartDay;
  const currentMonth = getFinancialMonth(today, monthStartDay);

  const earliestTrackedDate = accounts.reduce((min, a) => {
    const d = a.openingDate.toISOString().slice(0, 10);
    return d < min ? d : min;
  }, today);

  // Average of VARIABLE-category expenses over the last variableLookback closed
  // financial months since tracking began — null (no projection) with fewer (R8).
  const closedVariableTotals: number[] = [];
  {
    let anchor: { year: number; month: number } = parseDateParts(currentMonth.start);
    for (let i = 0; i < settings.variableLookback + 6; i++) {
      anchor = addMonths(anchor, -1);
      const anchorDate = formatDateParts({ ...anchor, day: 15 });
      const closedMonth = getFinancialMonth(anchorDate, monthStartDay);
      if (closedMonth.start < earliestTrackedDate) break;
      const total = financeTx
        .filter((t) => isExpense(t.kind) && categoryNature.get(t.categoryId ?? "") === "VARIABLE")
        .filter((t) => t.competenceDate >= closedMonth.start && t.competenceDate < closedMonth.end)
        .reduce((sum, t) => sum + t.amountCents, 0);
      closedVariableTotals.unshift(total);
    }
  }
  const variableProjectionCents = calculateVariableProjection(closedVariableTotals, settings.variableLookback);
  const lowConfidence = variableProjectionCents === null;

  const targets = Array.from({ length: settings.projectionMonths }, (_, i) => {
    const cal = addMonths(parseDateParts(currentMonth.start), i + 1);
    const anchorDate = formatDateParts({ ...cal, day: 15 });
    const fm = getFinancialMonth(anchorDate, monthStartDay);
    return { year: cal.year, month: cal.month, label: fm.label, start: fm.start, end: fm.end };
  });

  const horizonStart = targets[0].start;
  const horizonEnd = targets[targets.length - 1].end;
  // A CARD-method occurrence can land on an invoice up to one calendar month
  // after its own date (assignInvoice) — pad the generation window accordingly.
  const occurrenceRangeStart = addDays(horizonStart, -31);
  const occurrenceRangeEnd = addDays(horizonEnd, 31);

  const occurrences: { date: string; amountCents: number; kind: "INCOME" | "EXPENSE"; method: "ACCOUNT" | "CARD"; cardId: string | null }[] = [];
  for (const rule of rules) {
    const dates = generateOccurrences(ruleToInput(rule), occurrenceRangeStart, occurrenceRangeEnd);
    for (const date of dates) {
      occurrences.push({ date, amountCents: rule.amountCents, kind: rule.kind as "INCOME" | "EXPENSE", method: rule.method, cardId: rule.cardId });
    }
  }

  const months: MonthForecast[] = targets.map((target) => {
    let incomeRecurring = 0;
    let incomeConfirmed = 0;
    let expenseRecurring = 0;
    let expenseConfirmed = 0;
    let invoiceRecurring = 0;
    let invoiceConfirmed = 0;

    for (const occ of occurrences) {
      if (occ.method === "CARD") {
        const card = occ.cardId ? cardById.get(occ.cardId) : undefined;
        if (!card) continue;
        const assignment = assignInvoice(occ.date, card.closingDay, card.dueDay);
        if (assignment.referenceMonth.year !== target.year || assignment.referenceMonth.month !== target.month) continue;
        invoiceRecurring += occ.amountCents;
      } else {
        if (occ.date < target.start || occ.date >= target.end) continue;
        if (occ.kind === "INCOME") incomeRecurring += occ.amountCents;
        else expenseRecurring += occ.amountCents;
      }
    }

    for (const t of financeTx) {
      // Card-method expenses are bucketed by the invoice they actually land
      // on (R3) — an installment keeps the purchase's original date on every
      // row, so competenceDate alone can't tell which future month it's in.
      if (isExpense(t.kind) && t.method === "CARD") {
        const invoiceMonth = t.invoiceId ? invoiceMonthById.get(t.invoiceId) : undefined;
        if (invoiceMonth && invoiceMonth.year === target.year && invoiceMonth.month === target.month) {
          invoiceConfirmed += t.amountCents;
        }
        continue;
      }
      if (t.competenceDate < target.start || t.competenceDate >= target.end) continue;
      if (isIncome(t.kind)) incomeConfirmed += t.amountCents;
      else if (isExpense(t.kind)) expenseConfirmed += t.amountCents;
    }

    const expenseProjected = variableProjectionCents ?? 0;

    const incomeCents = incomeRecurring + incomeConfirmed;
    const expensesCents = expenseRecurring + expenseConfirmed + expenseProjected;
    const invoicesCents = invoiceRecurring + invoiceConfirmed;
    const resultCents = incomeCents - expensesCents - invoicesCents;

    const breakdown: Record<Confidence, number> = {
      REALIZED: 0,
      CONFIRMED: incomeConfirmed + expenseConfirmed + invoiceConfirmed,
      RECURRING: incomeRecurring + expenseRecurring + invoiceRecurring,
      PROJECTED: expenseProjected,
    };

    return {
      year: target.year,
      month: target.month,
      label: target.label,
      incomeCents,
      expensesCents,
      invoicesCents,
      resultCents,
      projectedBalanceCents: 0,
      breakdown,
      lowConfidence,
    };
  });

  const series = calculateProjectedBalanceSeries(
    currentBalanceCents,
    months.map((m) => ({
      expectedIncomeCents: m.incomeCents,
      expectedAccountExpensesCents: m.expensesCents,
      invoicesDueCents: m.invoicesCents,
      scheduledContributionsCents: 0,
    }))
  );
  months.forEach((m, i) => {
    m.projectedBalanceCents = series[i + 1];
  });

  return { months, currentBalanceCents };
}

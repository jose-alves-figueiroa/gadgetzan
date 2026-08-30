import { prisma } from "@/lib/db";
import { requireUserId } from "./session";
import { toPrismaDate, todayDateString } from "./clock";
import { addDays, addMonths, formatDateParts, getFinancialMonth, parseDateParts } from "@/lib/finance/period";
import { calculateAccountBalance } from "@/lib/finance/accounts";
import { generateOccurrences, type RecurrenceRuleInput } from "@/lib/finance/recurrence";
import type { FinanceTransaction } from "@/lib/finance/types";

function ruleToOccurrenceInput(rule: {
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

export interface AgendaRow {
  date: string;
  kind: "income" | "expense" | "transfer" | "investment_in" | "investment_out" | "card" | "card_payment" | "card_adjustment" | "invoice-closing" | "invoice-due";
  label: string;
  subLabel?: string;
  amountCents?: number;
  runningBalanceCents: number;
}

export async function getCalendarMonth(monthOffset: number) {
  const userId = await requireUserId();
  const settings = await prisma.settings.findUniqueOrThrow({ where: { userId } });
  const today = todayDateString();

  const anchor = addMonths(parseDateParts(today), monthOffset);
  const anchorDate = formatDateParts({ ...anchor, day: 15 });
  const month = getFinancialMonth(anchorDate, settings.monthStartDay);

  const [accounts, transactions, rules] = await Promise.all([
    prisma.account.findMany({ where: { userId, archivedAt: null, includeInTotals: true } }),
    prisma.transaction.findMany({
      where: { userId },
      include: { category: true, account: true, card: true },
    }),
    prisma.recurrenceRule.findMany({
      where: { userId, status: "ACTIVE", method: "ACCOUNT" },
      include: { category: true },
    }),
  ]);

  const accountNicknameById = new Map(accounts.map((a) => [a.id, a.nickname]));

  const allFinance: FinanceTransaction[] = transactions.map((t) => ({
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

  const dayBeforeStart = addDays(month.start, -1);
  const openingBalanceCents = accounts.reduce(
    (sum, a) => sum + calculateAccountBalance(a.id, a.openingBalance, allFinance, dayBeforeStart),
    0
  );

  const monthTx = transactions.filter((t) => {
    const d = t.competenceDate.toISOString().slice(0, 10);
    return d >= month.start && d < month.end;
  });

  const invoices = await prisma.invoice.findMany({
    where: {
      userId,
      OR: [
        { closingDate: { gte: toPrismaDate(month.start), lt: toPrismaDate(month.end) } },
        { dueDate: { gte: toPrismaDate(month.start), lt: toPrismaDate(month.end) } },
      ],
    },
    include: { card: true },
  });

  interface RawRow {
    date: string;
    kind: AgendaRow["kind"];
    label: string;
    subLabel?: string;
    amountCents?: number;
    balanceDelta: number;
  }
  const rows: RawRow[] = [];

  for (const t of monthTx) {
    const date = t.competenceDate.toISOString().slice(0, 10);
    let balanceDelta = 0;
    let amountCents: number | undefined;
    let kind: AgendaRow["kind"] = "expense";

    switch (t.kind) {
      case "INCOME":
        balanceDelta = t.amountCents;
        amountCents = t.amountCents;
        kind = "income";
        break;
      case "EXPENSE":
        amountCents = -t.amountCents;
        kind = t.method === "CARD" ? "card" : "expense";
        if (t.method === "ACCOUNT") balanceDelta = -t.amountCents;
        break;
      case "TRANSFER":
        kind = "transfer";
        break;
      case "INVESTMENT_IN":
        balanceDelta = -t.amountCents;
        amountCents = -t.amountCents;
        kind = "investment_in";
        break;
      case "INVESTMENT_OUT":
        balanceDelta = t.amountCents;
        amountCents = t.amountCents;
        kind = "investment_out";
        break;
      case "CARD_PAYMENT":
        balanceDelta = -t.amountCents;
        amountCents = -t.amountCents;
        kind = "card_payment";
        break;
      case "CARD_ADJUSTMENT":
        amountCents = -t.amountCents;
        kind = "card_adjustment";
        break;
      default:
        continue;
    }

    rows.push({
      date,
      kind,
      label: t.description,
      subLabel: t.category?.name ?? (t.method === "CARD" ? t.card?.name : t.account?.nickname) ?? undefined,
      amountCents,
      balanceDelta,
    });
  }

  // Future occurrences of active ACCOUNT-method recurrences (R6/R7 RECURRING),
  // so a newly created recurrence shows up in the calendar immediately —
  // unambiguous since a not-yet-arrived date can't already have a realized
  // Transaction. Past-due occurrences with no matching transaction ("pending",
  // R6) are a separate, harder matching problem (no linking key between an
  // occurrence and the Transaction that fulfills it) — deliberately not
  // solved here; isOccurrencePending() exists in lib/finance/recurrence.ts
  // but stays unwired until that's designed.
  for (const rule of rules) {
    const rangeStart = today > month.start ? addDays(today, 1) : month.start;
    if (rangeStart >= month.end) continue;
    const dates = generateOccurrences(ruleToOccurrenceInput(rule), rangeStart, addDays(month.end, -1));
    for (const date of dates) {
      const isIncome = rule.kind === "INCOME";
      rows.push({
        date,
        kind: isIncome ? "income" : "expense",
        label: rule.description,
        subLabel: rule.category?.name ?? (rule.accountId ? accountNicknameById.get(rule.accountId) : undefined),
        amountCents: isIncome ? rule.amountCents : -rule.amountCents,
        balanceDelta: isIncome ? rule.amountCents : -rule.amountCents,
      });
    }
  }

  for (const inv of invoices) {
    const closingDate = inv.closingDate.toISOString().slice(0, 10);
    const dueDate = inv.dueDate.toISOString().slice(0, 10);
    if (closingDate >= month.start && closingDate < month.end) {
      rows.push({ date: closingDate, kind: "invoice-closing", label: `Fatura ${inv.card.name} fecha`, balanceDelta: 0 });
    }
    if (dueDate >= month.start && dueDate < month.end) {
      rows.push({ date: dueDate, kind: "invoice-due", label: `Fatura ${inv.card.name} vence`, balanceDelta: 0 });
    }
  }

  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  let running = openingBalanceCents;
  let lowest = { balanceCents: openingBalanceCents, date: month.start };
  const agenda: AgendaRow[] = rows.map((r) => {
    running += r.balanceDelta;
    if (running < lowest.balanceCents) lowest = { balanceCents: running, date: r.date };
    return {
      date: r.date,
      kind: r.kind,
      label: r.label,
      subLabel: r.subLabel,
      amountCents: r.amountCents,
      runningBalanceCents: running,
    };
  });

  const totalIn = monthTx.filter((t) => t.kind === "INCOME").reduce((s, t) => s + t.amountCents, 0);
  const totalOut = monthTx
    .filter((t) => t.kind === "EXPENSE" && t.method === "ACCOUNT")
    .reduce((s, t) => s + t.amountCents, 0);

  return {
    month,
    agenda,
    openingBalanceCents,
    closingBalanceCents: running,
    totalIn,
    totalOut,
    lowestBalance: lowest,
  };
}

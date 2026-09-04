// R12 — account balance.
import type { FinanceTransaction } from "./types";

/**
 * Balance of a single account as of `today` (YYYY-MM-DD). Only transactions
 * with competenceDate <= today enter the balance; future ones feed the
 * projection instead. CARD_ADJUSTMENT and GOAL_IN/GOAL_OUT never touch an
 * account's balance (R12) — adjustments stay on the invoice, goals are a
 * logical reserve over money already counted here.
 */
export function calculateAccountBalance(
  accountId: string,
  openingBalance: number,
  transactions: FinanceTransaction[],
  today: string
): number {
  let balance = openingBalance;

  for (const t of transactions) {
    if (t.competenceDate > today) continue;

    switch (t.kind) {
      case "INCOME":
        if (t.accountId === accountId) balance += t.amountCents;
        break;
      case "EXPENSE":
        if (t.accountId === accountId && t.method === "ACCOUNT") balance -= t.amountCents;
        break;
      case "TRANSFER":
        if (t.accountId === accountId) balance -= t.amountCents;
        if (t.toAccountId === accountId) balance += t.amountCents;
        break;
      case "INVESTMENT_IN":
        if (t.accountId === accountId) balance -= t.amountCents;
        break;
      case "INVESTMENT_OUT":
        if (t.accountId === accountId) balance += t.amountCents;
        break;
      case "CARD_PAYMENT":
        if (t.accountId === accountId) balance -= t.amountCents;
        break;
      default:
        break;
    }
  }

  return balance;
}

/**
 * Whether a transaction moved money into ("in"), out of ("out"), or left
 * untouched (null) a given account — the same per-kind sign convention as
 * calculateAccountBalance, exposed for display (e.g. coloring a ledger row
 * green/red) instead of accumulating a total.
 */
export function accountTransactionDirection(
  accountId: string,
  t: FinanceTransaction
): "in" | "out" | null {
  switch (t.kind) {
    case "INCOME":
      return t.accountId === accountId ? "in" : null;
    case "EXPENSE":
      return t.accountId === accountId && t.method === "ACCOUNT" ? "out" : null;
    case "TRANSFER":
      if (t.accountId === accountId) return "out";
      if (t.toAccountId === accountId) return "in";
      return null;
    case "INVESTMENT_IN":
      return t.accountId === accountId ? "out" : null;
    case "INVESTMENT_OUT":
      return t.accountId === accountId ? "in" : null;
    case "CARD_PAYMENT":
      return t.accountId === accountId ? "out" : null;
    default:
      return null;
  }
}

/**
 * Realized inflow/outflow totals for an account's own ledger, as of `today`.
 * Deliberately not R1's isIncome/isExpense (which excludes TRANSFER from
 * both) — from a single account's point of view, a transfer out is still
 * money leaving it, and a transfer in is still money arriving. Built on
 * accountTransactionDirection so this never drifts from calculateAccountBalance.
 */
export function calculateAccountFlows(
  accountId: string,
  transactions: FinanceTransaction[],
  today: string
): { inflowsCents: number; outflowsCents: number } {
  let inflowsCents = 0;
  let outflowsCents = 0;

  for (const t of transactions) {
    if (t.competenceDate > today) continue;
    const direction = accountTransactionDirection(accountId, t);
    if (direction === "in") inflowsCents += t.amountCents;
    else if (direction === "out") outflowsCents += t.amountCents;
  }

  return { inflowsCents, outflowsCents };
}

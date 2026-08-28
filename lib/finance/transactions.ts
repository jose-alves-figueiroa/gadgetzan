// R1 — moving money isn't spending money.
import type { FinanceTransaction, TxKind } from "./types";

/** Kinds that never count as income or expense in any report/chart/limit/total. */
const NEUTRAL_KINDS: ReadonlySet<TxKind> = new Set([
  "TRANSFER",
  "INVESTMENT_IN",
  "INVESTMENT_OUT",
  "GOAL_IN",
  "GOAL_OUT",
  "CARD_PAYMENT",
]);

export function isIncome(kind: TxKind): boolean {
  return kind === "INCOME";
}

/** CARD_ADJUSTMENT counts as an expense — it's a real charge (R1). */
export function isExpense(kind: TxKind): boolean {
  return kind === "EXPENSE" || kind === "CARD_ADJUSTMENT";
}

export function isNeutral(kind: TxKind): boolean {
  return NEUTRAL_KINDS.has(kind);
}

export function sumIncome(transactions: FinanceTransaction[]): number {
  return transactions.filter((t) => isIncome(t.kind)).reduce((sum, t) => sum + t.amountCents, 0);
}

export function sumExpenses(transactions: FinanceTransaction[]): number {
  return transactions.filter((t) => isExpense(t.kind)).reduce((sum, t) => sum + t.amountCents, 0);
}

// R2 — savings rate includes contributions.
import type { FinanceTransaction } from "./types";

export interface SavingsRateResult {
  income: number;
  expenses: number;
  /** Net INVESTMENT_IN − INVESTMENT_OUT; can be negative. */
  contributions: number;
  cashLeftover: number;
  /** Fraction (0.387 = 38.7%), or null when income is 0. */
  savingsRate: number | null;
}

function sumByKind(transactions: FinanceTransaction[], kind: FinanceTransaction["kind"]): number {
  return transactions.filter((t) => t.kind === kind).reduce((sum, t) => sum + t.amountCents, 0);
}

export function calculateSavingsRate(transactions: FinanceTransaction[]): SavingsRateResult {
  const income = sumByKind(transactions, "INCOME");
  const expenses = sumByKind(transactions, "EXPENSE") + sumByKind(transactions, "CARD_ADJUSTMENT");
  const contributions = sumByKind(transactions, "INVESTMENT_IN") - sumByKind(transactions, "INVESTMENT_OUT");
  const cashLeftover = income - expenses - contributions;
  const savingsRate = income === 0 ? null : (contributions + cashLeftover) / income;

  return { income, expenses, contributions, cashLeftover, savingsRate };
}

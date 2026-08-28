// Limit utilization — category, total, card. Respects D4 (Limit.includeCommitments).
import { isExpense } from "./transactions";
import type { FinanceCategory, FinanceTransaction } from "./types";

export type LimitStatus = "ok" | "warning" | "exceeded";

export interface LimitUtilization {
  spentCents: number;
  amountCents: number;
  percent: number;
  status: LimitStatus;
}

export function calculateLimitUtilization(
  spentCents: number,
  amountCents: number,
  warnAtPercent: number
): LimitUtilization {
  const percent = amountCents === 0 ? 0 : (spentCents / amountCents) * 100;
  const status: LimitStatus = percent >= 100 ? "exceeded" : percent >= warnAtPercent ? "warning" : "ok";
  return { spentCents, amountCents, percent, status };
}

/**
 * Total-month spend for the TOTAL_MONTH limit scope. Excludes COMMITMENT-
 * nature categories by default — an obligation isn't a choice, so counting
 * it would make the limit measure little (D4) — unless includeCommitments
 * is set on the Limit.
 */
export function calculateTotalMonthSpend(
  transactions: FinanceTransaction[],
  categories: FinanceCategory[],
  includeCommitments: boolean
): number {
  const natureById = new Map(categories.map((c) => [c.id, c.nature]));

  return transactions
    .filter((t) => isExpense(t.kind))
    .filter((t) => {
      const nature = t.categoryId ? natureById.get(t.categoryId) : undefined;
      return includeCommitments || nature !== "COMMITMENT";
    })
    .reduce((sum, t) => sum + t.amountCents, 0);
}

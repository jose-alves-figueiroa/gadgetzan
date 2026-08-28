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

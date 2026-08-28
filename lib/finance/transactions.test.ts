import { describe, expect, it } from "vitest";
import { isExpense, isIncome, isNeutral, sumExpenses, sumIncome } from "./transactions";
import type { FinanceTransaction } from "./types";

function tx(kind: FinanceTransaction["kind"], amountCents: number): FinanceTransaction {
  return { id: "t1", kind, amountCents, competenceDate: "2026-08-10" };
}

describe("R1 — moving money isn't spending", () => {
  it("a R$2,000 TRANSFER doesn't count as income or expense", () => {
    const t = tx("TRANSFER", 200000);
    expect(isNeutral(t.kind)).toBe(true);
    expect(sumExpenses([t])).toBe(0);
    expect(sumIncome([t])).toBe(0);
  });

  it("a R$3,000 INVESTMENT_IN doesn't count as an expense", () => {
    const t = tx("INVESTMENT_IN", 300000);
    expect(sumExpenses([t])).toBe(0);
  });

  it("a R$2,340 CARD_PAYMENT doesn't count as an expense", () => {
    const t = tx("CARD_PAYMENT", 234000);
    expect(sumExpenses([t])).toBe(0);
  });

  it("a R$18.40 CARD_ADJUSTMENT counts as an expense", () => {
    const t = tx("CARD_ADJUSTMENT", 1840);
    expect(isExpense(t.kind)).toBe(true);
    expect(sumExpenses([t])).toBe(1840);
  });

  it("only EXPENSE and CARD_ADJUSTMENT sum into expenses; only INCOME sums into income", () => {
    const transactions = [
      tx("EXPENSE", 1000),
      tx("INCOME", 5000),
      tx("CARD_ADJUSTMENT", 200),
      tx("GOAL_IN", 300),
      tx("GOAL_OUT", 300),
      tx("INVESTMENT_OUT", 400),
    ];
    expect(sumExpenses(transactions)).toBe(1200);
    expect(sumIncome(transactions)).toBe(5000);
  });

  it("isIncome/isExpense agree with isNeutral being mutually exclusive", () => {
    (["TRANSFER", "INVESTMENT_IN", "INVESTMENT_OUT", "GOAL_IN", "GOAL_OUT", "CARD_PAYMENT"] as const).forEach(
      (kind) => {
        expect(isIncome(kind)).toBe(false);
        expect(isExpense(kind)).toBe(false);
      }
    );
  });
});

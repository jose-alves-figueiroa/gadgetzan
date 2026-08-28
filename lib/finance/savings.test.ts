import { describe, expect, it } from "vitest";
import { calculateSavingsRate } from "./savings";
import type { FinanceTransaction } from "./types";

function tx(kind: FinanceTransaction["kind"], amountCents: number): FinanceTransaction {
  return { id: `${kind}-${amountCents}-${Math.random()}`, kind, amountCents, competenceDate: "2026-08-10" };
}

describe("R2 — savings rate", () => {
  it("income 15000, expenses 9200, contributions 3000 → cash leftover 2800 and rate 38.7%", () => {
    const result = calculateSavingsRate([
      tx("INCOME", 1_500_000),
      tx("EXPENSE", 920_000),
      tx("INVESTMENT_IN", 300_000),
    ]);

    expect(result.income).toBe(1_500_000);
    expect(result.expenses).toBe(920_000);
    expect(result.contributions).toBe(300_000);
    expect(result.cashLeftover).toBe(280_000);
    expect(result.savingsRate).not.toBeNull();
    expect(Math.round((result.savingsRate as number) * 1000) / 10).toBeCloseTo(38.7, 1);
  });

  it("income 0 → rate is null", () => {
    const result = calculateSavingsRate([tx("EXPENSE", 1000)]);
    expect(result.savingsRate).toBeNull();
  });

  it("a 1000 INVESTMENT_OUT shifts contributions→cashLeftover without changing the rate", () => {
    const before = calculateSavingsRate([tx("INCOME", 10_000), tx("EXPENSE", 4_000), tx("INVESTMENT_IN", 3_000)]);
    const after = calculateSavingsRate([
      tx("INCOME", 10_000),
      tx("EXPENSE", 4_000),
      tx("INVESTMENT_IN", 3_000),
      tx("INVESTMENT_OUT", 1_000),
    ]);

    expect(after.contributions).toBe(before.contributions - 1_000);
    expect(after.cashLeftover).toBe(before.cashLeftover + 1_000);
    expect(after.savingsRate).toBeCloseTo(before.savingsRate as number, 10);
  });

  it("a 1000 GOAL_IN doesn't change any of the four lines", () => {
    const before = calculateSavingsRate([tx("INCOME", 10_000), tx("EXPENSE", 4_000)]);
    const after = calculateSavingsRate([tx("INCOME", 10_000), tx("EXPENSE", 4_000), tx("GOAL_IN", 1_000)]);

    expect(after).toEqual(before);
  });
});
